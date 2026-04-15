import { Router, type IRouter } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { db, quoteTemplatesTable, clientsTable } from "@workspace/db";
import {
  CreateQuoteTemplateBody,
  UpdateQuoteTemplateBody,
} from "@workspace/api-zod";
import { getUserId, getAccessibleClientIds, filterByClientAccess } from "../lib/access-control";
import { softDeleteRecord } from "../lib/trash-service";
import { validate } from "../middlewares/validate";

const router: IRouter = Router();

function parseId(raw: string): number | null {
  const n = parseInt(raw, 10);
  return isNaN(n) || n <= 0 ? null : n;
}

function computeTotals(items: Array<{ description: string; quantity: number; unitPrice: number }>, taxRate: number) {
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const total = subtotal * (1 + taxRate / 100);
  return { subtotal, total };
}

async function enrichQuote(q: typeof quoteTemplatesTable.$inferSelect) {
  const rawItems = (Array.isArray(q.items) ? q.items : []) as Array<{ description: string; quantity: number; unitPrice: number }>;
  const items = rawItems.map((i) => ({ ...i, total: i.quantity * i.unitPrice }));
  const { subtotal, total } = computeTotals(rawItems, q.taxRate);
  let clientName: string | null = null;
  if (q.clientId) {
    const [c] = await db
      .select({ name: clientsTable.name })
      .from(clientsTable)
      .where(and(eq(clientsTable.id, q.clientId), isNull(clientsTable.deletedAt)));
    clientName = c?.name ?? null;
  }
  return {
    ...q,
    items,
    subtotal,
    total,
    clientName,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
  };
}

function canAccessClient(clientId: number | null | undefined, accessible: number[] | "all"): boolean {
  if (accessible === "all") return true;
  if (!clientId) return true;
  return accessible.includes(clientId);
}

router.get("/quotes", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const rows = await db
    .select()
    .from(quoteTemplatesTable)
    .where(isNull(quoteTemplatesTable.deletedAt))
    .orderBy(quoteTemplatesTable.createdAt);
  const accessible = userId ? await getAccessibleClientIds(userId) : "all" as const;
  const filtered = filterByClientAccess(rows, accessible);
  const enriched = await Promise.all(filtered.map(enrichQuote));
  res.json(enriched);
});

router.post("/quotes", validate(CreateQuoteTemplateBody), async (req, res): Promise<void> => {
  const data = req.body as typeof CreateQuoteTemplateBody._type;
  const userId = getUserId(req);
  if (userId) {
    const accessible = await getAccessibleClientIds(userId);
    if (!canAccessClient(data.clientId ?? null, accessible)) {
      res.status(403).json({ error: "Accesso negato al cliente selezionato" });
      return;
    }
  }
  const items = (data.items ?? []) as Array<{ description: string; quantity: number; unitPrice: number }>;
  const [row] = await db.insert(quoteTemplatesTable).values({
    name: data.name,
    clientId: data.clientId ?? null,
    status: data.status ?? "bozza",
    validityDays: data.validityDays ?? 30,
    notes: data.notes ?? null,
    items,
    taxRate: data.taxRate ?? 22,
  }).returning();
  res.status(201).json(await enrichQuote(row));
});

router.get("/quotes/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db
    .select()
    .from(quoteTemplatesTable)
    .where(and(eq(quoteTemplatesTable.id, id), isNull(quoteTemplatesTable.deletedAt)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }

  const userId = getUserId(req);
  if (userId && row.clientId) {
    const accessible = await getAccessibleClientIds(userId);
    if (accessible !== "all" && !accessible.includes(row.clientId)) {
      res.status(403).json({ error: "Accesso negato" });
      return;
    }
  }

  res.json(await enrichQuote(row));
});

router.patch("/quotes/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateQuoteTemplateBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updates: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.name != null) updates.name = d.name;
  if (d.clientId !== undefined) updates.clientId = d.clientId;
  if (d.status != null) updates.status = d.status;
  if (d.validityDays != null) updates.validityDays = d.validityDays;
  if (d.notes !== undefined) updates.notes = d.notes;
  if (d.items != null) updates.items = d.items;
  if (d.taxRate != null) updates.taxRate = d.taxRate;

  const [existing] = await db
    .select()
    .from(quoteTemplatesTable)
    .where(and(eq(quoteTemplatesTable.id, id), isNull(quoteTemplatesTable.deletedAt)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const userId = getUserId(req);
  if (userId) {
    const accessible = await getAccessibleClientIds(userId);
    if (!canAccessClient(existing.clientId, accessible)) {
      res.status(403).json({ error: "Accesso negato" });
      return;
    }
    const targetClientId = d.clientId !== undefined ? (d.clientId ?? null) : (existing.clientId ?? null);
    if (!canAccessClient(targetClientId, accessible)) {
      res.status(403).json({ error: "Accesso negato al cliente selezionato" });
      return;
    }
  }

  const [row] = await db.update(quoteTemplatesTable).set(updates).where(eq(quoteTemplatesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await enrichQuote(row));
});

router.post("/quotes/:id/duplicate", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const [orig] = await db
    .select()
    .from(quoteTemplatesTable)
    .where(and(eq(quoteTemplatesTable.id, id), isNull(quoteTemplatesTable.deletedAt)));
  if (!orig) { res.status(404).json({ error: "Not found" }); return; }
  const userId = getUserId(req);
  if (userId) {
    const accessible = await getAccessibleClientIds(userId);
    if (!canAccessClient(orig.clientId, accessible)) {
      res.status(403).json({ error: "Accesso negato" });
      return;
    }
  }
  const [copy] = await db.insert(quoteTemplatesTable).values({
    name: orig.name + " (Copia)",
    clientId: orig.clientId,
    status: "bozza",
    validityDays: orig.validityDays,
    notes: orig.notes,
    items: orig.items,
    taxRate: orig.taxRate,
  }).returning();
  res.status(201).json(await enrichQuote(copy));
});

router.delete("/quotes/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const userId = getUserId(req);
  const [row] = await db
    .select()
    .from(quoteTemplatesTable)
    .where(and(eq(quoteTemplatesTable.id, id), isNull(quoteTemplatesTable.deletedAt)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  if (userId) {
    const accessible = await getAccessibleClientIds(userId);
    if (!canAccessClient(row.clientId, accessible)) {
      res.status(403).json({ error: "Accesso negato" });
      return;
    }
  }
  const r = await softDeleteRecord("quote_templates", String(id), { deletedBy: userId });
  if (!r.ok) {
    res.status(r.error === "Non trovato" ? 404 : 400).json({ error: r.error });
    return;
  }
  res.json({ ok: true, trashLogId: r.trashLogId, message: "Spostato nel cestino" });
});

export default router;
