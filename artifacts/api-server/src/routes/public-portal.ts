import { Router, type IRouter, type Request, type Response } from "express";
import { createHmac } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import {
  db,
  clientsTable,
  clientBriefs,
  clientEventsTable,
  editorialPlansTable,
  editorialSlotsTable,
  clientReportsTable,
  filesTable,
  projectsTable,
  clientContentIdeasTable,
} from "@workspace/db";
import { derivePlatform, normalizeExternalUrl } from "../lib/social-url";

/**
 * Area cliente condivisa SENZA login.
 * Accesso tramite token (clients.share_token) nell'URL: /api/public/portal/:token/...
 * Espone SOLO i dati del cliente del token e SOLO le sezioni consentite:
 *  - brief: lettura + scrittura (il cliente lo compila)
 *  - idee: lettura + inserimento (il cliente propone link di ispirazione)
 *  - eventi / editoriale / report / file: sola lettura
 * Montato sotto /api/public/* → fuori dal gate di login (il token è la chiave).
 */
const router: IRouter = Router();

type ClientRow = typeof clientsTable.$inferSelect;

// B3: in produzione, se nessuna fonte di entropy è configurata, ritorna
// stringa vuota → tutti i token saranno rifiutati (HMAC differente da
// quello generato in clients.ts). Prima il fallback "bekind-share-token"
// hardcoded consentiva a un attaccante di forgiare token validi conoscendo
// solo il default. In dev, lascia il fallback per non bloccare lo sviluppo.
function shareTokenSecret(): string {
  const fromEnv = process.env.SHARE_TOKEN_SECRET
    || process.env.CRON_SECRET
    || process.env.TOKEN_ENCRYPTION_KEY;
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") return "";
  return "bekind-share-token-dev-only";
}

/**
 * Verifica il token share. Supporta due formati:
 *  - "rand.expiryB36.sig"  → token firmato con scadenza (formato corrente)
 *  - "rand"                → token legacy senza scadenza (pre-2026-06-01)
 * Il legacy è accettato ma con avviso log: rigenerarlo dal dialog
 * "Condividi col cliente" creerà uno nuovo firmato con TTL 90gg.
 */
function verifyShareToken(token: string): { ok: true; format: "signed" | "legacy" } | { ok: false; reason: "INVALID" | "EXPIRED" | "BAD_SIG" } {
  const parts = token.split(".");
  if (parts.length === 1) {
    // Legacy: random bytes only, no expiry. Lunghezza tipica 24-32 char base64url.
    if (token.length >= 16 && /^[A-Za-z0-9_-]+$/.test(token)) return { ok: true, format: "legacy" };
    return { ok: false, reason: "INVALID" };
  }
  if (parts.length !== 3) return { ok: false, reason: "INVALID" };
  const [rand, expiryB36, sig] = parts;
  const expected = createHmac("sha256", shareTokenSecret()).update(`${rand}.${expiryB36}`).digest("hex").slice(0, 32);
  if (sig !== expected) return { ok: false, reason: "BAD_SIG" };
  const expiryMs = parseInt(expiryB36, 36);
  if (!Number.isFinite(expiryMs)) return { ok: false, reason: "INVALID" };
  if (expiryMs < Date.now()) return { ok: false, reason: "EXPIRED" };
  return { ok: true, format: "signed" };
}

async function resolveClient(token: string): Promise<{ client: ClientRow | null; reason?: "INVALID" | "EXPIRED" | "BAD_SIG" }> {
  const t = (token ?? "").trim();
  if (!t || t.length < 16) return { client: null, reason: "INVALID" };

  const verdict = verifyShareToken(t);
  if (!verdict.ok) return { client: null, reason: verdict.reason };

  const [client] = await db
    .select()
    .from(clientsTable)
    .where(and(eq(clientsTable.shareToken, t), isNull(clientsTable.deletedAt)));
  return { client: client ?? null };
}

/** Middleware-style helper: risolve il token o risponde con il codice corretto. */
async function withClient(req: Request, res: Response): Promise<ClientRow | null> {
  const result = await resolveClient(req.params.token as string);
  if (!result.client) {
    if (result.reason === "EXPIRED") {
      res.status(410).json({ error: "Link scaduto. Chiedi all'agenzia un nuovo link." });
    } else {
      res.status(404).json({ error: "Link non valido o revocato" });
    }
    return null;
  }
  return result.client;
}

// Info di base del cliente + sezioni abilitate (per il guscio della pagina pubblica).
router.get("/public/portal/:token", async (req, res): Promise<void> => {
  const client = await withClient(req, res);
  if (!client) return;
  res.json({
    client: {
      name: client.name,
      logo: client.logoUrl ?? null,
      color: client.brandColor ?? client.color ?? "#7a8f5c",
      driveUrl: client.driveUrl ?? null,
    },
    sections: ["brief", "ideas", "events", "editorial", "reports", "files"],
  });
});

/* ── BRIEF (lettura + scrittura) ─────────────────────────────── */
router.get("/public/portal/:token/brief", async (req, res): Promise<void> => {
  const client = await withClient(req, res);
  if (!client) return;
  const [row] = await db.select().from(clientBriefs).where(eq(clientBriefs.clientId, client.id));
  res.json({ rawText: row?.rawText ?? "", parsedJson: row?.parsedJson ?? "{}" });
});

router.put("/public/portal/:token/brief", async (req, res): Promise<void> => {
  const client = await withClient(req, res);
  if (!client) return;

  const body = (req.body ?? {}) as { rawText?: unknown; parsedJson?: unknown };
  const updates: Record<string, unknown> = {};
  if (typeof body.rawText === "string") updates.rawText = body.rawText;
  if (body.parsedJson !== undefined) {
    updates.parsedJson = typeof body.parsedJson === "string" ? body.parsedJson : JSON.stringify(body.parsedJson ?? {});
  }
  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "Nessun dato da salvare" }); return; }

  try {
    const existing = await db.select().from(clientBriefs).where(eq(clientBriefs.clientId, client.id));
    if (existing.length > 0) {
      const [updated] = await db.update(clientBriefs).set(updates).where(eq(clientBriefs.clientId, client.id)).returning();
      res.json({ rawText: updated.rawText, parsedJson: updated.parsedJson });
    } else {
      const [created] = await db.insert(clientBriefs).values({
        clientId: client.id,
        rawText: typeof updates.rawText === "string" ? updates.rawText : "",
        parsedJson: typeof updates.parsedJson === "string" ? updates.parsedJson : "{}",
      }).returning();
      res.status(201).json({ rawText: created.rawText, parsedJson: created.parsedJson });
    }
  } catch {
    res.status(500).json({ error: "Errore nel salvataggio del brief" });
  }
});

/* ── EVENTI (sola lettura) ───────────────────────────────────── */
router.get("/public/portal/:token/events", async (req, res): Promise<void> => {
  const client = await withClient(req, res);
  if (!client) return;
  const rows = await db
    .select()
    .from(clientEventsTable)
    .where(eq(clientEventsTable.clientId, client.id))
    .orderBy(asc(clientEventsTable.date));
  res.json(
    rows.map((e) => ({
      id: String(e.id),
      title: e.title,
      date: e.date.toISOString(),
      endDate: e.endDate ? e.endDate.toISOString() : null,
      type: e.type,
      priority: e.priority,
      note: e.note ?? null,
    })),
  );
});

/* ── PIANO EDITORIALE (sola lettura) ─────────────────────────── */
router.get("/public/portal/:token/editorial", async (req, res): Promise<void> => {
  const client = await withClient(req, res);
  if (!client) return;
  const plans = await db
    .select()
    .from(editorialPlansTable)
    .where(and(eq(editorialPlansTable.clientId, client.id), isNull(editorialPlansTable.deletedAt)))
    .orderBy(desc(editorialPlansTable.year), desc(editorialPlansTable.month));
  const planIds = plans.map((p) => p.id);
  const slots = planIds.length
    ? await db
        .select()
        .from(editorialSlotsTable)
        .where(and(inArray(editorialSlotsTable.planId, planIds), isNull(editorialSlotsTable.deletedAt)))
        .orderBy(asc(editorialSlotsTable.publishDate))
    : [];
  res.json({
    plans: plans.map((p) => ({ id: p.id, month: p.month, year: p.year, status: p.status, packageType: p.packageType })),
    slots: slots.map((s) => ({
      id: s.id,
      planId: s.planId,
      platform: s.platform,
      contentType: s.contentType,
      publishDate: s.publishDate ?? null,
      title: s.title ?? null,
      caption: s.caption ?? null,
      status: s.status,
    })),
  });
});

/* ── REPORT (sola lettura, solo finalizzati) ─────────────────── */
router.get("/public/portal/:token/reports", async (req, res): Promise<void> => {
  const client = await withClient(req, res);
  if (!client) return;
  const rows = await db
    .select()
    .from(clientReportsTable)
    .where(and(eq(clientReportsTable.clientId, client.id), ne(clientReportsTable.status, "bozza")))
    .orderBy(desc(clientReportsTable.createdAt));
  res.json(
    rows.map((r) => ({
      id: r.id,
      titolo: r.titolo ?? r.periodLabel ?? "Report",
      period: r.periodLabel ?? r.period ?? null,
      status: r.status,
      pdfUrl: r.pdfUrl ?? null,
      createdAt: r.createdAt ? new Date(r.createdAt as any).toISOString() : null,
    })),
  );
});

/* ── FILE + Drive (sola lettura) ─────────────────────────────── */
router.get("/public/portal/:token/files", async (req, res): Promise<void> => {
  const client = await withClient(req, res);
  if (!client) return;
  const projects = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(and(eq(projectsTable.clientId, client.id), isNull(projectsTable.deletedAt)));
  const projectIds = projects.map((p) => p.id);
  const files = projectIds.length
    ? await db.select().from(filesTable).where(inArray(filesTable.projectId, projectIds)).orderBy(desc(filesTable.createdAt))
    : [];
  res.json({
    driveUrl: client.driveUrl ?? null,
    files: files.map((f) => ({
      id: f.id,
      name: f.name,
      url: f.url,
      type: f.type,
      createdAt: f.createdAt ? new Date(f.createdAt as any).toISOString() : null,
    })),
  });
});

/* ── BANCA IDEE (lettura + inserimento) ──────────────────────── */
// Seconda scrittura consentita al cliente dopo il brief: incolla un link e un
// titolo. `source` è forzato a 'client' e `clientId` viene dal token, mai dal
// body → un cliente non può scrivere sulla banca di un altro.
// Il cliente vede tutta la banca (anche le idee dell'agenzia), non solo le sue:
// è una bacheca condivisa, non una casella di posta a senso unico.
// Lo stato resta gestito dall'agenzia: qui è solo un'etichetta di lettura.
router.get("/public/portal/:token/ideas", async (req, res): Promise<void> => {
  const client = await withClient(req, res);
  if (!client) return;
  const rows = await db
    .select()
    .from(clientContentIdeasTable)
    .where(eq(clientContentIdeasTable.clientId, client.id))
    .orderBy(desc(clientContentIdeasTable.createdAt));
  res.json(
    rows.map((i) => ({
      id: i.id,
      title: i.title,
      url: i.url,
      platform: i.platform,
      source: i.source,
      status: i.status,
      notes: i.notes ?? null,
      createdAt: i.createdAt ? i.createdAt.toISOString() : null,
    })),
  );
});

router.post("/public/portal/:token/ideas", async (req, res): Promise<void> => {
  const client = await withClient(req, res);
  if (!client) return;

  const body = (req.body ?? {}) as { title?: unknown; url?: unknown; notes?: unknown };
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : "";

  if (!title || title.length > 300) { res.status(400).json({ error: "Serve un titolo (max 300 caratteri)." }); return; }
  const url = normalizeExternalUrl(rawUrl);
  if (!url) { res.status(400).json({ error: "Link non valido. Incolla il link completo del post." }); return; }

  try {
    // Cap anti-flood per cliente: il rate limit di publicPortalLimiter è per IP.
    const existing = await db
      .select({ id: clientContentIdeasTable.id })
      .from(clientContentIdeasTable)
      .where(eq(clientContentIdeasTable.clientId, client.id));
    if (existing.length >= 1000) {
      res.status(429).json({ error: "Hai raggiunto il numero massimo di idee. Scrivi all'agenzia." });
      return;
    }

    const [created] = await db.insert(clientContentIdeasTable).values({
      clientId: client.id,
      title,
      url,
      platform: derivePlatform(url),
      source: "client",
      status: "da_valutare",
      notes: notes || null,
      createdBy: null,
    }).returning();

    res.status(201).json({
      id: created.id,
      title: created.title,
      url: created.url,
      platform: created.platform,
      source: created.source,
      status: created.status,
      notes: created.notes ?? null,
      createdAt: created.createdAt ? created.createdAt.toISOString() : null,
    });
  } catch {
    res.status(500).json({ error: "Errore nel salvataggio dell'idea" });
  }
});

export default router;
