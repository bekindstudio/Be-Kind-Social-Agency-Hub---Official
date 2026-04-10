import { Router, type IRouter } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { db, contractTemplatesTable } from "@workspace/db";
import {
  CreateContractTemplateBody,
  UpdateContractTemplateBody,
} from "@workspace/api-zod";
import { z } from "zod";
import { getUserId } from "../lib/access-control";
import { softDeleteRecord } from "../lib/trash-service";

const router: IRouter = Router();

function parseId(raw: string): number | null {
  const n = parseInt(raw, 10);
  return isNaN(n) || n <= 0 ? null : n;
}

const variablesSchema = z.array(z.string());

function parseVariables(body: unknown): string[] {
  const v = (body as { variables?: unknown })?.variables;
  const r = variablesSchema.safeParse(v);
  return r.success ? r.data : [];
}

function serializeContract(c: typeof contractTemplatesTable.$inferSelect) {
  const vars = Array.isArray(c.variables) ? c.variables : [];
  return {
    ...c,
    variables: vars,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

router.get("/contracts", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(contractTemplatesTable)
    .where(isNull(contractTemplatesTable.deletedAt))
    .orderBy(contractTemplatesTable.createdAt);
  res.json(rows.map(serializeContract));
});

router.post("/contracts", async (req, res): Promise<void> => {
  const parsed = CreateContractTemplateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  const variables = parseVariables(req.body);
  const [row] = await db.insert(contractTemplatesTable).values({
    name: d.name,
    type: d.type ?? "Servizi",
    content: d.content ?? "",
    status: d.status ?? "bozza",
    variables,
  }).returning();
  res.status(201).json(serializeContract(row));
});

router.get("/contracts/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db
    .select()
    .from(contractTemplatesTable)
    .where(and(eq(contractTemplatesTable.id, id), isNull(contractTemplatesTable.deletedAt)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serializeContract(row));
});

router.patch("/contracts/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateContractTemplateBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updates: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.name != null) updates.name = d.name;
  if (d.type != null) updates.type = d.type;
  if (d.content != null) updates.content = d.content;
  if (d.status != null) updates.status = d.status;
  const vars = parseVariables(req.body);
  if ((req.body as { variables?: unknown }).variables !== undefined) {
    updates.variables = vars;
  }

  const [ex] = await db
    .select()
    .from(contractTemplatesTable)
    .where(and(eq(contractTemplatesTable.id, id), isNull(contractTemplatesTable.deletedAt)));
  if (!ex) { res.status(404).json({ error: "Not found" }); return; }

  const [row] = await db.update(contractTemplatesTable).set(updates).where(eq(contractTemplatesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serializeContract(row));
});

router.delete("/contracts/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const userId = getUserId(req);
  const r = await softDeleteRecord("contract_templates", String(id), { deletedBy: userId });
  if (!r.ok) {
    res.status(r.error === "Non trovato" ? 404 : 400).json({ error: r.error });
    return;
  }
  res.json({ ok: true, trashLogId: r.trashLogId, message: "Spostato nel cestino" });
});

export default router;
