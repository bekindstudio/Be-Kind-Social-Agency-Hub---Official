import { Router, type IRouter, type Request, type Response } from "express";
import { createHmac } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, ne, gte, count } from "drizzle-orm";
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
  messagesTable,
} from "@workspace/db";
import { derivePlatform, normalizeExternalUrl } from "../lib/social-url";
import { normalizeCategory } from "../lib/ideas";

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

/* ── PIN portale (seconda chiave leggera, opzionale) ─────────────
 * Hash del PIN salvato su clients.portal_pin_hash. La prova d'accesso è un
 * cookie firmato (nessuna dipendenza: Set-Cookie/lettura a mano), che i fetch
 * same-origin mandano da soli. Cambiare il PIN invalida le prove vecchie perché
 * la firma include un pezzo dell'hash del PIN. */
export function hashPortalPin(clientId: number, pin: string): string {
  return createHmac("sha256", shareTokenSecret()).update(`portal-pin:${clientId}:${pin}`).digest("hex");
}
function pinProof(clientId: number, pinHash: string): string {
  const exp = Date.now() + 30 * 24 * 3600 * 1000;
  const expB36 = exp.toString(36);
  const sig = createHmac("sha256", shareTokenSecret()).update(`pinok:${clientId}:${expB36}:${pinHash.slice(0, 12)}`).digest("hex").slice(0, 32);
  return `${expB36}.${sig}`;
}
function pinProofValid(clientId: number, pinHash: string, proof: string | undefined): boolean {
  if (!proof) return false;
  const [expB36, sig] = proof.split(".");
  if (!expB36 || !sig) return false;
  const exp = parseInt(expB36, 36);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = createHmac("sha256", shareTokenSecret()).update(`pinok:${clientId}:${expB36}:${pinHash.slice(0, 12)}`).digest("hex").slice(0, 32);
  return sig === expected;
}
function readCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}
/** True se il cliente ha un PIN e la richiesta NON porta una prova valida. */
function pinBlocks(req: Request, client: ClientRow): boolean {
  if (!client.portalPinHash) return false;
  return !pinProofValid(client.id, client.portalPinHash, readCookie(req, `pp${client.id}`));
}

/** Middleware-style helper: risolve il token, applica il PIN, o risponde. */
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
  if (pinBlocks(req, result.client)) {
    res.status(401).json({ error: "PIN richiesto", pinRequired: true });
    return null;
  }
  return result.client;
}

// Info di base del cliente + sezioni. Il branding (nome/logo/colore) esce anche
// se il PIN non è ancora inserito, così la schermata PIN è brandizzata e la PWA
// si può installare. I DATI delle sezioni restano dietro il PIN (withClient).
router.get("/public/portal/:token", async (req, res): Promise<void> => {
  const result = await resolveClient(req.params.token as string);
  if (!result.client) {
    res.status(result.reason === "EXPIRED" ? 410 : 404).json({ error: "Link non valido o scaduto" });
    return;
  }
  const client = result.client;
  const brand = {
    name: client.name,
    logo: client.logoUrl ?? null,
    color: client.brandColor ?? client.color ?? "#7a8f5c",
    cover: client.coverUrl ?? null,
    driveUrl: client.driveUrl ?? null,
  };
  if (pinBlocks(req, client)) {
    res.json({ client: { name: client.name, logo: client.logoUrl ?? null, color: brand.color, cover: brand.cover }, pinRequired: true });
    return;
  }

  // Conteggi per le stat card della Home (prossimi contenuti, idee, report).
  const todayIso = new Date().toISOString().slice(0, 10);
  const [ideaCount] = await db
    .select({ n: count() })
    .from(clientContentIdeasTable)
    .where(eq(clientContentIdeasTable.clientId, client.id));
  const [reportCount] = await db
    .select({ n: count() })
    .from(clientReportsTable)
    .where(and(eq(clientReportsTable.clientId, client.id), ne(clientReportsTable.status, "bozza")));
  const clientPlans = await db
    .select({ id: editorialPlansTable.id })
    .from(editorialPlansTable)
    .where(and(eq(editorialPlansTable.clientId, client.id), isNull(editorialPlansTable.deletedAt)));
  let upcoming = 0;
  if (clientPlans.length) {
    const [slotCount] = await db
      .select({ n: count() })
      .from(editorialSlotsTable)
      .where(and(
        inArray(editorialSlotsTable.planId, clientPlans.map((p) => p.id)),
        isNull(editorialSlotsTable.deletedAt),
        gte(editorialSlotsTable.publishDate, todayIso),
      ));
    upcoming = Number(slotCount?.n ?? 0);
  }
  res.json({
    client: brand,
    sections: ["brief", "ideas", "events", "editorial", "reports", "files"],
    counts: {
      upcomingContent: upcoming,
      ideas: Number(ideaCount?.n ?? 0),
      reports: Number(reportCount?.n ?? 0),
    },
  });
});

// Verifica il PIN e rilascia il cookie di prova (30 giorni).
router.post("/public/portal/:token/verify-pin", async (req, res): Promise<void> => {
  const result = await resolveClient(req.params.token as string);
  if (!result.client) { res.status(404).json({ error: "Link non valido" }); return; }
  const client = result.client;
  if (!client.portalPinHash) { res.json({ ok: true }); return; } // nessun PIN impostato
  const pin = String((req.body as { pin?: unknown })?.pin ?? "").trim();
  if (!/^\d{4,6}$/.test(pin) || hashPortalPin(client.id, pin) !== client.portalPinHash) {
    res.status(403).json({ error: "PIN errato" });
    return;
  }
  const proof = pinProof(client.id, client.portalPinHash);
  res.setHeader("Set-Cookie", `pp${client.id}=${encodeURIComponent(proof)}; Path=/api/public/portal; Max-Age=${30 * 24 * 3600}; HttpOnly; SameSite=Lax; Secure`);
  res.json({ ok: true });
});

// Manifest PWA per-cliente: nome, colore e icone del cliente. Non protetto dal
// PIN (espone solo branding, non dati). Serve per installare col suo logo.
router.get("/public/portal/:token/manifest.webmanifest", async (req, res): Promise<void> => {
  const result = await resolveClient(req.params.token as string);
  if (!result.client) { res.status(404).json({ error: "Link non valido" }); return; }
  const client = result.client;
  const base = `/portal/${req.params.token}`;
  res.type("application/manifest+json").json({
    name: client.name,
    short_name: client.name.slice(0, 12),
    id: base,
    start_url: base,
    scope: base,
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f2e9",
    theme_color: "#7a8f5c",
    lang: "it-IT",
    // Icona = LOGO DEL CLIENTE: quando installa, sulla home ha la sua app col suo
    // logo e il suo nome. Se il logo manca, fallback al logo Be Kind.
    icons: client.logoUrl
      ? [
          { src: `/api/public/portal/${req.params.token}/icon.png`, sizes: "192x192", type: "image/png", purpose: "any" },
          { src: `/api/public/portal/${req.params.token}/icon.png`, sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ]
      : [
          { src: "/logo-bekind.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/logo-bekind.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
  });
});

// Icona del cliente (dal logo). PNG servito così com'è: se il logo non è
// quadrato/opaco l'icona resta usabile ma non perfetta (vedi nota all'agenzia).
router.get("/public/portal/:token/icon.png", async (req, res): Promise<void> => {
  const result = await resolveClient(req.params.token as string);
  const logo = result.client?.logoUrl ?? "";
  const m = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i.exec(logo);
  if (!m) { res.status(404).end(); return; }
  const buf = Buffer.from(m[2], "base64");
  res.setHeader("Content-Type", `image/${m[1] === "jpg" ? "jpeg" : m[1]}`);
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.end(buf);
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

// Il cliente aggiunge i suoi prossimi eventi e collaborazioni. Finisce nella
// stessa tabella eventi che vede l'agenzia, così sono subito visibili a tutti.
router.post("/public/portal/:token/events", async (req, res): Promise<void> => {
  const client = await withClient(req, res);
  if (!client) return;
  const body = req.body as { title?: unknown; date?: unknown; type?: unknown; note?: unknown };
  const title = String(body.title ?? "").trim();
  const dateStr = String(body.date ?? "").trim();
  const type = ["collaborazione", "evento"].includes(String(body.type)) ? String(body.type) : "evento";
  const note = body.note != null ? String(body.note).trim().slice(0, 1000) : null;
  if (title.length < 2 || title.length > 200) { res.status(400).json({ error: "Titolo non valido" }); return; }
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) { res.status(400).json({ error: "Data non valida" }); return; }

  const [row] = await db.insert(clientEventsTable).values({
    clientId: client.id,
    title,
    date,
    type,
    priority: "medium",
    note: note || null,
  }).returning();
  res.status(201).json({
    id: String(row.id), title: row.title, date: row.date.toISOString(),
    endDate: null, type: row.type, priority: row.priority, note: row.note ?? null,
  });
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
      // Lo script è ciò che il cliente deve poter leggere prima di girare.
      script: s.script ?? null,
      // visualUrl = anteprima del contenuto (la thumbnail che dà il look "app").
      // Non è sensibile: è ciò che verrà pubblicato. notesInternal resta interno.
      visualUrl: s.visualUrl ?? null,
      visualDescription: s.visualDescription ?? null,
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
  const parseJson = (v: unknown) => {
    if (v == null) return null;
    if (typeof v === "object") return v;
    try { return JSON.parse(String(v)); } catch { return null; }
  };
  res.json(
    rows.map((r) => ({
      id: r.id,
      titolo: r.titolo ?? r.periodLabel ?? "Report",
      period: r.periodLabel ?? r.period ?? null,
      periodoInizio: r.periodoInizio ? new Date(r.periodoInizio as any).toISOString() : null,
      periodoFine: r.periodoFine ? new Date(r.periodoFine as any).toISOString() : null,
      status: r.status,
      // Contenuto ricco client-facing (già curato dall'agenzia). Esclusi di
      // proposito: aiSummary/aiFlags, noteAggiuntive, metricsJson (interni).
      riepilogoEsecutivo: r.riepilogoEsecutivo ?? null,
      analisiInsights: r.analisiInsights ?? null,
      strategiaProssimoPeriodo: r.strategiaProssimoPeriodo ?? null,
      kpiSocial: parseJson(r.kpiSocialJson),
      kpiMeta: parseJson(r.kpiMetaJson),
      kpiGoogle: parseJson(r.kpiGoogleJson),
      topContenuti: parseJson(r.topContenutiJson),
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

  // "Consegne": aggreghiamo tutto ciò che il cliente può scaricare, così la
  // sezione è utile anche senza progetti (i file oggi sono legati al progetto).
  const items: Array<{ id: string; name: string; url: string; type: string; createdAt: string | null }> = [];
  for (const f of files) {
    items.push({ id: `file-${f.id}`, name: f.name, url: f.url, type: f.type ?? "file", createdAt: f.createdAt ? new Date(f.createdAt as any).toISOString() : null });
  }
  const reportPdfs = await db
    .select({ id: clientReportsTable.id, label: clientReportsTable.periodLabel, url: clientReportsTable.pdfUrl, at: clientReportsTable.createdAt })
    .from(clientReportsTable)
    .where(and(eq(clientReportsTable.clientId, client.id), ne(clientReportsTable.status, "bozza")));
  for (const r of reportPdfs) {
    if (r.url) items.push({ id: `report-${r.id}`, name: `Report ${r.label ?? ""}`.trim(), url: r.url, type: "pdf", createdAt: r.at ? new Date(r.at as any).toISOString() : null });
  }
  const planPdfs = await db
    .select({ id: editorialPlansTable.id, month: editorialPlansTable.month, year: editorialPlansTable.year, url: editorialPlansTable.pdfUrl, at: editorialPlansTable.createdAt })
    .from(editorialPlansTable)
    .where(and(eq(editorialPlansTable.clientId, client.id), isNull(editorialPlansTable.deletedAt)));
  for (const p of planPdfs) {
    if (p.url) items.push({ id: `plan-${p.id}`, name: `Piano editoriale ${p.month}/${p.year}`, url: p.url, type: "pdf", createdAt: p.at ? new Date(p.at as any).toISOString() : null });
  }
  items.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  res.json({ driveUrl: client.driveUrl ?? null, files: items });
});

/* ── CHAT cliente↔agenzia (lettura + invio) ──────────────────── */
router.get("/public/portal/:token/messages", async (req, res): Promise<void> => {
  const client = await withClient(req, res);
  if (!client) return;
  const rows = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.clientId, client.id))
    .orderBy(asc(messagesTable.createdAt));
  res.json(rows.map((m) => ({
    id: m.id,
    content: m.content,
    authorName: m.authorName,
    source: m.source,
    createdAt: m.createdAt.toISOString(),
  })));
});

router.post("/public/portal/:token/messages", async (req, res): Promise<void> => {
  const client = await withClient(req, res);
  if (!client) return;
  const content = String((req.body as { content?: unknown })?.content ?? "").trim();
  if (content.length < 1 || content.length > 4000) { res.status(400).json({ error: "Messaggio non valido" }); return; }
  const [row] = await db.insert(messagesTable).values({
    content,
    clientId: client.id,
    source: "client",
    authorName: client.name,
    authorColor: client.brandColor ?? client.color ?? "#7a8f5c",
  }).returning();
  res.status(201).json({
    id: row.id, content: row.content, authorName: row.authorName, source: row.source, createdAt: row.createdAt.toISOString(),
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
      category: i.category,
      notes: i.notes ?? null,
      createdAt: i.createdAt ? i.createdAt.toISOString() : null,
    })),
  );
});

router.post("/public/portal/:token/ideas", async (req, res): Promise<void> => {
  const client = await withClient(req, res);
  if (!client) return;

  const body = (req.body ?? {}) as { title?: unknown; url?: unknown; notes?: unknown; category?: unknown };
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : "";
  // Il cliente sceglie la categoria da una tendina, ma qui non c'è login:
  // qualunque valore fuori lista ricade su 'da_classificare' (vedi lib/ideas.ts).
  const category = normalizeCategory(body.category);

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
      category,
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
      category: created.category,
      notes: created.notes ?? null,
      createdAt: created.createdAt ? created.createdAt.toISOString() : null,
    });
  } catch {
    res.status(500).json({ error: "Errore nel salvataggio dell'idea" });
  }
});

export default router;
