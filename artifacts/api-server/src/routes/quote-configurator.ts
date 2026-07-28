import { Router, type IRouter, type Request, type Response } from "express";
import { randomBytes } from "node:crypto";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  quoteServicesTable,
  quoteDiscountCodesTable,
  quoteLinksTable,
  quoteRequestsTable,
} from "@workspace/db";
import {
  computeQuote,
  QUOTE_SETTINGS,
  type QuoteServiceDef,
  type QuoteSelectionItem,
} from "@workspace/api-zod";
import { getUserId } from "../lib/access-control";

/**
 * Configuratore preventivo self-service.
 *  - Route pubbliche (/public/preventivo/:token): il prospect compone e paga
 *    l'acconto. Nessun login, la chiave è il token del link.
 *  - Route agenzia (/quote-*): generare i link e leggere i lead. Sotto login.
 *
 * Il prezzo è SEMPRE ricalcolato dal server: i numeri che arrivano dal client
 * non sono attendibili.
 */
const router: IRouter = Router();

/** Riga catalogo (jsonb) → tipo forte del motore di calcolo. */
function toServiceDef(row: typeof quoteServicesTable.$inferSelect): QuoteServiceDef {
  return {
    key: row.key,
    name: row.name,
    description: row.description,
    category: row.category,
    billing: row.billing === "oneoff" ? "oneoff" : "monthly",
    pricing: (["fixed", "tiered", "per_unit"].includes(row.pricing) ? row.pricing : "fixed") as QuoteServiceDef["pricing"],
    basePrice: row.basePrice,
    unitLabel: row.unitLabel,
    unitPrice: row.unitPrice,
    minQty: row.minQty,
    maxQty: row.maxQty,
    tiers: Array.isArray(row.tiers) ? (row.tiers as QuoteServiceDef["tiers"]) : [],
    options: Array.isArray(row.options) ? (row.options as QuoteServiceDef["options"]) : [],
  };
}

async function loadActiveServices(): Promise<QuoteServiceDef[]> {
  const rows = await db
    .select()
    .from(quoteServicesTable)
    .where(eq(quoteServicesTable.active, true))
    .orderBy(quoteServicesTable.sort, quoteServicesTable.id);
  return rows.map(toServiceDef);
}

type PriceOverride = { basePrice?: number; unitPrice?: number; tiers?: Record<string, number>; hidden?: boolean };

/**
 * Applica gli override di prezzo di un link sopra il catalogo globale. I servizi
 * marcati `hidden` per quel cliente vengono tolti. Usato sia per mostrare il
 * catalogo (GET) sia per ricalcolare il prezzo autorevole (POST): così display
 * e conto usano sempre gli stessi numeri personalizzati.
 */
function applyOverrides(services: QuoteServiceDef[], raw: unknown): QuoteServiceDef[] {
  const overrides = (raw && typeof raw === "object" ? raw : {}) as Record<string, PriceOverride>;
  const out: QuoteServiceDef[] = [];
  for (const s of services) {
    const ov = overrides[s.key];
    if (!ov) { out.push(s); continue; }
    if (ov.hidden) continue;
    out.push({
      ...s,
      basePrice: typeof ov.basePrice === "number" ? ov.basePrice : s.basePrice,
      unitPrice: typeof ov.unitPrice === "number" ? ov.unitPrice : s.unitPrice,
      tiers: ov.tiers
        ? s.tiers.map((t) => (typeof ov.tiers![t.value] === "number" ? { ...t, price: ov.tiers![t.value] } : t))
        : s.tiers,
    });
  }
  return out;
}

/** Percentuale di un codice sconto valido (0 se assente/scaduto). */
async function codePercent(code?: string | null): Promise<{ percent: number; code: string | null }> {
  const c = (code ?? "").trim();
  if (!c) return { percent: 0, code: null };
  const [row] = await db
    .select()
    .from(quoteDiscountCodesTable)
    .where(and(eq(quoteDiscountCodesTable.code, c), eq(quoteDiscountCodesTable.active, true)))
    .limit(1);
  return row ? { percent: row.percent, code: row.code } : { percent: 0, code: null };
}

/* ─────────────────────────  PUBBLICO  ───────────────────────── */

router.get("/public/preventivo/:token", async (req, res): Promise<void> => {
  const token = String(req.params.token ?? "");
  const [link] = await db
    .select()
    .from(quoteLinksTable)
    .where(and(eq(quoteLinksTable.token, token), eq(quoteLinksTable.status, "active")))
    .limit(1);
  if (!link) { res.status(404).json({ error: "LINK_NON_VALIDO" }); return; }

  const services = applyOverrides(await loadActiveServices(), link.priceOverrides);
  res.json({
    prospectName: link.prospectName,
    preset: Array.isArray(link.preset) ? link.preset : [],
    services,
    settings: QUOTE_SETTINGS,
    stripeEnabled: Boolean(process.env.STRIPE_SECRET_KEY),
  });
});

const selectionSchema = z.array(z.object({
  key: z.string().min(1),
  tier: z.string().nullable().optional(),
  qty: z.number().nullable().optional(),
  choices: z.record(z.string(), z.array(z.string())).optional(),
})).max(50);

const submitSchema = z.object({
  selection: selectionSchema,
  months: z.number().int(),
  email: z.string().email().max(200).optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  code: z.string().max(60).optional(),
});

async function resolveActiveLink(token: string) {
  const [link] = await db
    .select()
    .from(quoteLinksTable)
    .where(and(eq(quoteLinksTable.token, token), eq(quoteLinksTable.status, "active")))
    .limit(1);
  return link ?? null;
}

router.post("/public/preventivo/:token/quote", async (req, res): Promise<void> => {
  const token = String(req.params.token ?? "");
  const link = await resolveActiveLink(token);
  if (!link) { res.status(404).json({ error: "LINK_NON_VALIDO" }); return; }

  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const body = parsed.data;

  const services = applyOverrides(await loadActiveServices(), link.priceOverrides);
  const { percent, code } = await codePercent(body.code);
  const breakdown = computeQuote(services, body.selection as QuoteSelectionItem[], body.months, percent);

  // Salva/aggiorna il lead. Un solo record per (token) aggiornato mentre compone,
  // così l'inbox non si riempie di bozze: si tiene l'ultimo stato composto.
  const [existing] = await db
    .select({ id: quoteRequestsTable.id, status: quoteRequestsTable.status })
    .from(quoteRequestsTable)
    .where(eq(quoteRequestsTable.linkToken, token))
    .orderBy(desc(quoteRequestsTable.id))
    .limit(1);

  const values = {
    linkToken: token,
    prospectName: link.prospectName,
    email: body.email || null,
    phone: body.phone || null,
    selection: body.selection,
    months: breakdown.months,
    monthlySubtotal: breakdown.monthlySubtotal,
    oneoffSubtotal: breakdown.oneoffSubtotal,
    discountPct: breakdown.discountPercent,
    discountCode: code,
    contractTotal: breakdown.contractTotal,
    deposit: breakdown.deposit,
  };

  let requestId: number;
  // Non sovrascrivere un lead che ha già pagato: quello è chiuso.
  if (existing && existing.status !== "deposit_paid") {
    await db.update(quoteRequestsTable).set(values).where(eq(quoteRequestsTable.id, existing.id));
    requestId = existing.id;
  } else {
    const [row] = await db.insert(quoteRequestsTable).values(values).returning({ id: quoteRequestsTable.id });
    requestId = row.id;
  }

  res.json({
    requestId,
    breakdown,
    codeApplied: code,
    codeValid: Boolean(body.code) ? percent > 0 : null,
    stripeEnabled: Boolean(process.env.STRIPE_SECRET_KEY),
  });
});

/** Base URL per i redirect Stripe: dall'header Origin, fallback su env. */
function baseUrl(req: Request): string {
  const origin = req.get("origin");
  if (origin) return origin.replace(/\/$/, "");
  const env = (process.env.PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
  if (env) return env;
  const proto = req.get("x-forwarded-proto") ?? "https";
  return `${proto}://${req.get("host")}`;
}

router.post("/public/preventivo/:token/checkout", async (req, res): Promise<void> => {
  const token = String(req.params.token ?? "");
  const link = await resolveActiveLink(token);
  if (!link) { res.status(404).json({ error: "LINK_NON_VALIDO" }); return; }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) { res.status(501).json({ error: "STRIPE_NOT_CONFIGURED" }); return; }

  const requestId = Number((req.body as { requestId?: unknown })?.requestId);
  if (!Number.isFinite(requestId)) { res.status(400).json({ error: "REQUEST_ID_MANCANTE" }); return; }

  const [reqRow] = await db
    .select()
    .from(quoteRequestsTable)
    .where(and(eq(quoteRequestsTable.id, requestId), eq(quoteRequestsTable.linkToken, token)))
    .limit(1);
  if (!reqRow) { res.status(404).json({ error: "PREVENTIVO_NON_TROVATO" }); return; }
  if (reqRow.deposit <= 0) { res.status(400).json({ error: "ACCONTO_NULLO" }); return; }

  // Stripe Checkout via REST, senza SDK: nessuna dipendenza aggiuntiva.
  const base = baseUrl(req);
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("success_url", `${base}/preventivo/${encodeURIComponent(token)}?pagato=1`);
  form.set("cancel_url", `${base}/preventivo/${encodeURIComponent(token)}?annullato=1`);
  form.set("line_items[0][quantity]", "1");
  form.set("line_items[0][price_data][currency]", "eur");
  form.set("line_items[0][price_data][unit_amount]", String(Math.round(reqRow.deposit * 100)));
  form.set("line_items[0][price_data][product_data][name]", `Acconto primo mese · ${reqRow.prospectName ?? "Preventivo Be Kind"}`);
  form.set("metadata[requestId]", String(requestId));
  form.set("metadata[token]", token);
  if (reqRow.email) form.set("customer_email", reqRow.email);

  try {
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    const data = (await r.json()) as { id?: string; url?: string; error?: { message?: string } };
    if (!r.ok || !data.url) {
      res.status(502).json({ error: "STRIPE_ERROR", detail: data.error?.message ?? "checkout non creato" });
      return;
    }
    await db.update(quoteRequestsTable).set({ stripeSessionId: data.id ?? null }).where(eq(quoteRequestsTable.id, requestId));
    res.json({ url: data.url });
  } catch {
    res.status(502).json({ error: "STRIPE_ERROR" });
  }
});

/* ─────────────────────────  AGENZIA (auth)  ───────────────────────── */

function requireUser(req: Request, res: Response): string | null {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return null; }
  return userId;
}

router.get("/quote-services", async (req, res): Promise<void> => {
  if (!requireUser(req, res)) return;
  const rows = await db.select().from(quoteServicesTable).orderBy(quoteServicesTable.sort, quoteServicesTable.id);
  res.json(rows);
});

const tierSchema = z.object({ label: z.string().min(1).max(120), value: z.string().min(1).max(60), price: z.number().int().min(0).max(1000000) });
const updateServiceSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  basePrice: z.number().int().min(0).max(1000000).optional(),
  unitPrice: z.number().int().min(0).max(1000000).nullable().optional(),
  tiers: z.array(tierSchema).max(10).optional(),
  active: z.boolean().optional(),
}).strict();

/** Modifica una voce di catalogo (prezzi, scaglioni, attivo). Solo agenzia. */
router.patch("/quote-services/:id", async (req, res): Promise<void> => {
  if (!requireUser(req, res)) return;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "ID non valido" }); return; }
  const parsed = updateServiceSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updates: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.name !== undefined) updates.name = d.name;
  if (d.description !== undefined) updates.description = d.description;
  if (d.basePrice !== undefined) updates.basePrice = d.basePrice;
  if (d.unitPrice !== undefined) updates.unitPrice = d.unitPrice;
  if (d.tiers !== undefined) updates.tiers = d.tiers;
  if (d.active !== undefined) updates.active = d.active;
  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "Nessun campo da aggiornare" }); return; }

  const [row] = await db.update(quoteServicesTable).set(updates).where(eq(quoteServicesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Servizio non trovato" }); return; }
  res.json(row);
});

const createLinkSchema = z.object({
  prospectName: z.string().trim().min(2).max(200),
  note: z.string().trim().max(1000).optional(),
  preset: z.array(z.string()).max(50).optional(),
});

router.post("/quote-links", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const parsed = createLinkSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const token = randomBytes(18).toString("base64url");
  const [row] = await db.insert(quoteLinksTable).values({
    token,
    prospectName: parsed.data.prospectName,
    note: parsed.data.note ?? null,
    preset: parsed.data.preset ?? [],
    createdBy: userId,
  }).returning();
  res.status(201).json({ ...row, url: `${baseUrl(req)}/preventivo/${token}` });
});

router.get("/quote-links", async (req, res): Promise<void> => {
  if (!requireUser(req, res)) return;
  const rows = await db.select().from(quoteLinksTable).orderBy(desc(quoteLinksTable.id));
  const base = baseUrl(req);
  res.json(rows.map((l) => ({ ...l, url: `${base}/preventivo/${l.token}` })));
});

const overrideSchema = z.object({
  basePrice: z.number().int().min(0).max(1000000).optional(),
  unitPrice: z.number().int().min(0).max(1000000).optional(),
  tiers: z.record(z.string(), z.number().int().min(0).max(1000000)).optional(),
  hidden: z.boolean().optional(),
});
const patchLinkSchema = z.object({
  status: z.enum(["active", "disabled"]).optional(),
  preset: z.array(z.string()).max(50).optional(),
  priceOverrides: z.record(z.string(), overrideSchema).optional(),
}).strict();

router.patch("/quote-links/:id", async (req, res): Promise<void> => {
  if (!requireUser(req, res)) return;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "ID non valido" }); return; }
  const parsed = patchLinkSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updates: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.preset !== undefined) updates.preset = parsed.data.preset;
  if (parsed.data.priceOverrides !== undefined) updates.priceOverrides = parsed.data.priceOverrides;
  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "Nessun campo da aggiornare" }); return; }

  const [row] = await db.update(quoteLinksTable).set(updates).where(eq(quoteLinksTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Link non trovato" }); return; }
  res.json({ ...row, url: `${baseUrl(req)}/preventivo/${row.token}` });
});

router.get("/quote-requests", async (req, res): Promise<void> => {
  if (!requireUser(req, res)) return;
  const rows = await db.select().from(quoteRequestsTable).orderBy(desc(quoteRequestsTable.createdAt)).limit(200);
  res.json(rows);
});

export default router;
