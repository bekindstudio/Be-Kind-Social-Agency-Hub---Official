import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, socialAccountsTable, clientsTable } from "@workspace/db";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const router: IRouter = Router();

const AGENCY_CLIENT_ID = 0;

// ─── Helpers ────────────────────────────────────────────────────────────────

function getRedirectUri(req: any): string {
  const domain = process.env.REPLIT_DEV_DOMAIN || req.get("host");
  return `https://${domain}/api/meta/callback`;
}

async function graphGet(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`https://graph.facebook.com/v19.0${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
    const metaError = parsed?.error ?? parsed ?? {};
    const error = new Error(
      String(metaError?.message ?? `Graph API error for ${path}: ${text}`),
    ) as Error & {
      code?: number;
      type?: string;
      fbtrace_id?: string;
      graphPath?: string;
    };
    if (typeof metaError?.code === "number") error.code = metaError.code;
    if (typeof metaError?.type === "string") error.type = metaError.type;
    if (typeof metaError?.fbtrace_id === "string") error.fbtrace_id = metaError.fbtrace_id;
    error.graphPath = path;
    throw error;
  }
  return res.json() as Promise<any>;
}

function mapMetaError(metaError: any) {
  const code = Number(metaError?.error?.code ?? metaError?.code ?? 0);
  const message = String(metaError?.error?.message ?? metaError?.message ?? "Meta API error");
  if (code === 190) return { status: 401, body: { error: "TOKEN_EXPIRED", metaCode: code, message } };
  if (code === 200) return { status: 403, body: { error: "INSUFFICIENT_PERMISSIONS", metaCode: code, message } };
  if (code === 4) {
    const retryAfter = Number(metaError?.headers?.["x-business-use-case-usage"] ?? 60);
    return { status: 429, body: { error: "RATE_LIMIT", retryAfter, metaCode: code, message } };
  }
  return { status: 500, body: { error: "META_API_ERROR", metaCode: code, message } };
}

const LOCAL_META_TOKEN_PATH = resolve(process.cwd(), ".meta-token.local");

async function readMetaAccessToken(): Promise<string | null> {
  if (process.env.META_ACCESS_TOKEN && process.env.META_ACCESS_TOKEN.trim().length > 0) {
    return process.env.META_ACCESS_TOKEN.trim();
  }
  try {
    const fileRaw = await readFile(LOCAL_META_TOKEN_PATH, "utf-8");
    const parsed = JSON.parse(fileRaw) as { accessToken?: string };
    return parsed.accessToken?.trim() || null;
  } catch {
    return null;
  }
}

async function persistMetaAccessToken(token: string): Promise<void> {
  process.env.META_ACCESS_TOKEN = token;
  await writeFile(LOCAL_META_TOKEN_PATH, JSON.stringify({ accessToken: token, updatedAt: new Date().toISOString() }, null, 2), "utf-8");
}

async function clearMetaAccessToken(): Promise<void> {
  process.env.META_ACCESS_TOKEN = "";
  try {
    await unlink(LOCAL_META_TOKEN_PATH);
  } catch {
    // ignore if file does not exist
  }
}

async function exchangeForLongLivedToken(shortToken: string): Promise<{ token: string; expires: Date }> {
  const appId = process.env.META_APP_ID!;
  const appSecret = process.env.META_APP_SECRET!;
  const url = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", shortToken);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Token exchange failed: " + await res.text());
  const data = await res.json() as any;
  const expiresIn = data.expires_in ?? 5184000;
  const expires = new Date(Date.now() + expiresIn * 1000);
  return { token: data.access_token, expires };
}

async function getAgencyAccount() {
  const [account] = await db
    .select()
    .from(socialAccountsTable)
    .where(and(eq(socialAccountsTable.clientId, AGENCY_CLIENT_ID), eq(socialAccountsTable.isActive, true)));
  return account ?? null;
}

async function fetchAllMetaData(token: string) {
  const me = await graphGet("/me", token, { fields: "id,name" });

  const pagesData = await graphGet("/me/accounts", token, {
    fields: "id,name,access_token,instagram_business_account",
  }).catch(() => ({ data: [] }));
  const pages: any[] = (pagesData.data ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    accessToken: p.access_token,
    igUserId: p.instagram_business_account?.id ?? null,
  }));

  const igAccounts: any[] = [];
  for (const page of pages) {
    if (page.igUserId) {
      try {
        const ig = await graphGet(`/${page.igUserId}`, token, {
          fields: "id,username,name,followers_count,media_count,profile_picture_url",
        });
        igAccounts.push({ ...ig, pageId: page.id, pageName: page.name });
      } catch (_) {}
    }
  }

  const adData = await graphGet("/me/adaccounts", token, {
    fields: "id,name,account_status,currency",
  }).catch(() => ({ data: [] }));
  const adAccounts = (adData.data ?? []).map((a: any) => ({ id: a.id, name: a.name, currency: a.currency }));

  return { me, pages, igAccounts, adAccounts };
}

// Generate mock insights for demo mode
function generateMockInsights(range: string, seed = 42) {
  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  const rng = (min: number, max: number, offset = 0) => {
    const s = (seed + offset) % 100;
    return Math.floor(min + (s / 100) * (max - min));
  };

  const labels = Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
  });

  const baseFollowers = rng(5000, 25000);
  const followerData = labels.map((_, i) => baseFollowers + rng(0, 50, i) * i);

  const ig = {
    summary: {
      followers: followerData[followerData.length - 1],
      followerGrowth: rng(120, 800),
      followerGrowthPct: parseFloat((rng(2, 18) / 10).toFixed(1)),
      reach: rng(15000, 80000),
      impressions: rng(30000, 150000),
      engagementRate: parseFloat((rng(15, 65) / 10).toFixed(1)),
      totalEngagements: rng(800, 5000),
      profileViews: rng(2000, 12000),
    },
    followerTrend: { labels, data: followerData },
    stories: { views: rng(3000, 15000), replies: rng(50, 400), exits: rng(200, 1200), completionRate: rng(55, 85) },
    postEngagement: {
      labels: labels.slice(-10),
      likes: labels.slice(-10).map((_, i) => rng(80, 600, i + 10)),
      comments: labels.slice(-10).map((_, i) => rng(5, 80, i + 20)),
      saves: labels.slice(-10).map((_, i) => rng(10, 150, i + 30)),
    },
    topPosts: Array.from({ length: 5 }, (_, i) => ({
      id: `post_${i}`,
      description: [
        "Scopri il nostro nuovo servizio di social media management",
        "Dietro le quinte del nostro team creativo",
        "Risultati straordinari per i nostri clienti",
        "Come ottimizzare la tua strategia digitale",
        "Il futuro del marketing: tendenze 2025",
      ][i],
      date: labels[labels.length - 2 - i * 3] ?? labels[0],
      type: ["Carosello", "Reel", "Foto", "Video", "Reel"][i],
      likes: rng(100, 1200, i),
      comments: rng(10, 150, i + 5),
      saves: rng(20, 300, i + 10),
      reach: rng(2000, 15000, i + 15),
    })),
  };

  const meta = {
    summary: {
      totalSpend: rng(800, 8000),
      roas: parseFloat((rng(28, 68) / 10).toFixed(1)),
      conversions: rng(80, 600),
      conversionValue: rng(3000, 25000),
      ctr: parseFloat((rng(8, 35) / 10).toFixed(2)),
      cpc: parseFloat((rng(3, 25) / 10).toFixed(2)),
      reach: rng(20000, 120000),
      impressions: rng(80000, 400000),
      frequency: parseFloat((rng(12, 35) / 10).toFixed(1)),
    },
    spendTrend: {
      labels,
      spend: labels.map((_, i) => rng(20, 300, i)),
      conversions: labels.map((_, i) => rng(2, 25, i + 50)),
    },
    budgetDistribution: {
      labels: ["Awareness", "Consideration", "Conversion", "Retargeting"],
      data: [25, 30, 35, 10],
      colors: ["#7a8f5c", "#4a6741", "#a4b87a", "#c8d9a0"],
    },
    campaigns: Array.from({ length: 4 }, (_, i) => ({
      id: `cmp_${i}`,
      name: ["Brand Awareness – Q2", "Lead Generation – Sito Web", "Conversioni – E-commerce", "Retargeting – Visitatori"][i],
      status: i < 3 ? "active" : "paused",
      spend: rng(150, 2500, i),
      impressions: rng(10000, 100000, i + 5),
      clicks: rng(300, 5000, i + 10),
      ctr: parseFloat((rng(8, 40) / 10).toFixed(2)),
      cpc: parseFloat((rng(3, 30) / 10).toFixed(2)),
      conversions: rng(10, 200, i + 15),
      roas: parseFloat((rng(25, 70) / 10).toFixed(1)),
    })),
  };

  return { mock: true, instagram: ig, metaAds: meta };
}

// ─── Generic Meta API Routes (token-based) ───────────────────────────────────

router.get("/meta/accounts", async (_req, res): Promise<void> => {
  try {
    const token = await readMetaAccessToken();
    if (!token) {
      res.status(404).json({ error: "TOKEN_MISSING", message: "META_ACCESS_TOKEN non configurato" });
      return;
    }
    const payload = await graphGet("/me/accounts", token, { fields: "id,name,instagram_business_account" });
    const accounts = (payload.data ?? []).map((account: any) => ({
      id: String(account.id),
      name: String(account.name ?? ""),
      instagramBusinessAccountId: account.instagram_business_account?.id ? String(account.instagram_business_account.id) : null,
    }));
    res.json(accounts);
  } catch (error: any) {
    console.error("Meta /accounts error:", error);
    const mapped = mapMetaError(error);
    res.status(mapped.status).json(mapped.body);
  }
});

router.get("/meta/token/status", async (_req, res): Promise<void> => {
  try {
    const token = await readMetaAccessToken();
    if (!token) {
      res.json({ connected: false, tokenExpired: false });
      return;
    }
    try {
      const payload = await graphGet("/me/accounts", token, { fields: "id,name,instagram_business_account", limit: "1" });
      res.json({
        connected: true,
        tokenExpired: false,
        accountsCount: Array.isArray(payload.data) ? payload.data.length : 0,
      });
      return;
    } catch (error: any) {
      const mapped = mapMetaError(error);
      if (mapped.body.error === "TOKEN_EXPIRED") {
        res.json({ connected: false, tokenExpired: true });
        return;
      }
      res.status(mapped.status).json(mapped.body);
      return;
    }
  } catch (error: any) {
    console.error("Meta /token/status error:", error);
    const mapped = mapMetaError(error);
    res.status(mapped.status).json(mapped.body);
  }
});

router.post("/meta/token", async (req, res): Promise<void> => {
  try {
    const accessToken = String(req.body?.accessToken ?? "").trim();
    if (!accessToken) {
      res.status(400).json({ error: "MISSING_ACCESS_TOKEN" });
      return;
    }
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    if (!appId || !appSecret) {
      res.status(500).json({ error: "META_APP_CONFIG_MISSING" });
      return;
    }
    const url = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
    url.searchParams.set("grant_type", "fb_exchange_token");
    url.searchParams.set("client_id", appId);
    url.searchParams.set("client_secret", appSecret);
    url.searchParams.set("fb_exchange_token", accessToken);
    const response = await fetch(url.toString());
    const payload = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      const mapped = mapMetaError(payload);
      res.status(mapped.status).json(mapped.body);
      return;
    }
    const longLivedToken = String(payload.access_token ?? "");
    const expiresIn = Number(payload.expires_in ?? 0);
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    await persistMetaAccessToken(longLivedToken);
    res.json({ success: true, expiresAt });
  } catch (error: any) {
    console.error("Meta /token error:", error);
    const mapped = mapMetaError(error);
    res.status(mapped.status).json(mapped.body);
  }
});

router.post("/meta/token/disconnect", async (_req, res): Promise<void> => {
  try {
    await clearMetaAccessToken();
    res.json({ success: true });
  } catch (error: any) {
    console.error("Meta /token/disconnect error:", error);
    res.status(500).json({ error: "DISCONNECT_ERROR", message: error?.message ?? "Errore disconnessione token" });
  }
});

router.get("/meta/posts/:accountId", async (req, res): Promise<void> => {
  try {
    const token = await readMetaAccessToken();
    if (!token) {
      res.status(404).json({ error: "TOKEN_MISSING", message: "META_ACCESS_TOKEN non configurato" });
      return;
    }
    const accountId = String(req.params.accountId);
    const since = String(req.query.since ?? "");
    const until = String(req.query.until ?? "");
    const limit = String(req.query.limit ?? "20");
    const media = await graphGet(`/${accountId}/media`, token, {
      fields: "id,caption,media_type,timestamp,like_count,comments_count,media_url,thumbnail_url",
      limit,
      ...(since ? { since } : {}),
      ...(until ? { until } : {}),
    });
    const rows = await Promise.all(
      (media.data ?? []).map(async (item: any) => {
        let reach = 0;
        let impressions = 0;
        let engagement = 0;
        try {
          const insight = await graphGet(`/${item.id}/insights`, token, { metric: "impressions,reach,engagement" });
          const lookup = (name: string) => {
            const metric = (insight.data ?? []).find((entry: any) => entry.name === name);
            return Number(metric?.values?.[0]?.value ?? 0);
          };
          reach = lookup("reach");
          impressions = lookup("impressions");
          engagement = lookup("engagement");
        } catch (error: any) {
          console.error("Meta post insight error:", error?.message ?? error);
        }
        const denominator = reach > 0 ? reach : 1;
        const engagementRate = Number((((Number(item.like_count ?? 0) + Number(item.comments_count ?? 0) + engagement) / denominator) * 100).toFixed(2));
        return {
          id: String(item.id),
          caption: String(item.caption ?? ""),
          mediaType: String(item.media_type ?? "IMAGE"),
          timestamp: String(item.timestamp ?? ""),
          likeCount: Number(item.like_count ?? 0),
          commentsCount: Number(item.comments_count ?? 0),
          reach,
          impressions,
          engagementRate,
          thumbnailUrl: item.thumbnail_url ?? item.media_url ?? undefined,
        };
      }),
    );
    res.json(rows);
  } catch (error: any) {
    console.error("Meta /posts error:", error);
    const mapped = mapMetaError(error);
    res.status(mapped.status).json(mapped.body);
  }
});

// ─── Agency-level Routes ─────────────────────────────────────────────────────

// GET /api/meta/agency-status — central agency connection status
router.get("/meta/agency-status", async (_req, res): Promise<void> => {
  const account = await getAgencyAccount();
  if (!account || !account.accessToken) {
    res.json({ connected: false });
    return;
  }
  const isExpired = account.tokenExpiresAt ? account.tokenExpiresAt < new Date() : false;
  const daysLeft = account.tokenExpiresAt ? Math.round((account.tokenExpiresAt.getTime() - Date.now()) / 86400000) : null;
  res.json({
    connected: true,
    tokenExpired: isExpired,
    tokenExpiresAt: account.tokenExpiresAt?.toISOString() ?? null,
    tokenDaysLeft: daysLeft,
    metaUserId: account.metaUserId,
    metaUserName: account.metaUserName,
    pages: account.pages ?? [],
    instagramAccounts: account.instagramAccounts ?? [],
    adAccounts: account.adAccounts ?? [],
    lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
  });
});

// POST /api/meta/connect-agency — connect with access token (agency-level)
router.post("/meta/connect-agency", async (req, res): Promise<void> => {
  const { accessToken } = req.body as { accessToken?: string };
  if (!accessToken || typeof accessToken !== "string" || accessToken.trim().length < 10) {
    res.status(400).json({ error: "Token non valido o mancante" });
    return;
  }
  const shortToken = accessToken.trim();

  try {
    let longToken = shortToken;
    let expiresAt = new Date(Date.now() + 2 * 3600 * 1000);
    try {
      const exchanged = await exchangeForLongLivedToken(shortToken);
      longToken = exchanged.token;
      expiresAt = exchanged.expires;
      console.log(`Meta token exchanged: expires ${expiresAt.toISOString()} (~${Math.round((expiresAt.getTime() - Date.now()) / 86400000)} days)`);
    } catch (exchangeErr: any) {
      console.warn("Token exchange failed, using original token:", exchangeErr.message);
    }

    const { me, pages, igAccounts, adAccounts } = await fetchAllMetaData(longToken);

    const existing = await db
      .select()
      .from(socialAccountsTable)
      .where(eq(socialAccountsTable.clientId, AGENCY_CLIENT_ID));

    const data = {
      accessToken: longToken,
      tokenExpiresAt: expiresAt,
      metaUserId: me.id,
      metaUserName: me.name,
      pages: JSON.parse(JSON.stringify(pages)),
      instagramAccounts: JSON.parse(JSON.stringify(igAccounts)),
      adAccounts: JSON.parse(JSON.stringify(adAccounts)),
      isActive: true,
      lastSyncedAt: new Date(),
    };

    if (existing.length > 0) {
      await db.update(socialAccountsTable).set(data).where(eq(socialAccountsTable.clientId, AGENCY_CLIENT_ID));
    } else {
      await db.insert(socialAccountsTable).values({ clientId: AGENCY_CLIENT_ID, ...data });
    }

    const daysLeft = Math.round((expiresAt.getTime() - Date.now()) / 86400000);
    res.json({
      success: true,
      metaUserId: me.id,
      metaUserName: me.name,
      pagesCount: pages.length,
      igAccountsCount: igAccounts.length,
      adAccountsCount: adAccounts.length,
      tokenExpiresAt: expiresAt.toISOString(),
      tokenDaysLeft: daysLeft,
    });
  } catch (err: any) {
    console.error("Meta connect-agency error:", err);
    const msg = err.message ?? "";
    if (msg.includes("190") || msg.includes("Invalid OAuth")) {
      res.status(401).json({ error: "Token non valido o scaduto. Verifica di aver copiato l'intero token." });
    } else {
      res.status(500).json({ error: "Errore connessione Meta: " + msg });
    }
  }
});

async function autoRenewTokenIfNeeded(account: any): Promise<string> {
  const token = account.accessToken;
  if (!token) throw new Error("No token");

  if (account.tokenExpiresAt) {
    const daysLeft = (account.tokenExpiresAt.getTime() - Date.now()) / 86400000;
    if (daysLeft < 0) throw new Error("Token scaduto. Riconnettiti da Impostazioni > Meta.");
    if (daysLeft < 7) {
      try {
        const { token: newToken, expires } = await exchangeForLongLivedToken(token);
        await db.update(socialAccountsTable)
          .set({ accessToken: newToken, tokenExpiresAt: expires })
          .where(eq(socialAccountsTable.id, account.id));
        console.log(`Meta token auto-renewed: new expiry ${expires.toISOString()} (~${Math.round((expires.getTime() - Date.now()) / 86400000)} days)`);
        return newToken;
      } catch (renewErr: any) {
        console.warn("Auto-renewal failed, using existing token:", renewErr.message);
      }
    }
  }
  return token;
}

// POST /api/meta/refresh-agency — re-fetch all pages/accounts from Meta
router.post("/meta/refresh-agency", async (_req, res): Promise<void> => {
  const account = await getAgencyAccount();
  if (!account || !account.accessToken) {
    res.status(404).json({ error: "Account Meta agenzia non collegato" });
    return;
  }
  try {
    const token = await autoRenewTokenIfNeeded(account);
    const { me, pages, igAccounts, adAccounts } = await fetchAllMetaData(token);
    await db.update(socialAccountsTable)
      .set({
        metaUserId: me.id,
        metaUserName: me.name,
        pages: JSON.parse(JSON.stringify(pages)),
        instagramAccounts: JSON.parse(JSON.stringify(igAccounts)),
        adAccounts: JSON.parse(JSON.stringify(adAccounts)),
        lastSyncedAt: new Date(),
      })
      .where(eq(socialAccountsTable.clientId, AGENCY_CLIENT_ID));

    const daysLeft = account.tokenExpiresAt ? Math.round((account.tokenExpiresAt.getTime() - Date.now()) / 86400000) : null;
    res.json({ success: true, pagesCount: pages.length, igAccountsCount: igAccounts.length, adAccountsCount: adAccounts.length, tokenDaysLeft: daysLeft });
  } catch (err: any) {
    console.error("Meta refresh-agency error:", err);
    if (err.message?.includes("scaduto") || err.message?.includes("190")) {
      res.status(401).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Errore aggiornamento: " + err.message });
    }
  }
});

// POST /api/meta/disconnect-agency
router.post("/meta/disconnect-agency", async (_req, res): Promise<void> => {
  await db.update(socialAccountsTable)
    .set({ isActive: false, accessToken: null })
    .where(eq(socialAccountsTable.clientId, AGENCY_CLIENT_ID));
  res.json({ success: true });
});

// POST /api/meta/assign/:clientId — assign FB page, IG account, Ad account to a client
router.post("/meta/assign/:clientId", async (req, res): Promise<void> => {
  const clientId = Number(req.params.clientId);
  if (isNaN(clientId)) { res.status(400).json({ error: "clientId non valido" }); return; }

  const { metaPageId, metaIgAccountId, metaAdAccountId } = req.body as {
    metaPageId?: string | null;
    metaIgAccountId?: string | null;
    metaAdAccountId?: string | null;
  };

  await db.update(clientsTable)
    .set({
      metaPageId: metaPageId ?? null,
      metaIgAccountId: metaIgAccountId ?? null,
      metaAdAccountId: metaAdAccountId ?? null,
    })
    .where(eq(clientsTable.id, clientId));

  res.json({ success: true });
});

// ─── Per-client Routes (use agency token) ────────────────────────────────────

// GET /api/meta/status/:clientId — client's assigned accounts + agency connection info
router.get("/meta/status/:clientId", async (req, res): Promise<void> => {
  const clientId = Number(req.params.clientId);
  if (isNaN(clientId)) { res.status(400).json({ error: "clientId non valido" }); return; }

  const agencyAccount = await getAgencyAccount();
  if (!agencyAccount || !agencyAccount.accessToken) {
    res.json({ connected: false, reason: "agency_not_connected" });
    return;
  }

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
  if (!client) { res.status(404).json({ error: "Cliente non trovato" }); return; }

  const allPages = (agencyAccount.pages as any[]) ?? [];
  const allIg = (agencyAccount.instagramAccounts as any[]) ?? [];
  const allAds = (agencyAccount.adAccounts as any[]) ?? [];

  const assignedPage = client.metaPageId ? allPages.find((p: any) => p.id === client.metaPageId) : null;
  const assignedIg = client.metaIgAccountId ? allIg.find((ig: any) => ig.id === client.metaIgAccountId) : null;
  const assignedAd = client.metaAdAccountId ? allAds.find((ad: any) => ad.id === client.metaAdAccountId) : null;

  const isExpired = agencyAccount.tokenExpiresAt ? agencyAccount.tokenExpiresAt < new Date() : false;

  res.json({
    connected: true,
    tokenExpired: isExpired,
    metaUserName: agencyAccount.metaUserName,
    lastSyncedAt: agencyAccount.lastSyncedAt?.toISOString() ?? null,
    assignedPage: assignedPage ?? null,
    assignedIg: assignedIg ?? null,
    assignedAd: assignedAd ?? null,
    allPages,
    allIgAccounts: allIg,
    allAdAccounts: allAds,
  });
});

router.get("/meta/debug-permissions/:clientId", async (req, res): Promise<void> => {
  const clientId = Number(req.params.clientId);
  const agencyAccount = await getAgencyAccount();
  if (!agencyAccount || !agencyAccount.accessToken) { res.status(404).json({ error: "No agency account" }); return; }

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
  if (!client) { res.status(404).json({ error: "Client not found" }); return; }

  const token = agencyAccount.accessToken;
  const allPages = (agencyAccount.pages as any[]) ?? [];
  const allIg = (agencyAccount.instagramAccounts as any[]) ?? [];
  const allAds = (agencyAccount.adAccounts as any[]) ?? [];

  const assignedPage = client.metaPageId ? allPages.find((p: any) => p.id === client.metaPageId) : null;
  const assignedIg = client.metaIgAccountId ? allIg.find((ig: any) => ig.id === client.metaIgAccountId) : null;
  const assignedAd = client.metaAdAccountId ? allAds.find((ad: any) => ad.id === client.metaAdAccountId) : null;
  const pageToken = assignedPage?.accessToken ?? token;

  const results: any = {
    assignments: { page: assignedPage?.id ?? null, ig: assignedIg?.id ?? null, ad: assignedAd?.id ?? null },
    tokenType: assignedPage?.accessToken ? "page_token" : "user_token",
    tests: {},
  };

  const until = Math.floor(Date.now() / 1000);
  const since = until - 7 * 24 * 3600;

  if (assignedIg) {
    try {
      const profile = await graphGet(`/${assignedIg.id}`, pageToken, { fields: "id,username,followers_count,media_count" });
      results.tests.ig_profile = { ok: true, data: profile };
    } catch (e: any) { results.tests.ig_profile = { ok: false, error: e.message }; }

    try {
      const insights = await graphGet(`/${assignedIg.id}/insights`, pageToken, { metric: "reach,follower_count", period: "day", since: String(since), until: String(until) });
      results.tests.ig_insights = { ok: true, metricsCount: insights.data?.length ?? 0, metricNames: (insights.data ?? []).map((m: any) => m.name) };
    } catch (e: any) { results.tests.ig_insights = { ok: false, error: e.message }; }

    try {
      const media = await graphGet(`/${assignedIg.id}/media`, pageToken, { fields: "id,caption,timestamp,like_count,comments_count", limit: "3" });
      results.tests.ig_media = { ok: true, count: media.data?.length ?? 0 };
    } catch (e: any) { results.tests.ig_media = { ok: false, error: e.message }; }
  }

  if (assignedPage) {
    try {
      const feed = await graphGet(`/${assignedPage.id}/feed`, pageToken, { fields: "id,message,created_time", limit: "3" });
      results.tests.fb_feed = { ok: true, count: feed.data?.length ?? 0 };
    } catch (e: any) { results.tests.fb_feed = { ok: false, error: e.message }; }

    try {
      const pageInsights = await graphGet(`/${assignedPage.id}/insights`, pageToken, { metric: "page_impressions,page_post_engagements", period: "day", since: String(since), until: String(until) });
      results.tests.fb_page_insights = { ok: true, metricsCount: pageInsights.data?.length ?? 0 };
    } catch (e: any) { results.tests.fb_page_insights = { ok: false, error: e.message }; }
  }

  if (assignedAd) {
    try {
      const adInsights = await graphGet(`/${assignedAd.id}/insights`, token, { fields: "spend,impressions,reach,ctr,cpc,cpm,actions", date_preset: "last_7d" });
      results.tests.ads_insights = { ok: true, hasData: (adInsights.data?.length ?? 0) > 0 };
    } catch (e: any) { results.tests.ads_insights = { ok: false, error: e.message }; }
  }

  try {
    const perms = await graphGet("/me/permissions", token, {});
    results.permissions = (perms.data ?? []).map((p: any) => ({ name: p.permission, status: p.status }));
  } catch (e: any) { results.permissions = { error: e.message }; }

  res.json(results);
});

// POST /api/meta/sync/:clientId — sync insights using agency token for client's assigned accounts
router.post("/meta/sync/:clientId", async (req, res): Promise<void> => {
  const clientId = Number(req.params.clientId);
  if (isNaN(clientId)) { res.status(400).json({ error: "clientId non valido" }); return; }

  const agencyAccount = await getAgencyAccount();
  if (!agencyAccount || !agencyAccount.accessToken) {
    res.status(404).json({ error: "Account Meta agenzia non collegato" });
    return;
  }

  let token: string;
  try {
    token = await autoRenewTokenIfNeeded(agencyAccount);
  } catch (err: any) {
    res.status(401).json({ error: err.message, tokenExpired: true });
    return;
  }

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
  if (!client) { res.status(404).json({ error: "Cliente non trovato" }); return; }
  const allPages = (agencyAccount.pages as any[]) ?? [];
  const allIg = (agencyAccount.instagramAccounts as any[]) ?? [];
  const allAds = (agencyAccount.adAccounts as any[]) ?? [];

  const assignedPage = client.metaPageId ? allPages.find((p: any) => p.id === client.metaPageId) : null;
  const assignedIg = client.metaIgAccountId ? allIg.find((ig: any) => ig.id === client.metaIgAccountId) : null;
  const assignedAd = client.metaAdAccountId ? allAds.find((ad: any) => ad.id === client.metaAdAccountId) : null;

  try {
    const sinceParam = req.query.since as string | undefined;
    const untilParam = req.query.until as string | undefined;
    let until: number;
    let since: number;
    if (sinceParam && untilParam) {
      since = Math.floor(new Date(sinceParam).getTime() / 1000);
      until = Math.floor(new Date(untilParam).getTime() / 1000);
    } else {
      until = Math.floor(Date.now() / 1000);
      since = until - 30 * 24 * 3600;
    }

    const pageToken = assignedPage?.accessToken ?? token;

    let igInsights = null;
    if (assignedIg) {
      const igProfile = await graphGet(`/${assignedIg.id}`, pageToken, {
        fields: "id,username,name,followers_count,media_count,profile_picture_url,biography",
      }).catch((e) => { console.error("IG profile fetch error:", e.message); return null; });

      const igData = await graphGet(`/${assignedIg.id}/insights`, pageToken, {
        metric: "reach,follower_count",
        period: "day", since: String(since), until: String(until),
      }).catch((e) => { console.error("IG insights fetch error:", e.message); return null; });

      const mediaData = await graphGet(`/${assignedIg.id}/media`, pageToken, {
        fields: "id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count,permalink",
        limit: "25",
      }).catch((e) => { console.error("IG media fetch error:", e.message); return { data: [] }; });

      let mediaList: any[] = mediaData.data ?? [];

      if (mediaList.length === 0 && assignedPage) {
        console.log("Trying FB page feed as fallback for media...");
        const fbFeed = await graphGet(`/${assignedPage.id}/feed`, assignedPage.accessToken ?? token, {
          fields: "id,message,created_time,type,full_picture,permalink_url,shares,likes.summary(true),comments.summary(true),reactions.summary(true)",
          limit: "25",
        }).catch((e) => { console.error("FB feed fallback error:", e.message); return { data: [] }; });

        mediaList = (fbFeed.data ?? []).map((p: any) => ({
          id: p.id,
          caption: p.message ?? "",
          media_type: p.type === "video" ? "VIDEO" : p.type === "photo" ? "IMAGE" : "IMAGE",
          timestamp: p.created_time,
          like_count: p.likes?.summary?.total_count ?? p.reactions?.summary?.total_count ?? 0,
          comments_count: p.comments?.summary?.total_count ?? 0,
          permalink: p.permalink_url,
          full_picture: p.full_picture,
          shares_count: p.shares?.count ?? 0,
          source: "facebook",
        }));
      }

      let mediaWithInsights = mediaList;
      if (mediaList.length > 0 && !mediaList[0]?.source) {
        mediaWithInsights = await Promise.all(mediaList.map(async (m: any) => {
          try {
            const mi = await graphGet(`/${m.id}/insights`, pageToken, {
              metric: "impressions,reach,saved,engagement",
            });
            const getVal = (name: string) => {
              const found = (mi.data ?? []).find((d: any) => d.name === name);
              return found?.values?.[0]?.value ?? 0;
            };
            return { ...m, insights_reach: getVal("reach"), insights_impressions: getVal("impressions"), insights_saved: getVal("saved"), insights_engagement: getVal("engagement") };
          } catch { return m; }
        }));
      }

      igInsights = { raw: igData, media: mediaWithInsights, profile: igProfile };
    }

    let adsInsights = null;
    if (assignedAd) {
      const adId = assignedAd.id.replace("act_", "");
      const campaignsData = await graphGet(`/act_${adId}/campaigns`, token, {
        fields: "id,name,status,objective", limit: "20",
      }).catch(() => ({ data: [] }));
      const adTimeRange: Record<string, string> = sinceParam && untilParam
        ? { time_range: JSON.stringify({ since: sinceParam, until: untilParam }) }
        : { date_preset: "last_30d" };
      const insightsData = await graphGet(`/act_${adId}/insights`, token, {
        fields: "spend,impressions,reach,clicks,ctr,cpm,cpc,actions,action_values,frequency",
        ...adTimeRange,
      }).catch(() => ({ data: [] }));
      adsInsights = { campaigns: campaignsData.data ?? [], insights: insightsData.data ?? [] };
    }

    let fbInsights = null;
    if (assignedPage) {
      const fbData = await graphGet(`/${assignedPage.id}/insights`, pageToken, {
        metric: "page_impressions,page_post_engagements,page_fan_adds",
        period: "day", since: String(since), until: String(until),
      }).catch((e) => {
        console.error("FB insights fetch error:", e.message);
        return null;
      });
      if (!fbData) {
        const fbBasic = await graphGet(`/${assignedPage.id}`, pageToken, {
          fields: "id,name,fan_count,followers_count,talking_about_count",
        }).catch(() => null);
        if (fbBasic) fbInsights = { profile: fbBasic };
      } else {
        fbInsights = fbData;
      }
    }

    const existing = await db.select().from(socialAccountsTable).where(eq(socialAccountsTable.clientId, clientId));
    const insightsData = {
      instagramInsights: igInsights ? JSON.parse(JSON.stringify(igInsights)) : undefined,
      metaAdsInsights: adsInsights ? JSON.parse(JSON.stringify(adsInsights)) : undefined,
      facebookInsights: fbInsights ? JSON.parse(JSON.stringify(fbInsights)) : undefined,
      lastSyncedAt: new Date(),
    };

    if (existing.length > 0) {
      await db.update(socialAccountsTable).set(insightsData).where(eq(socialAccountsTable.clientId, clientId));
    } else {
      await db.insert(socialAccountsTable).values({
        clientId,
        ...insightsData,
        isActive: true,
      });
    }

    res.json({
      success: true,
      synced: { instagram: !!igInsights, ads: !!adsInsights, facebook: !!fbInsights },
      details: {
        igProfile: !!igInsights?.profile,
        igInsightsRaw: !!igInsights?.raw,
        igMediaCount: igInsights?.media?.length ?? 0,
      },
    });
  } catch (err: any) {
    console.error("Meta sync error:", err);
    res.status(500).json({ error: "Errore durante la sincronizzazione: " + err.message });
  }
});

// Legacy disconnect per client (keeps for backward compat)
router.post("/meta/disconnect/:clientId", async (req, res): Promise<void> => {
  const clientId = Number(req.params.clientId);
  if (isNaN(clientId)) { res.status(400).json({ error: "clientId non valido" }); return; }
  await db.update(clientsTable)
    .set({ metaPageId: null, metaIgAccountId: null, metaAdAccountId: null })
    .where(eq(clientsTable.id, clientId));
  res.json({ success: true });
});

// Legacy connect-token per client — now redirects to agency connect
router.post("/meta/connect-token/:clientId", async (req, res): Promise<void> => {
  res.status(400).json({ error: "Usa Impostazioni per collegare l'account Meta dell'agenzia" });
});

// ─── Real data transformers ───────────────────────────────────────────────────

function transformIgInsights(rawInsights: any, igAccounts: any[], range: string, sinceTs?: number, untilTs?: number) {
  const defaultDays = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  const rawData: any[] = rawInsights?.raw?.data ?? [];
  let media: any[] = rawInsights?.media ?? [];
  const profile: any = rawInsights?.profile ?? null;

  if (sinceTs && untilTs) {
    const sinceMs = sinceTs * 1000;
    const untilMs = untilTs * 1000;
    media = media.filter((m: any) => {
      if (!m.timestamp) return false;
      const ts = new Date(m.timestamp).getTime();
      return ts >= sinceMs && ts <= untilMs;
    });
  }

  const igAccountFromPool = (igAccounts as any[])?.[0] ?? null;
  const profileFollowers = profile?.followers_count ?? igAccountFromPool?.followers_count ?? 0;

  function getMetricValues(name: string): number[] {
    const m = rawData.find((d: any) => d.name === name);
    if (!m) return [];
    return (m.values ?? []).map((v: any) => Number(v.value) || 0);
  }

  const rawReach = getMetricValues("reach");
  const rawFollowerDelta = getMetricValues("follower_count");
  const days = Math.max(rawReach.length, rawFollowerDelta.length, defaultDays);
  const reachValues = rawReach.slice(-days);
  const followerDeltaValues = rawFollowerDelta.slice(-days);

  const hasRawInsights = reachValues.length > 0 || followerDeltaValues.length > 0;

  const totalReach = reachValues.reduce((a, b) => a + b, 0);
  const totalImpressions = totalReach;
  const totalProfileViews = 0;

  const totalGrowth = followerDeltaValues.reduce((a, b) => a + b, 0);
  const currentFollowers = profileFollowers;

  let followerValues: number[] = [];
  if (followerDeltaValues.length > 0 && currentFollowers > 0) {
    followerValues = new Array(followerDeltaValues.length);
    followerValues[followerDeltaValues.length - 1] = currentFollowers;
    for (let i = followerDeltaValues.length - 2; i >= 0; i--) {
      followerValues[i] = followerValues[i + 1] - (followerDeltaValues[i + 1] || 0);
    }
  }

  const firstFollowers = followerValues.length > 0 ? followerValues[0] : currentFollowers;
  const followerGrowth = totalGrowth;
  const followerGrowthPct = firstFollowers > 0 ? parseFloat(((followerGrowth / firstFollowers) * 100).toFixed(1)) : 0;

  const totalLikes = media.reduce((a: number, m: any) => a + (Number(m.like_count) || 0), 0);
  const totalComments = media.reduce((a: number, m: any) => a + (Number(m.comments_count) || 0), 0);
  const totalSaves = media.reduce((a: number, m: any) => a + (Number(m.insights_saved) || 0), 0);
  const totalMediaReach = media.reduce((a: number, m: any) => a + (Number(m.insights_reach) || 0), 0);
  const totalEngagements = totalLikes + totalComments + totalSaves;
  const engagementRate = currentFollowers > 0 && media.length > 0
    ? parseFloat(((totalEngagements / (media.length * currentFollowers)) * 100).toFixed(2))
    : 0;

  let trendLabels: string[];
  let trendData: number[];

  if (followerValues.length > 0) {
    const labelCount = Math.min(followerValues.length, days);
    trendLabels = Array.from({ length: labelCount }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (labelCount - 1 - i));
      return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
    });
    trendData = followerValues.slice(-labelCount);
  } else {
    trendLabels = Array.from({ length: days }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (days - 1 - i));
      return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
    });
    trendData = trendLabels.map(() => currentFollowers);
  }

  function mapPost(m: any) {
    return {
      id: m.id,
      caption: m.caption ?? "",
      description: m.caption ? m.caption.slice(0, 120) : "(nessuna caption)",
      date: m.timestamp ? new Date(m.timestamp).toLocaleDateString("it-IT") : "",
      likes: Number(m.like_count) || 0,
      comments: Number(m.comments_count) || 0,
      saves: Number(m.insights_saved) || 0,
      reach: Number(m.insights_reach) || 0,
      impressions: Number(m.insights_impressions) || 0,
      shares: Number(m.shares_count) || 0,
      follows: Number(m.insights_follows) || 0,
      engagement: (Number(m.like_count) || 0) + (Number(m.comments_count) || 0) + (Number(m.insights_saved) || 0),
      type: m.media_type === "VIDEO" ? "Reel" : m.media_type === "CAROUSEL_ALBUM" ? "Carosello" : "Foto",
      mediaType: m.media_type ?? "IMAGE",
      mediaUrl: m.media_url ?? null,
      thumbnailUrl: m.thumbnail_url ?? null,
      permalink: m.permalink ?? null,
    };
  }

  const sortedByEng = [...media].sort((a, b) => {
    const engA = (Number(a.like_count) || 0) + (Number(a.comments_count) || 0) + (Number(a.insights_saved) || 0);
    const engB = (Number(b.like_count) || 0) + (Number(b.comments_count) || 0) + (Number(b.insights_saved) || 0);
    return engB - engA;
  });

  const topByEngagement = sortedByEng.length > 0 ? mapPost(sortedByEng[0]) : null;
  const topBySaves = [...media].sort((a, b) => (Number(b.insights_saved) || 0) - (Number(a.insights_saved) || 0));
  const topBySavesPost = topBySaves.length > 0 && (Number(topBySaves[0].insights_saved) || 0) > 0 ? mapPost(topBySaves[0]) : null;
  const topByReach = [...media].sort((a, b) => (Number(b.insights_reach) || 0) - (Number(a.insights_reach) || 0));
  const topByReachPost = topByReach.length > 0 && (Number(topByReach[0].insights_reach) || 0) > 0 ? mapPost(topByReach[0]) : null;

  const topPosts = sortedByEng.slice(0, 5).map(mapPost);

  const featuredPosts = [
    topByEngagement ? { ...topByEngagement, award: "Piu interazioni" } : null,
    topByReachPost ? { ...topByReachPost, award: "Maggior copertura" } : null,
    topBySavesPost ? { ...topBySavesPost, award: "Piu salvataggi" } : null,
  ].filter(Boolean);

  const uniqueFeatured = featuredPosts.filter((p, i, arr) => arr.findIndex(x => x!.id === p!.id) === i);

  const chronoMedia = [...media]
    .filter((m: any) => m.timestamp)
    .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(-15);

  const postEngagement = {
    labels: chronoMedia.map((m: any) =>
      new Date(m.timestamp).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })
    ),
    likes: chronoMedia.map((m: any) => Number(m.like_count) || 0),
    comments: chronoMedia.map((m: any) => Number(m.comments_count) || 0),
    saves: chronoMedia.map((m: any) => Number(m.insights_saved) || 0),
  };

  return {
    mock: false,
    instagram: {
      summary: {
        followers: currentFollowers,
        followerGrowth,
        followerGrowthPct,
        reach: totalReach || totalMediaReach,
        impressions: totalImpressions,
        engagementRate,
        totalEngagements,
        profileViews: totalProfileViews,
        mediaCount: profile?.media_count ?? media.length,
        username: profile?.username ?? igAccountFromPool?.username ?? null,
      },
      followerTrend: { labels: trendLabels, data: trendData },
      stories: { views: 0, replies: 0, exits: 0, completionRate: 0 },
      postEngagement,
      topPosts,
      featuredPosts: uniqueFeatured,
    },
    metaAds: null,
  };
}

function transformAdsInsights(rawAds: any, range: string) {
  const campaigns: any[] = rawAds?.campaigns ?? [];
  const insightsArr: any[] = rawAds?.insights ?? [];
  const insight = insightsArr[0] ?? {};

  const totalSpend = parseFloat(insight.spend ?? "0");
  const impressions = parseInt(insight.impressions ?? "0");
  const reach = parseInt(insight.reach ?? "0");
  const clicks = parseInt(insight.clicks ?? "0");
  const ctr = parseFloat(insight.ctr ?? "0");
  const cpc = parseFloat(insight.cpc ?? "0");
  const cpm = parseFloat(insight.cpm ?? "0");
  const frequency = parseFloat(insight.frequency ?? "0");

  const actions: any[] = insight.actions ?? [];
  const actionValues: any[] = insight.action_values ?? [];

  const conversionTypes = ["purchase", "offsite_conversion.fb_pixel_purchase", "lead", "complete_registration", "offsite_conversion.fb_pixel_lead"];
  const linkClicks = actions.find((a: any) => a.action_type === "link_click");
  const conversionAction = actions.find((a: any) => conversionTypes.includes(a.action_type));
  const conversions = conversionAction ? parseInt(conversionAction.value ?? "0") : (linkClicks ? parseInt(linkClicks.value ?? "0") : 0);

  const purchaseValue = actionValues.find((a: any) => conversionTypes.includes(a.action_type));
  const conversionValue = purchaseValue ? parseFloat(purchaseValue.value ?? "0") : 0;
  const roas = totalSpend > 0 && conversionValue > 0 ? parseFloat((conversionValue / totalSpend).toFixed(2)) : 0;

  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  const labels = Array.from({ length: days }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (days - 1 - i));
    return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
  });

  const linkClickCount = linkClicks ? parseInt(linkClicks.value ?? "0") : 0;
  const videoViews = actions.find((a: any) => a.action_type === "video_view");
  const videoViewCount = videoViews ? parseInt(videoViews.value ?? "0") : 0;
  const postEngagements = actions.find((a: any) => a.action_type === "post_engagement");
  const postEngagementCount = postEngagements ? parseInt(postEngagements.value ?? "0") : 0;

  const followAction = actions.find((a: any) => a.action_type === "follow" || a.action_type === "like");
  const pageEngagement = actions.find((a: any) => a.action_type === "page_engagement");
  const newFollowersFromAds = followAction ? parseInt(followAction.value ?? "0") : 0;
  const costPerNewFollower = newFollowersFromAds > 0 && totalSpend > 0
    ? parseFloat((totalSpend / newFollowersFromAds).toFixed(2)) : 0;

  return {
    summary: {
      totalSpend, roas, conversions, conversionValue, ctr, cpc, cpm, reach, impressions, frequency,
      linkClicks: linkClickCount, videoViews: videoViewCount, postEngagements: postEngagementCount,
      newFollowers: newFollowersFromAds, costPerFollower: costPerNewFollower,
    },
    spendTrend: { labels, spend: labels.map(() => Math.round(totalSpend / days)), conversions: labels.map(() => Math.round(conversions / days)) },
    campaigns: campaigns.map((c: any) => ({ id: c.id, name: c.name, status: c.status?.toLowerCase() ?? "unknown", objective: c.objective })),
  };
}

async function autoSyncClient(clientId: number, agencyAccount: any): Promise<void> {
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
  if (!client) return;

  const token = agencyAccount.accessToken;
  const allPages = (agencyAccount.pages as any[]) ?? [];
  const allIg = (agencyAccount.instagramAccounts as any[]) ?? [];
  const allAds = (agencyAccount.adAccounts as any[]) ?? [];

  const assignedPage = client.metaPageId ? allPages.find((p: any) => p.id === client.metaPageId) : null;
  const assignedIg = client.metaIgAccountId ? allIg.find((ig: any) => ig.id === client.metaIgAccountId) : null;
  const assignedAd = client.metaAdAccountId ? allAds.find((ad: any) => ad.id === client.metaAdAccountId) : null;

  if (!assignedIg && !assignedAd && !assignedPage) return;

  const until = Math.floor(Date.now() / 1000);
  const since = until - 30 * 24 * 3600;
  const pageToken = assignedPage?.accessToken ?? token;

  let igInsights = null;
  if (assignedIg) {
    const igProfile = await graphGet(`/${assignedIg.id}`, pageToken, {
      fields: "id,username,name,followers_count,media_count,profile_picture_url",
    }).catch(() => null);
    const igData = await graphGet(`/${assignedIg.id}/insights`, pageToken, {
      metric: "reach,follower_count", period: "day", since: String(since), until: String(until),
    }).catch(() => null);
    const mediaData = await graphGet(`/${assignedIg.id}/media`, pageToken, {
      fields: "id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count,permalink", limit: "25",
    }).catch(() => ({ data: [] }));

    let mediaList: any[] = mediaData.data ?? [];

    if (mediaList.length === 0 && assignedPage) {
      const fbFeed = await graphGet(`/${assignedPage.id}/feed`, assignedPage.accessToken ?? token, {
        fields: "id,message,created_time,type,full_picture,permalink_url,shares,likes.summary(true),comments.summary(true),reactions.summary(true)",
        limit: "25",
      }).catch(() => ({ data: [] }));

      mediaList = (fbFeed.data ?? []).map((p: any) => ({
        id: p.id, caption: p.message ?? "", media_type: p.type === "video" ? "VIDEO" : "IMAGE",
        timestamp: p.created_time, like_count: p.likes?.summary?.total_count ?? p.reactions?.summary?.total_count ?? 0,
        comments_count: p.comments?.summary?.total_count ?? 0, permalink: p.permalink_url,
        shares_count: p.shares?.count ?? 0, source: "facebook",
      }));
    }

    let mediaWithInsights = mediaList;
    if (mediaList.length > 0 && !mediaList[0]?.source) {
      mediaWithInsights = await Promise.all(mediaList.map(async (m: any) => {
        try {
          const mi = await graphGet(`/${m.id}/insights`, pageToken, { metric: "impressions,reach,saved,engagement" });
          const getVal = (name: string) => { const f = (mi.data ?? []).find((d: any) => d.name === name); return f?.values?.[0]?.value ?? 0; };
          return { ...m, insights_reach: getVal("reach"), insights_impressions: getVal("impressions"), insights_saved: getVal("saved"), insights_engagement: getVal("engagement") };
        } catch { return m; }
      }));
    }

    igInsights = { raw: igData, media: mediaWithInsights, profile: igProfile };
  }

  let adsInsights = null;
  if (assignedAd) {
    const adId = assignedAd.id.replace("act_", "");
    const campaignsData = await graphGet(`/act_${adId}/campaigns`, token, {
      fields: "id,name,status,objective", limit: "20",
    }).catch(() => ({ data: [] }));
    const insightsData = await graphGet(`/act_${adId}/insights`, token, {
      fields: "spend,impressions,reach,clicks,ctr,cpm,cpc,actions,action_values,frequency",
      date_preset: "last_30d",
    }).catch(() => ({ data: [] }));
    adsInsights = { campaigns: campaignsData.data ?? [], insights: insightsData.data ?? [] };
  }

  let fbInsights = null;
  if (assignedPage) {
    const fbData = await graphGet(`/${assignedPage.id}/insights`, pageToken, {
      metric: "page_impressions,page_post_engagements,page_fan_adds",
      period: "day", since: String(since), until: String(until),
    }).catch(() => null);
    if (!fbData) {
      const fbBasic = await graphGet(`/${assignedPage.id}`, pageToken, {
        fields: "id,name,fan_count,followers_count,talking_about_count",
      }).catch(() => null);
      if (fbBasic) fbInsights = { profile: fbBasic };
    } else {
      fbInsights = fbData;
    }
  }

  const existing = await db.select().from(socialAccountsTable).where(eq(socialAccountsTable.clientId, clientId));
  const data: any = { lastSyncedAt: new Date() };
  if (igInsights) data.instagramInsights = JSON.parse(JSON.stringify(igInsights));
  if (adsInsights) data.metaAdsInsights = JSON.parse(JSON.stringify(adsInsights));
  if (fbInsights) data.facebookInsights = JSON.parse(JSON.stringify(fbInsights));

  if (existing.length > 0) {
    await db.update(socialAccountsTable).set(data).where(eq(socialAccountsTable.clientId, clientId));
  } else {
    await db.insert(socialAccountsTable).values({ clientId, ...data, isActive: true });
  }
}

// GET /api/meta/insights/:clientId
router.get("/meta/insights/:clientId", async (req, res): Promise<void> => {
  const rawTargetId = String(req.params.clientId);
  const clientId = Number(rawTargetId);
  if (Number.isNaN(clientId)) {
    try {
      const token = await readMetaAccessToken();
      if (!token) {
        res.status(404).json({ error: "TOKEN_MISSING", message: "META_ACCESS_TOKEN non configurato" });
        return;
      }
      const period = (req.query.period as "day" | "week" | "month" | undefined) ?? "day";
      const since = String(req.query.since ?? "");
      const until = String(req.query.until ?? "");
      const payload = await graphGet(`/${rawTargetId}/insights`, token, {
        metric: "impressions,reach,follower_count,profile_views,engagement",
        period,
        ...(since ? { since } : {}),
        ...(until ? { until } : {}),
      });
      const byDate = new Map<string, { date: string; impressions: number; reach: number; followerCount: number; profileViews: number; engagement: number }>();
      for (const metric of payload.data ?? []) {
        for (const item of metric.values ?? []) {
          const date = String(item.end_time ?? item.value?.date ?? new Date().toISOString()).slice(0, 10);
          const current = byDate.get(date) ?? {
            date,
            impressions: 0,
            reach: 0,
            followerCount: 0,
            profileViews: 0,
            engagement: 0,
          };
          const numeric = Number(item.value ?? 0);
          if (metric.name === "impressions") current.impressions = numeric;
          if (metric.name === "reach") current.reach = numeric;
          if (metric.name === "follower_count") current.followerCount = numeric;
          if (metric.name === "profile_views") current.profileViews = numeric;
          if (metric.name === "engagement") current.engagement = numeric;
          byDate.set(date, current);
        }
      }
      res.json(Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date)));
      return;
    } catch (error: any) {
      console.error("Meta account insights error:", error);
      const mapped = mapMetaError(error);
      res.status(mapped.status).json(mapped.body);
      return;
    }
  }

  const range = (req.query.range as string) ?? "30d";
  const autoSync = req.query.sync !== "false";
  const sinceParam = req.query.since as string | undefined;
  const untilParam = req.query.until as string | undefined;
  let sinceTsForFilter: number | undefined;
  let untilTsForFilter: number | undefined;
  if (sinceParam && untilParam) {
    sinceTsForFilter = Math.floor(new Date(sinceParam).getTime() / 1000);
    untilTsForFilter = Math.floor(new Date(untilParam).getTime() / 1000);
  }

  const agencyAccount = await getAgencyAccount();
  if (!agencyAccount?.accessToken) {
    res.json(generateMockInsights(range, clientId));
    return;
  }

  if (agencyAccount.tokenExpiresAt && agencyAccount.tokenExpiresAt < new Date()) {
    res.json(generateMockInsights(range, clientId));
    return;
  }

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
  const hasAssignments = client?.metaPageId || client?.metaIgAccountId || client?.metaAdAccountId;

  if (!hasAssignments) {
    res.json(generateMockInsights(range, clientId));
    return;
  }

  let [clientAccount] = await db.select().from(socialAccountsTable)
    .where(and(eq(socialAccountsTable.clientId, clientId), eq(socialAccountsTable.isActive, true)));

  const needsSync = autoSync && (!clientAccount?.lastSyncedAt ||
    (Date.now() - new Date(clientAccount.lastSyncedAt).getTime()) > 10 * 60 * 1000);

  if (needsSync) {
    try {
      await autoSyncClient(clientId, agencyAccount);
      const [refreshed] = await db.select().from(socialAccountsTable)
        .where(and(eq(socialAccountsTable.clientId, clientId), eq(socialAccountsTable.isActive, true)));
      if (refreshed) clientAccount = refreshed;
    } catch (err: any) {
      console.error("Auto-sync error for client", clientId, err.message);
    }
  }

  const hasRealData = clientAccount?.instagramInsights || clientAccount?.metaAdsInsights;
  if (!hasRealData) {
    res.json(generateMockInsights(range, clientId));
    return;
  }

  const allIg = (agencyAccount.instagramAccounts as any[]) ?? [];
  const result: any = { mock: false };

  if (clientAccount?.instagramInsights) {
    const transformed = transformIgInsights(clientAccount.instagramInsights, allIg, range, sinceTsForFilter, untilTsForFilter);
    result.instagram = transformed.instagram;
  }

  if (clientAccount?.metaAdsInsights) {
    const transformed = transformAdsInsights(clientAccount.metaAdsInsights, range);
    result.metaAds = transformed;
  }

  if (!result.instagram && !result.metaAds) {
    res.json(generateMockInsights(range, clientId));
    return;
  }

  res.json(result);
});

router.get("/meta/media-proxy", async (req, res): Promise<void> => {
  const url = req.query.url as string;
  if (!url) { res.status(400).json({ error: "Missing url parameter" }); return; }
  try {
    const response = await fetch(url);
    if (!response.ok) { res.status(response.status).end(); return; }
    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Access-Control-Allow-Origin", "*");
    const buffer = Buffer.from(await response.arrayBuffer());
    res.end(buffer);
  } catch {
    res.status(502).json({ error: "Failed to proxy media" });
  }
});

export default router;
