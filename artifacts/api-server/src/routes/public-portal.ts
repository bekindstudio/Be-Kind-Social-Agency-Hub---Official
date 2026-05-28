import { Router, type IRouter, type Request, type Response } from "express";
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
} from "@workspace/db";

/**
 * Area cliente condivisa SENZA login.
 * Accesso tramite token (clients.share_token) nell'URL: /api/public/portal/:token/...
 * Espone SOLO i dati del cliente del token e SOLO le sezioni consentite:
 *  - brief: lettura + scrittura (il cliente lo compila)
 *  - eventi / editoriale / report / file: sola lettura
 * Montato sotto /api/public/* → fuori dal gate di login (il token è la chiave).
 */
const router: IRouter = Router();

type ClientRow = typeof clientsTable.$inferSelect;

async function resolveClient(token: string): Promise<ClientRow | null> {
  const t = (token ?? "").trim();
  if (!t || t.length < 16) return null;
  const [client] = await db
    .select()
    .from(clientsTable)
    .where(and(eq(clientsTable.shareToken, t), isNull(clientsTable.deletedAt)));
  return client ?? null;
}

/** Middleware-style helper: risolve il token o risponde 404/410. */
async function withClient(req: Request, res: Response): Promise<ClientRow | null> {
  const client = await resolveClient(req.params.token as string);
  if (!client) {
    res.status(404).json({ error: "Link non valido o revocato" });
    return null;
  }
  return client;
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
    sections: ["brief", "events", "editorial", "reports", "files"],
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

export default router;
