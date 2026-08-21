import { Router, type IRouter } from "express";
import { eq, and, sql, desc, isNotNull, inArray, isNull } from "drizzle-orm";
import { db, contractDocumentsTable, contractChangeRequestsTable, clientsTable } from "@workspace/db";
import { z } from "zod";
import { getUserId } from "../lib/access-control";
import { softDeleteRecord } from "../lib/trash-service";
import { sendEmail } from "../lib/mailer";

const router: IRouter = Router();

// Login obbligatorio su tutti i documenti contratto (path scopato).
router.use("/contract-documents", (req, res, next) => {
  if (!getUserId(req)) { res.status(401).json({ error: "Non autenticato" }); return; }
  next();
});

const CreateBody = z.object({
  templateId: z.number().int().positive().nullable().optional(),
  clientId: z.number().int().positive().nullable().optional(),
  clientName: z.string().min(1),
  clientEmail: z.string().optional().nullable(),
  clientVat: z.string().optional().nullable(),
  clientAddress: z.string().optional().nullable(),
  serviceType: z.string().min(1),
  content: z.string().min(1),
  status: z.enum(["bozza", "inviato", "firmato", "scaduto"]).optional(),
  value: z.union([z.number(), z.string()]).optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  signedAt: z.string().optional().nullable(),
  contractNumber: z.string().optional(),
});

const UpdateBody = z
  .object({
    templateId: z.number().int().positive().nullable().optional(),
    clientId: z.number().int().positive().nullable().optional(),
    clientName: z.string().min(1).optional(),
    clientEmail: z.string().nullable().optional(),
    clientVat: z.string().nullable().optional(),
    clientAddress: z.string().nullable().optional(),
    serviceType: z.string().min(1).optional(),
    content: z.string().min(1).optional(),
    status: z.enum(["bozza", "inviato", "firmato", "scaduto"]).optional(),
    value: z.union([z.number(), z.string()]).nullable().optional(),
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
    signedAt: z.string().nullable().optional(),
  });

function parseUuid(raw: string): string | null {
  const u = raw.trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(u)) return null;
  return u;
}

async function getNextAgzNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await db
    .select({ num: contractDocumentsTable.contractNumber })
    .from(contractDocumentsTable)
    .where(
      and(
        isNull(contractDocumentsTable.deletedAt),
        sql`${contractDocumentsTable.contractNumber} LIKE ${`AGZ-${year}-%`}`,
      ),
    );
  const nums = rows
    .map((r) => {
      const parts = r.num.split("-");
      return parseInt(parts[2] ?? "0", 10);
    })
    .filter((n) => !isNaN(n));
  const maxNum = nums.length > 0 ? Math.max(...nums) : 0;
  return `AGZ-${year}-${String(maxNum + 1).padStart(3, "0")}`;
}

async function autoMarkExpired() {
  const today = new Date().toISOString().slice(0, 10);
  await db
    .update(contractDocumentsTable)
    .set({ status: "scaduto", updatedAt: new Date() })
    .where(
      and(
        isNull(contractDocumentsTable.deletedAt),
        inArray(contractDocumentsTable.status, ["inviato", "firmato"]),
        isNotNull(contractDocumentsTable.endDate),
        sql`${contractDocumentsTable.endDate} < ${today}`
      )
    );
}

function rowDateStr(d: unknown): string {
  if (d == null) return "";
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

function serializeDoc(row: typeof contractDocumentsTable.$inferSelect) {
  return {
    id: row.id,
    contractNumber: row.contractNumber,
    templateId: row.templateId,
    clientId: row.clientId,
    clientName: row.clientName,
    clientEmail: row.clientEmail,
    clientVat: row.clientVat,
    clientAddress: row.clientAddress,
    serviceType: row.serviceType,
    content: row.content,
    status: row.status,
    value: row.value != null ? String(row.value) : null,
    startDate: row.startDate != null ? rowDateStr(row.startDate) : null,
    endDate: row.endDate != null ? rowDateStr(row.endDate) : null,
    sentAt: row.sentAt?.toISOString() ?? null,
    signedAt: row.signedAt?.toISOString() ?? null,
    signedName: row.signedName,
    signedIp: row.signedIp,
    signedUserAgent: row.signedUserAgent,
    signedHash: row.signedHash,
    vexatiousAcceptedAt: row.vexatiousAcceptedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

router.get("/contract-documents/stats", async (_req, res): Promise<void> => {
  await autoMarkExpired();
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const in30s = in30.toISOString().slice(0, 10);

  const all = await db
    .select()
    .from(contractDocumentsTable)
    .where(isNull(contractDocumentsTable.deletedAt));

  const active = all.filter((c) => {
    if (c.status !== "firmato") return false;
    const end = rowDateStr(c.endDate);
    return !end || end >= today;
  });
  const signedValue = active.reduce((s, c) => s + (c.value != null ? parseFloat(String(c.value)) : 0), 0);

  const expiring = all.filter((c) => {
    if (c.status !== "firmato") return false;
    const end = rowDateStr(c.endDate);
    return Boolean(end) && end >= today && end <= in30s;
  });

  const awaiting = all.filter((c) => c.status === "inviato").length;

  res.json({
    activeCount: active.length,
    signedValueTotal: signedValue,
    expiring30Count: expiring.length,
    awaitingSignatureCount: awaiting,
  });
});

router.get("/contract-documents", async (req, res): Promise<void> => {
  await autoMarkExpired();
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const serviceType = typeof req.query.serviceType === "string" ? req.query.serviceType : undefined;
  const month = typeof req.query.month === "string" ? req.query.month : undefined;
  const clientId = typeof req.query.clientId === "string" ? parseInt(req.query.clientId, 10) : NaN;

  const conditions = [isNull(contractDocumentsTable.deletedAt)];
  if (Number.isFinite(clientId) && clientId > 0) {
    conditions.push(eq(contractDocumentsTable.clientId, clientId));
  }
  if (status && status !== "tutti") {
    conditions.push(eq(contractDocumentsTable.status, status));
  }
  if (serviceType && serviceType !== "tutti") {
    conditions.push(eq(contractDocumentsTable.serviceType, serviceType));
  }
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    conditions.push(sql`to_char(${contractDocumentsTable.createdAt}, 'YYYY-MM') = ${month}`);
  }

  const base = db.select().from(contractDocumentsTable);
  const rows = await base.where(and(...conditions)).orderBy(desc(contractDocumentsTable.createdAt));

  res.json(rows.map(serializeDoc));
});

router.post("/contract-documents", async (req, res): Promise<void> => {
  const parsed = CreateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  const contractNumber = d.contractNumber?.trim() || (await getNextAgzNumber());
  const valueStr =
    d.value === undefined || d.value === null
      ? null
      : typeof d.value === "number"
        ? d.value.toFixed(2)
        : String(d.value);

  const [row] = await db
    .insert(contractDocumentsTable)
    .values({
      contractNumber,
      templateId: d.templateId ?? null,
      clientId: d.clientId ?? null,
      clientName: d.clientName,
      clientEmail: d.clientEmail ?? null,
      clientVat: d.clientVat ?? null,
      clientAddress: d.clientAddress ?? null,
      serviceType: d.serviceType,
      content: d.content,
      status: d.status ?? "bozza",
      value: valueStr,
      startDate: d.startDate || null,
      endDate: d.endDate || null,
      signedAt: d.signedAt ? new Date(d.signedAt) : null,
    })
    .returning();

  res.status(201).json(serializeDoc(row));
});

router.get("/contract-documents/:id", async (req, res): Promise<void> => {
  const id = parseUuid(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db
    .select()
    .from(contractDocumentsTable)
    .where(and(eq(contractDocumentsTable.id, id), isNull(contractDocumentsTable.deletedAt)));
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(serializeDoc(row));
});

router.patch("/contract-documents/:id", async (req, res): Promise<void> => {
  const id = parseUuid(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = UpdateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  const updates: Record<string, unknown> = {};
  if (d.templateId !== undefined) updates.templateId = d.templateId;
  if (d.clientId !== undefined) updates.clientId = d.clientId;
  if (d.clientName !== undefined) updates.clientName = d.clientName;
  if (d.clientEmail !== undefined) updates.clientEmail = d.clientEmail;
  if (d.clientVat !== undefined) updates.clientVat = d.clientVat;
  if (d.clientAddress !== undefined) updates.clientAddress = d.clientAddress;
  if (d.serviceType !== undefined) updates.serviceType = d.serviceType;
  if (d.content !== undefined) updates.content = d.content;
  if (d.status !== undefined) updates.status = d.status;
  if (d.value !== undefined) {
    updates.value =
      d.value === null
        ? null
        : typeof d.value === "number"
          ? d.value.toFixed(2)
          : String(d.value);
  }
  if (d.startDate !== undefined) updates.startDate = d.startDate || null;
  if (d.endDate !== undefined) updates.endDate = d.endDate || null;
  if (d.signedAt !== undefined) updates.signedAt = d.signedAt ? new Date(d.signedAt) : null;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No updates" });
    return;
  }

  const [ex] = await db
    .select()
    .from(contractDocumentsTable)
    .where(and(eq(contractDocumentsTable.id, id), isNull(contractDocumentsTable.deletedAt)));
  if (!ex) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const [row] = await db
    .update(contractDocumentsTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(contractDocumentsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(serializeDoc(row));
});

router.delete("/contract-documents/:id", async (req, res): Promise<void> => {
  const id = parseUuid(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = getUserId(req);
  const r = await softDeleteRecord("contract_documents", id, { deletedBy: userId });
  if (!r.ok) {
    res.status(r.error === "Non trovato" ? 404 : 400).json({ error: r.error });
    return;
  }
  res.json({ ok: true, trashLogId: r.trashLogId, message: "Spostato nel cestino" });
});

router.post("/contract-documents/:id/duplicate", async (req, res): Promise<void> => {
  const id = parseUuid(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [orig] = await db
    .select()
    .from(contractDocumentsTable)
    .where(and(eq(contractDocumentsTable.id, id), isNull(contractDocumentsTable.deletedAt)));
  if (!orig) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const clientName =
    typeof (req.body as { clientName?: string })?.clientName === "string"
      ? (req.body as { clientName: string }).clientName
      : `${orig.clientName} (copia)`;
  const numero = await getNextAgzNumber();

  const [row] = await db
    .insert(contractDocumentsTable)
    .values({
      contractNumber: numero,
      templateId: orig.templateId,
      clientId: orig.clientId,
      clientName,
      clientEmail: orig.clientEmail,
      clientVat: orig.clientVat,
      clientAddress: orig.clientAddress,
      serviceType: orig.serviceType,
      content: orig.content,
      status: "bozza",
      value: orig.value,
      startDate: orig.startDate,
      endDate: orig.endDate,
      signedAt: null,
    })
    .returning();

  res.status(201).json(serializeDoc(row));
});

/* ── Wave DP: invio al portale + gestione proposte di modifica ────────── */

// Invia il contratto al portale del cliente: status → "inviato" + email al
// cliente (se ha un'email e un link portale attivo). Richiede clientId.
router.post("/contract-documents/:id/send", async (req, res): Promise<void> => {
  const id = parseUuid(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }

  const [doc] = await db.select().from(contractDocumentsTable)
    .where(and(eq(contractDocumentsTable.id, id), isNull(contractDocumentsTable.deletedAt)));
  if (!doc) { res.status(404).json({ error: "Not found" }); return; }
  if (!doc.clientId) { res.status(400).json({ error: "Collega prima il contratto a un cliente" }); return; }
  if (doc.status === "firmato") { res.status(409).json({ error: "Contratto già firmato" }); return; }

  const [row] = await db.update(contractDocumentsTable)
    .set({ status: "inviato", sentAt: new Date(), updatedAt: new Date() })
    .where(eq(contractDocumentsTable.id, id))
    .returning();

  // Email al cliente col link al suo portale (best effort, non blocca).
  let emailSent = false;
  const [client] = await db.select().from(clientsTable)
    .where(and(eq(clientsTable.id, doc.clientId), isNull(clientsTable.deletedAt)));
  const to = (doc.clientEmail ?? client?.email ?? "").trim();
  if (to && client?.shareToken) {
    const base = (process.env.PORTAL_PUBLIC_URL ?? "").replace(/\/+$/, "") || `https://${req.get("host")}`;
    const link = `${base}/portal/${client.shareToken}`;
    const r = await sendEmail(
      to,
      `[Be Kind] Contratto ${doc.contractNumber} pronto per la tua revisione e firma`,
      "Il tuo contratto è pronto",
      `<p>Ciao${client?.name ? ` <strong>${client.name}</strong>` : ""},</p><p>il contratto <strong>${doc.contractNumber}</strong> è pronto nella tua area riservata: puoi leggerlo, proporre modifiche e firmarlo online.</p><p><a class="cta" href="${link}">Apri la tua area</a></p><p>Se il pulsante non funziona, copia questo link: ${link}</p>`,
    );
    emailSent = r.sent;
  }

  res.json({ ...serializeDoc(row), emailSent });
});

// Proposte di modifica del contratto (lettura per il cockpit).
router.get("/contract-documents/:id/change-requests", async (req, res): Promise<void> => {
  const id = parseUuid(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const rows = await db.select().from(contractChangeRequestsTable)
    .where(eq(contractChangeRequestsTable.contractId, id))
    .orderBy(desc(contractChangeRequestsTable.createdAt));
  res.json(rows.map((r) => ({
    id: r.id, contractId: r.contractId, message: r.message, status: r.status,
    reply: r.reply, createdAt: r.createdAt.toISOString(),
  })));
});

// Accetta/rifiuta una proposta (con risposta facoltativa al cliente).
const ChangeRequestDecision = z.object({
  status: z.enum(["accettata", "rifiutata"]),
  reply: z.string().max(4000).optional().nullable(),
});
router.patch("/contract-documents/change-requests/:reqId", async (req, res): Promise<void> => {
  const reqId = parseInt(String(req.params.reqId), 10);
  if (!Number.isFinite(reqId) || reqId <= 0) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = ChangeRequestDecision.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [row] = await db.update(contractChangeRequestsTable)
    .set({ status: parsed.data.status, reply: parsed.data.reply ?? null, updatedAt: new Date() })
    .where(eq(contractChangeRequestsTable.id, reqId))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ id: row.id, status: row.status, reply: row.reply });
});

export default router;
