import { Router, type Request, type Response } from "express";
import { db, clientsTable, socialAccountsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getAuth } from "@clerk/express";

const router = Router();

function getUserId(req: Request): string | null {
  try {
    const auth = getAuth(req as any);
    return auth?.userId ?? null;
  } catch {
    return null;
  }
}

async function getGoogleAdsConfig() {
  const [agency] = await db.select().from(socialAccountsTable).where(eq(socialAccountsTable.clientId, 0));
  const googleAdsToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const googleRefreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  const googleClientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  return {
    developerToken: googleAdsToken ?? null,
    refreshToken: googleRefreshToken ?? null,
    clientId: googleClientId ?? null,
    clientSecret: googleClientSecret ?? null,
    configured: !!(googleAdsToken && googleRefreshToken && googleClientId && googleClientSecret),
  };
}

router.get("/google-ads/status", async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }
  const config = await getGoogleAdsConfig();
  res.json({
    configured: config.configured,
    hasDeveloperToken: !!config.developerToken,
    hasRefreshToken: !!config.refreshToken,
    hasClientCredentials: !!(config.clientId && config.clientSecret),
  });
});

router.get("/google-ads/campaigns/:clientId", async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }
  const clientId = parseInt(req.params.clientId as string);
  if (isNaN(clientId)) { res.status(400).json({ error: "ID cliente non valido" }); return; }
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
  if (!client) { res.status(404).json({ error: "Cliente non trovato" }); return; }
  if (!client.googleAdsId) {
    res.json({ campaigns: [], message: "Nessun account Google Ads collegato a questo cliente" });
    return;
  }

  const config = await getGoogleAdsConfig();
  if (!config.configured) {
    res.json({ campaigns: [], message: "Google Ads non configurato. Aggiungi le credenziali nelle variabili d'ambiente." });
    return;
  }

  try {
    const accessToken = await getAccessToken(config.refreshToken!, config.clientId!, config.clientSecret!);
    const customerId = client.googleAdsId.replace(/-/g, "");

    const query = `SELECT campaign.id, campaign.name, campaign.status, campaign_budget.amount_micros, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.ctr, metrics.average_cpc FROM campaign WHERE campaign.status != 'REMOVED' ORDER BY metrics.cost_micros DESC LIMIT 20`;

    const response = await fetch(
      `https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:searchStream`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "developer-token": config.developerToken!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      }
    );

    if (!response.ok) {
      res.status(502).json({ error: "Errore nella comunicazione con Google Ads API" });
      return;
    }

    const data = (await response.json()) as any[];
    const results = data[0]?.results ?? [];

    const campaigns = results.map((r: any) => ({
      id: r.campaign?.id,
      name: r.campaign?.name,
      status: r.campaign?.status,
      budget: r.campaignBudget?.amountMicros ? Number(r.campaignBudget.amountMicros) / 1_000_000 : 0,
      impressions: Number(r.metrics?.impressions ?? 0),
      clicks: Number(r.metrics?.clicks ?? 0),
      cost: r.metrics?.costMicros ? Number(r.metrics.costMicros) / 1_000_000 : 0,
      conversions: Number(r.metrics?.conversions ?? 0),
      ctr: Number(r.metrics?.ctr ?? 0),
      avgCpc: r.metrics?.averageCpc ? Number(r.metrics.averageCpc) / 1_000_000 : 0,
    }));

    res.json({ campaigns, customerId });
  } catch (err: any) {
    res.status(500).json({ error: "Errore nella richiesta Google Ads", detail: err.message });
  }
});

router.get("/google-ads/summary/:clientId", async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }
  const clientId = parseInt(req.params.clientId as string);
  if (isNaN(clientId)) { res.status(400).json({ error: "ID cliente non valido" }); return; }
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
  if (!client) { res.status(404).json({ error: "Cliente non trovato" }); return; }
  if (!client.googleAdsId) {
    res.json({ summary: null, message: "Nessun account Google Ads collegato" });
    return;
  }

  const config = await getGoogleAdsConfig();
  if (!config.configured) {
    res.json({ summary: null, message: "Google Ads non configurato" });
    return;
  }

  try {
    const accessToken = await getAccessToken(config.refreshToken!, config.clientId!, config.clientSecret!);
    const customerId = client.googleAdsId.replace(/-/g, "");

    const query = `SELECT metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.ctr, metrics.average_cpc FROM customer WHERE segments.date DURING LAST_30_DAYS`;

    const response = await fetch(
      `https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:searchStream`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "developer-token": config.developerToken!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      }
    );

    if (!response.ok) {
      res.json({ summary: null, error: "Errore nella comunicazione con Google Ads" });
      return;
    }

    const data = (await response.json()) as any[];
    const results = data[0]?.results ?? [];
    let totalImpressions = 0, totalClicks = 0, totalCost = 0, totalConversions = 0;
    for (const r of results) {
      totalImpressions += Number(r.metrics?.impressions ?? 0);
      totalClicks += Number(r.metrics?.clicks ?? 0);
      totalCost += Number(r.metrics?.costMicros ?? 0) / 1_000_000;
      totalConversions += Number(r.metrics?.conversions ?? 0);
    }

    res.json({
      summary: {
        impressions: totalImpressions,
        clicks: totalClicks,
        cost: Math.round(totalCost * 100) / 100,
        conversions: totalConversions,
        ctr: totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0,
        cpc: totalClicks > 0 ? Math.round((totalCost / totalClicks) * 100) / 100 : 0,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: "Errore Google Ads", detail: err.message });
  }
});

async function getAccessToken(refreshToken: string, clientId: string, clientSecret: string): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!response.ok) throw new Error(`Token refresh failed: ${response.status}`);
  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

export default router;
