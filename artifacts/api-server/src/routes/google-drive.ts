import { Router, type IRouter, type Request } from "express";
import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, socialAccountsTable, clientsTable } from "@workspace/db";
import { encrypt, decrypt, isEncrypted } from "../lib/encrypt";
import { getUserId, getAccessibleClientIds } from "../lib/access-control";
import { logger } from "../lib/logger";

/**
 * Integrazione Google Drive (Livello 2): l'agenzia collega UN account Google
 * con scope drive.file. Da ogni scheda cliente si può creare in un click una
 * sottocartella dentro una "root agenzia" e listare i file. Stesso pattern di
 * Meta: token criptato in DB (socialAccountsTable con provider='google_drive',
 * clientId=0), refresh automatico quando scaduto.
 */

const router: IRouter = Router();
const AGENCY_CLIENT_ID = 0;
const GOOGLE_PROVIDER = "google_drive";

const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

function publicAppBase(req: Request): string {
  return (process.env.PORTAL_PUBLIC_URL ?? "").replace(/\/+$/, "") || `https://${req.get("host")}`;
}

function oauthRedirectUri(req: Request): string {
  return `${publicAppBase(req)}/api/google/oauth/callback`;
}

function oauthStateSecret(): string {
  return process.env.CRON_SECRET || process.env.TOKEN_ENCRYPTION_KEY || "bekind-google-oauth";
}

function signState(): string {
  const ts = Date.now().toString(36);
  const nonce = crypto.randomBytes(8).toString("hex");
  const sig = crypto.createHmac("sha256", oauthStateSecret()).update(`${ts}.${nonce}`).digest("hex").slice(0, 32);
  return `${ts}.${nonce}.${sig}`;
}

function verifyState(state: string | undefined): boolean {
  const parts = (state ?? "").split(".");
  if (parts.length !== 3) return false;
  const [ts, nonce, sig] = parts;
  const expected = crypto.createHmac("sha256", oauthStateSecret()).update(`${ts}.${nonce}`).digest("hex").slice(0, 32);
  if (sig !== expected) return false;
  const t = parseInt(ts, 36);
  return Number.isFinite(t) && Date.now() - t < 15 * 60 * 1000;
}

function decryptIfNeeded(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!isEncrypted(value)) return value;
  try {
    return decrypt(value);
  } catch {
    return null;
  }
}

type GoogleMeta = {
  refreshToken?: string;
  rootFolderId?: string;
  rootFolderName?: string;
};

function readMeta(row: typeof socialAccountsTable.$inferSelect): GoogleMeta {
  const raw = row.pages;
  if (!raw) return {};
  try {
    return (typeof raw === "string" ? JSON.parse(raw) : raw) as GoogleMeta;
  } catch {
    return {};
  }
}

async function getAgencyGoogleAccount() {
  const [row] = await db
    .select()
    .from(socialAccountsTable)
    .where(
      and(
        eq(socialAccountsTable.clientId, AGENCY_CLIENT_ID),
        eq(socialAccountsTable.provider, GOOGLE_PROVIDER),
      ),
    );
  return row ?? null;
}

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date }> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("GOOGLE_OAUTH_CONFIG_MISSING");
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const p = (await r.json()) as Record<string, unknown>;
  if (!r.ok || !p.access_token) {
    throw new Error(`GOOGLE_REFRESH_FAILED: ${JSON.stringify(p)}`);
  }
  const expiresIn = Number(p.expires_in ?? 3600);
  return {
    accessToken: String(p.access_token),
    expiresAt: new Date(Date.now() + expiresIn * 1000),
  };
}

async function getValidAccessToken(): Promise<{ token: string; account: typeof socialAccountsTable.$inferSelect } | null> {
  const account = await getAgencyGoogleAccount();
  if (!account || !account.isActive) return null;
  const meta = readMeta(account);
  const refreshToken = decryptIfNeeded(meta.refreshToken ?? null);
  if (!refreshToken) return null;

  const stillValid =
    account.tokenExpiresAt && account.tokenExpiresAt.getTime() - Date.now() > 60_000;
  if (stillValid && account.accessToken) {
    const plain = decryptIfNeeded(account.accessToken);
    if (plain) return { token: plain, account };
  }

  const { accessToken, expiresAt } = await refreshAccessToken(refreshToken);
  await db
    .update(socialAccountsTable)
    .set({
      accessToken: encrypt(accessToken),
      tokenExpiresAt: expiresAt,
      lastSyncedAt: new Date(),
    })
    .where(eq(socialAccountsTable.id, account.id));
  return { token: accessToken, account: { ...account, accessToken: encrypt(accessToken), tokenExpiresAt: expiresAt } };
}

async function driveFetch(path: string, token: string, init: RequestInit = {}): Promise<any> {
  const r = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Drive API ${path} → ${r.status}: ${text.slice(0, 400)}`);
  }
  return r.json() as Promise<any>;
}

async function ensureRootFolder(token: string, account: typeof socialAccountsTable.$inferSelect): Promise<{ id: string; name: string }> {
  const meta = readMeta(account);
  const desiredName = meta.rootFolderName?.trim() || process.env.GOOGLE_DRIVE_ROOT_NAME || "Clienti BeKind";

  if (meta.rootFolderId) {
    try {
      const folder = await driveFetch(`/files/${meta.rootFolderId}?fields=id,name,trashed`, token);
      if (folder && !folder.trashed) return { id: folder.id, name: folder.name };
    } catch (err) {
      logger.warn({ err }, "Google Drive: root folder dello stato non più valido, ricreo");
    }
  }

  const created = await driveFetch("/files?fields=id,name", token, {
    method: "POST",
    body: JSON.stringify({
      name: desiredName,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });

  const updatedMeta: GoogleMeta = { ...meta, rootFolderId: created.id, rootFolderName: created.name };
  await db
    .update(socialAccountsTable)
    .set({ pages: updatedMeta as any })
    .where(eq(socialAccountsTable.id, account.id));

  return { id: created.id, name: created.name };
}

// ─── OAuth ───────────────────────────────────────────────────────────────────

router.get("/google/oauth/start", async (req, res): Promise<void> => {
  if (!getUserId(req)) {
    res.status(401).json({ error: "Non autenticato" });
    return;
  }
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) {
    res.status(500).json({ error: "GOOGLE_OAUTH_CONFIG_MISSING", message: "Imposta GOOGLE_OAUTH_CLIENT_ID e GOOGLE_OAUTH_CLIENT_SECRET su Vercel." });
    return;
  }
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", oauthRedirectUri(req));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", DRIVE_SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", signState());
  res.json({ url: url.toString() });
});

router.get("/google/oauth/callback", async (req, res): Promise<void> => {
  const q = req.query as Record<string, string | undefined>;
  const back = (status: string) => res.redirect(302, `${publicAppBase(req)}/settings?google=${status}`);
  if (q.error) {
    back("error");
    return;
  }
  if (!q.code || !verifyState(q.state)) {
    back("error");
    return;
  }
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    back("config");
    return;
  }
  try {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: q.code,
      redirect_uri: oauthRedirectUri(req),
      grant_type: "authorization_code",
    });
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const p = (await r.json()) as Record<string, unknown>;
    if (!r.ok || !p.access_token) {
      logger.error({ p }, "Google OAuth: code exchange failed");
      back("error");
      return;
    }
    const accessToken = String(p.access_token);
    const refreshToken = String(p.refresh_token ?? "");
    if (!refreshToken) {
      // Capita se l'utente ha già autorizzato: chiediamo prompt=consent ma può
      // arrivare comunque vuoto. In quel caso bisogna revocare manualmente.
      logger.warn({ p }, "Google OAuth: nessun refresh_token (l'utente ha già autorizzato in passato)");
    }
    const expiresAt = new Date(Date.now() + Number(p.expires_in ?? 3600) * 1000);

    // Recupera email dell'account
    let userEmail = "";
    try {
      const meRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const me = (await meRes.json()) as Record<string, unknown>;
      userEmail = String(me.email ?? "");
    } catch (err) {
      logger.warn({ err }, "Google OAuth: userinfo fallito");
    }

    const existing = await getAgencyGoogleAccount();
    const meta: GoogleMeta = {
      ...(existing ? readMeta(existing) : {}),
      refreshToken: refreshToken
        ? encrypt(refreshToken)
        : (existing ? readMeta(existing).refreshToken : undefined),
    };

    if (existing) {
      await db
        .update(socialAccountsTable)
        .set({
          accessToken: encrypt(accessToken),
          tokenExpiresAt: expiresAt,
          metaUserName: userEmail || existing.metaUserName,
          pages: meta as any,
          isActive: true,
          lastSyncedAt: new Date(),
        })
        .where(eq(socialAccountsTable.id, existing.id));
    } else {
      await db.insert(socialAccountsTable).values({
        clientId: AGENCY_CLIENT_ID,
        provider: GOOGLE_PROVIDER,
        accessToken: encrypt(accessToken),
        tokenExpiresAt: expiresAt,
        metaUserName: userEmail,
        pages: meta as any,
        isActive: true,
        lastSyncedAt: new Date(),
      });
    }

    back("connected");
  } catch (err) {
    logger.error({ err }, "Google OAuth callback failed");
    back("error");
  }
});

router.get("/google/status", async (_req, res): Promise<void> => {
  const account = await getAgencyGoogleAccount();
  if (!account || !account.isActive) {
    res.json({ connected: false, configured: Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET) });
    return;
  }
  const meta = readMeta(account);
  const expired = account.tokenExpiresAt ? account.tokenExpiresAt.getTime() < Date.now() : false;
  res.json({
    connected: true,
    configured: Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET),
    email: account.metaUserName ?? null,
    tokenExpiresAt: account.tokenExpiresAt?.toISOString() ?? null,
    accessTokenExpired: expired,
    rootFolderName: meta.rootFolderName ?? null,
    rootFolderId: meta.rootFolderId ?? null,
    hasRefreshToken: Boolean(meta.refreshToken),
  });
});

router.post("/google/disconnect", async (_req, res): Promise<void> => {
  const account = await getAgencyGoogleAccount();
  if (!account) {
    res.json({ success: true });
    return;
  }
  await db
    .update(socialAccountsTable)
    .set({ isActive: false, accessToken: null })
    .where(eq(socialAccountsTable.id, account.id));
  res.json({ success: true });
});

// ─── Per-client Drive operations ─────────────────────────────────────────────

async function ensureClientAccess(req: Request): Promise<{ userId: string; clientId: number } | { error: string; status: number }> {
  const userId = getUserId(req);
  if (!userId) return { error: "UNAUTHORIZED", status: 401 };
  const clientId = Number(req.params.clientId);
  if (!Number.isFinite(clientId) || clientId <= 0) return { error: "CLIENT_ID_INVALID", status: 400 };
  const accessible = await getAccessibleClientIds(userId);
  if (accessible !== "all" && !accessible.includes(clientId)) return { error: "CLIENT_ACCESS_DENIED", status: 403 };
  return { userId, clientId };
}

router.post("/clients/:clientId/drive/create-folder", async (req, res): Promise<void> => {
  const ctx = await ensureClientAccess(req);
  if ("error" in ctx) {
    res.status(ctx.status).json({ error: ctx.error });
    return;
  }
  try {
    const tokenInfo = await getValidAccessToken();
    if (!tokenInfo) {
      res.status(400).json({ error: "GOOGLE_NOT_CONNECTED", message: "Collega Google Drive da Impostazioni" });
      return;
    }
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, ctx.clientId));
    if (!client) {
      res.status(404).json({ error: "CLIENT_NOT_FOUND" });
      return;
    }

    const root = await ensureRootFolder(tokenInfo.token, tokenInfo.account);
    const folderName = `${client.name} — ${new Date().getFullYear()}`;
    const created = await driveFetch("/files?fields=id,name,webViewLink", tokenInfo.token, {
      method: "POST",
      body: JSON.stringify({
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [root.id],
      }),
    });

    const webLink = created.webViewLink || `https://drive.google.com/drive/folders/${created.id}`;
    await db
      .update(clientsTable)
      .set({ driveUrl: webLink })
      .where(eq(clientsTable.id, ctx.clientId));

    res.json({
      success: true,
      folderId: created.id,
      folderName: created.name,
      driveUrl: webLink,
      rootFolderName: root.name,
    });
  } catch (err: any) {
    logger.error({ err }, "Drive create-folder failed");
    res.status(500).json({ error: "DRIVE_CREATE_FAILED", message: err?.message ?? "Errore creazione cartella" });
  }
});

router.get("/clients/:clientId/drive/list", async (req, res): Promise<void> => {
  const ctx = await ensureClientAccess(req);
  if ("error" in ctx) {
    res.status(ctx.status).json({ error: ctx.error });
    return;
  }
  try {
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, ctx.clientId));
    if (!client?.driveUrl) {
      res.json({ folderId: null, files: [] });
      return;
    }
    const folderId = extractFolderIdFromUrl(client.driveUrl);
    if (!folderId) {
      res.json({ folderId: null, files: [], warning: "URL Drive non riconosciuto" });
      return;
    }
    const tokenInfo = await getValidAccessToken();
    if (!tokenInfo) {
      res.json({ folderId, files: [], warning: "GOOGLE_NOT_CONNECTED" });
      return;
    }
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "files(id,name,mimeType,modifiedTime,iconLink,webViewLink,size,thumbnailLink)",
      orderBy: "modifiedTime desc",
      pageSize: "50",
    });
    try {
      const payload = await driveFetch(`/files?${params.toString()}`, tokenInfo.token);
      res.json({ folderId, files: payload.files ?? [] });
    } catch (err: any) {
      // 404 dalla cartella → probabilmente fuori scope drive.file (è stata creata manualmente
      // e non da noi). Non è un errore della UI: rispondiamo con array vuoto e nota.
      res.json({ folderId, files: [], warning: "FOLDER_NOT_ACCESSIBLE", detail: err?.message });
    }
  } catch (err: any) {
    logger.error({ err }, "Drive list failed");
    res.status(500).json({ error: "DRIVE_LIST_FAILED", message: err?.message });
  }
});

function extractFolderIdFromUrl(url: string): string | null {
  const m = url.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return idMatch ? idMatch[1] : null;
}

// ─── Email manuale: condividi Drive col cliente quando l'agenzia clicca ──────

router.post("/clients/:clientId/drive/email-invite", async (req, res): Promise<void> => {
  const ctx = await ensureClientAccess(req);
  if ("error" in ctx) {
    res.status(ctx.status).json({ error: ctx.error });
    return;
  }
  const body = (req.body ?? {}) as { to?: string; message?: string };
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, ctx.clientId));
  if (!client) {
    res.status(404).json({ error: "CLIENT_NOT_FOUND" });
    return;
  }
  const toRaw = body.to?.trim() || client.email || "";
  if (!toRaw) {
    res.status(400).json({ error: "EMAIL_DESTINATARIO_MANCANTE" });
    return;
  }
  if (!client.driveUrl) {
    res.status(400).json({ error: "DRIVE_URL_MANCANTE", message: "Crea prima la cartella Drive del cliente." });
    return;
  }
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    res.status(503).json({
      error: "SMTP_NOT_CONFIGURED",
      message: "Configura SMTP_HOST/SMTP_USER/SMTP_PASS su Vercel per spedire mail.",
    });
    return;
  }
  try {
    const nodemailer = await import("nodemailer");
    const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
    const transporter = nodemailer.default.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    const extra = body.message?.trim() ? `<p>${body.message.trim().replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>` : "";
    const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;background:#f5f5f0;margin:0;padding:24px">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,.08)">
<h2 style="margin:0 0 12px;color:#333">Cartella materiali condivisa</h2>
<p style="color:#555;line-height:1.55">Ciao ${client.name},<br>condividiamo con te la cartella Google Drive con i materiali del nostro lavoro:</p>
${extra}
<p style="text-align:center;margin:20px 0">
<a href="${client.driveUrl}" style="display:inline-block;background:#4a6629;color:#fff;padding:12px 26px;border-radius:8px;text-decoration:none;font-weight:600">Apri cartella Drive</a>
</p>
<p style="color:#999;font-size:12px;margin-top:24px">Be Kind Social Agency · ${new Date().toLocaleDateString("it-IT")}</p>
</div></body></html>`;
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? user,
      to: toRaw,
      subject: `[Be Kind] Cartella Drive — ${client.name}`,
      html,
    });
    res.json({ success: true, to: toRaw });
  } catch (err: any) {
    logger.error({ err }, "Drive email-invite failed");
    res.status(500).json({ error: "EMAIL_SEND_FAILED", message: err?.message });
  }
});

export default router;
