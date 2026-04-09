import { Router, type IRouter } from "express";
import { eq, asc, sql } from "drizzle-orm";
import { db, contractsTable, clientsTable } from "@workspace/db";
import { z } from "zod";
import { getUserId, getAccessibleClientIds, filterByClientAccess } from "../lib/access-control";

const CreateClientContractBody = z.object({
  clientId: z.number(),
  numero: z.string().optional(),
  referenteCliente: z.string().optional(),
  oggetto: z.string().optional(),
  dataStipula: z.string(),
  dataInizio: z.string(),
  dataFine: z.string(),
  preavvisoGiorni: z.number().optional(),
  serviziJson: z.string().optional(),
  tranchePagamentoJson: z.string().optional(),
  importoTotale: z.number().optional(),
  clausoleJson: z.string().optional(),
  noteIva: z.string().optional(),
  iban: z.string().optional(),
  marcaDaBollo: z.number().optional(),
  stato: z.string().optional(),
  note: z.string().optional(),
});

const UpdateClientContractBody = z.object({
  numero: z.string().optional(),
  clientId: z.number().optional(),
  referenteCliente: z.string().optional(),
  oggetto: z.string().optional(),
  dataStipula: z.string().optional(),
  dataInizio: z.string().optional(),
  dataFine: z.string().optional(),
  preavvisoGiorni: z.number().optional(),
  serviziJson: z.string().optional(),
  tranchePagamentoJson: z.string().optional(),
  importoTotale: z.number().optional(),
  clausoleJson: z.string().optional(),
  noteIva: z.string().optional(),
  iban: z.string().optional(),
  marcaDaBollo: z.number().optional(),
  stato: z.string().optional(),
  note: z.string().optional(),
});

const router: IRouter = Router();

function parseId(raw: string): number | null {
  const n = parseInt(raw, 10);
  return isNaN(n) || n <= 0 ? null : n;
}

function serializeContract(c: Record<string, unknown> & { createdAt: Date; updatedAt: Date; clientName?: string | null }) {
  return {
    ...c,
    clientName: c.clientName ?? "",
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

async function autoUpdateExpired() {
  const today = new Date().toISOString().slice(0, 10);
  await db
    .update(contractsTable)
    .set({ stato: "scaduto" })
    .where(
      sql`${contractsTable.stato} NOT IN ('rescisso', 'scaduto') AND ${contractsTable.dataFine} < ${today}`
    );
}

async function getNextNumero(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await db
    .select()
    .from(contractsTable)
    .where(sql`${contractsTable.numero} LIKE ${`CONT-${year}-%`}`)
    .orderBy(asc(contractsTable.id));
  const nums = rows.map((r) => {
    const parts = r.numero.split("-");
    return parseInt(parts[2] ?? "0", 10);
  }).filter((n) => !isNaN(n));
  const maxNum = nums.length > 0 ? Math.max(...nums) : 0;
  return `CONT-${year}-${String(maxNum + 1).padStart(3, "0")}`;
}

async function seedIfEmpty() {
  const existing = await db.select().from(contractsTable).limit(1);
  if (existing.length > 0) return;

  const clients = await db.select().from(clientsTable).limit(3);
  if (clients.length === 0) return;

  const year = new Date().getFullYear();
  const today = new Date().toISOString().slice(0, 10);
  const in6m = new Date(); in6m.setMonth(in6m.getMonth() + 6);
  const in1y = new Date(); in1y.setFullYear(in1y.getFullYear() + 1);
  const past1m = new Date(); past1m.setMonth(past1m.getMonth() - 1);
  const past6m = new Date(); past6m.setMonth(past6m.getMonth() - 6);
  const in25d = new Date(); in25d.setDate(in25d.getDate() + 25);

  const seeds = [
    {
      numero: `CONT-${year}-001`,
      clientId: clients[0].id,
      referenteCliente: "Marco Rossi",
      oggetto: "Contratto Gestione Social e ADV",
      dataStipula: past6m.toISOString().slice(0, 10),
      dataInizio: past6m.toISOString().slice(0, 10),
      dataFine: in6m.toISOString().slice(0, 10),
      preavvisoGiorni: 30,
      serviziJson: JSON.stringify([
        { id: "s1", titolo: "Gestione Social", attiva: true, descrizione: "Gestione Instagram e Facebook con 3 post/settimana e stories quotidiane", canali: ["Instagram", "Facebook"] },
        { id: "s2", titolo: "Campagne Advertising", attiva: true, descrizione: "Gestione campagne Meta Ads con ottimizzazione settimanale", piattaforme: ["Meta Ads"] },
        { id: "s3", titolo: "Reportistica", attiva: true, descrizione: "Report mensile con analisi KPI e raccomandazioni strategiche", frequenza: "mensile" },
      ]),
      tranchePagamentoJson: JSON.stringify([
        { data: `${year}-01-30`, importo: 225000, descrizione: "1^ tranche" },
        { data: `${year}-04-30`, importo: 225000, descrizione: "2^ tranche" },
        { data: `${year}-07-30`, importo: 225000, descrizione: "3^ tranche" },
        { data: `${year}-10-30`, importo: 225000, descrizione: "4^ tranche" },
      ]),
      importoTotale: 900000,
      clausoleJson: JSON.stringify({ rescissione: "Preavviso scritto di 30 giorni", riservatezza: "Clausola standard" }),
      noteIva: "Importi non soggetti a IVA ai sensi dell'art. 1, commi 54-89, Legge n. 190/2014",
      iban: "IT60X0542811101000000123456",
      marcaDaBollo: 1,
      stato: "firmato",
    },
    {
      numero: `CONT-${year}-002`,
      clientId: (clients[1] ?? clients[0]).id,
      referenteCliente: "Giulia Ferrari",
      oggetto: "Contratto Produzione Contenuti e Strategia",
      dataStipula: past1m.toISOString().slice(0, 10),
      dataInizio: today,
      dataFine: in1y.toISOString().slice(0, 10),
      preavvisoGiorni: 30,
      serviziJson: JSON.stringify([
        { id: "s1", titolo: "Analisi e Strategia", attiva: true, descrizione: "Audit degli account social e definizione della strategia editoriale trimestrale" },
        { id: "s2", titolo: "Produzione Contenuti", attiva: true, descrizione: "Produzione di 8 contenuti mensili tra foto, caroselli e reel", quantitaMin: 8 },
      ]),
      tranchePagamentoJson: JSON.stringify([
        { data: `${year}-02-28`, importo: 150000, descrizione: "Anticipo" },
        { data: `${year}-08-31`, importo: 150000, descrizione: "Saldo" },
      ]),
      importoTotale: 300000,
      clausoleJson: JSON.stringify({ rescissione: "Preavviso scritto di 30 giorni", riservatezza: "Clausola standard" }),
      noteIva: "Importi non soggetti a IVA ai sensi dell'art. 1, commi 54-89, Legge n. 190/2014",
      iban: "IT60X0542811101000000123456",
      marcaDaBollo: 0,
      stato: "inviato",
    },
    {
      numero: `CONT-${year}-003`,
      clientId: (clients[2] ?? clients[0]).id,
      referenteCliente: "Andrea Bianchi",
      oggetto: "Contratto Gestione Completa Social Media",
      dataStipula: past6m.toISOString().slice(0, 10),
      dataInizio: past6m.toISOString().slice(0, 10),
      dataFine: in25d.toISOString().slice(0, 10),
      preavvisoGiorni: 30,
      serviziJson: JSON.stringify([
        { id: "s1", titolo: "Gestione Social", attiva: true, descrizione: "Gestione completa di Instagram, Facebook e LinkedIn", canali: ["Instagram", "Facebook", "LinkedIn"] },
        { id: "s2", titolo: "Campagne Advertising", attiva: true, descrizione: "Meta Ads e Google Ads con budget mensile concordato separatamente", piattaforme: ["Meta Ads", "Google Ads"] },
        { id: "s3", titolo: "Reportistica", attiva: true, frequenza: "mensile" },
      ]),
      tranchePagamentoJson: JSON.stringify([
        { data: `${year}-01-15`, importo: 240000, descrizione: "1^ tranche" },
        { data: `${year}-04-15`, importo: 240000, descrizione: "2^ tranche" },
        { data: `${year}-07-15`, importo: 240000, descrizione: "3^ tranche" },
      ]),
      importoTotale: 720000,
      clausoleJson: JSON.stringify({ rescissione: "Preavviso scritto di 30 giorni", riservatezza: "Clausola standard" }),
      noteIva: "Importi non soggetti a IVA ai sensi dell'art. 1, commi 54-89, Legge n. 190/2014",
      iban: "IT60X0542811101000000123456",
      marcaDaBollo: 1,
      stato: "firmato",
    },
  ];

  for (const s of seeds) {
    await db.insert(contractsTable).values(s).onConflictDoNothing();
  }
}

router.get("/client-contracts", async (req, res): Promise<void> => {
  await seedIfEmpty();
  await autoUpdateExpired();
  const userId = getUserId(req);
  const rows = await db
    .select({
      id: contractsTable.id,
      numero: contractsTable.numero,
      clientId: contractsTable.clientId,
      clientName: clientsTable.name,
      referenteCliente: contractsTable.referenteCliente,
      oggetto: contractsTable.oggetto,
      dataStipula: contractsTable.dataStipula,
      dataInizio: contractsTable.dataInizio,
      dataFine: contractsTable.dataFine,
      preavvisoGiorni: contractsTable.preavvisoGiorni,
      serviziJson: contractsTable.serviziJson,
      tranchePagamentoJson: contractsTable.tranchePagamentoJson,
      importoTotale: contractsTable.importoTotale,
      clausoleJson: contractsTable.clausoleJson,
      noteIva: contractsTable.noteIva,
      iban: contractsTable.iban,
      marcaDaBollo: contractsTable.marcaDaBollo,
      stato: contractsTable.stato,
      note: contractsTable.note,
      createdAt: contractsTable.createdAt,
      updatedAt: contractsTable.updatedAt,
    })
    .from(contractsTable)
    .leftJoin(clientsTable, eq(contractsTable.clientId, clientsTable.id))
    .orderBy(asc(contractsTable.createdAt));
  const accessible = userId ? await getAccessibleClientIds(userId) : "all" as const;
  const filtered = filterByClientAccess(rows, accessible);
  res.json(filtered.map(serializeContract));
});

router.get("/client-contracts/expiring", async (_req, res): Promise<void> => {
  await autoUpdateExpired();
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const in30str = in30.toISOString().slice(0, 10);

  const rows = await db
    .select({
      id: contractsTable.id,
      numero: contractsTable.numero,
      clientId: contractsTable.clientId,
      clientName: clientsTable.name,
      oggetto: contractsTable.oggetto,
      dataFine: contractsTable.dataFine,
      stato: contractsTable.stato,
    })
    .from(contractsTable)
    .leftJoin(clientsTable, eq(contractsTable.clientId, clientsTable.id))
    .where(
      sql`${contractsTable.stato} = 'firmato' AND ${contractsTable.dataFine} >= ${today} AND ${contractsTable.dataFine} <= ${in30str}`
    );
  res.json(rows);
});

router.post("/client-contracts", async (req, res): Promise<void> => {
  const parsed = CreateClientContractBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  const numero = d.numero || (await getNextNumero());

  const [row] = await db
    .insert(contractsTable)
    .values({
      numero,
      clientId: d.clientId,
      referenteCliente: d.referenteCliente ?? null,
      oggetto: d.oggetto ?? "Contratto Gestione Social e ADV",
      dataStipula: d.dataStipula,
      dataInizio: d.dataInizio,
      dataFine: d.dataFine,
      preavvisoGiorni: d.preavvisoGiorni ?? 30,
      serviziJson: d.serviziJson ?? "[]",
      tranchePagamentoJson: d.tranchePagamentoJson ?? "[]",
      importoTotale: d.importoTotale ?? 0,
      clausoleJson: d.clausoleJson ?? "{}",
      noteIva: d.noteIva ?? "Importi non soggetti a IVA ai sensi dell'art. 1, commi 54-89, Legge n. 190/2014",
      iban: d.iban ?? null,
      marcaDaBollo: d.marcaDaBollo ?? 0,
      stato: d.stato ?? "bozza",
      note: d.note ?? null,
    })
    .returning();

  const [withClient] = await db
    .select({
      id: contractsTable.id,
      numero: contractsTable.numero,
      clientId: contractsTable.clientId,
      clientName: clientsTable.name,
      referenteCliente: contractsTable.referenteCliente,
      oggetto: contractsTable.oggetto,
      dataStipula: contractsTable.dataStipula,
      dataInizio: contractsTable.dataInizio,
      dataFine: contractsTable.dataFine,
      preavvisoGiorni: contractsTable.preavvisoGiorni,
      serviziJson: contractsTable.serviziJson,
      tranchePagamentoJson: contractsTable.tranchePagamentoJson,
      importoTotale: contractsTable.importoTotale,
      clausoleJson: contractsTable.clausoleJson,
      noteIva: contractsTable.noteIva,
      iban: contractsTable.iban,
      marcaDaBollo: contractsTable.marcaDaBollo,
      stato: contractsTable.stato,
      note: contractsTable.note,
      createdAt: contractsTable.createdAt,
      updatedAt: contractsTable.updatedAt,
    })
    .from(contractsTable)
    .leftJoin(clientsTable, eq(contractsTable.clientId, clientsTable.id))
    .where(eq(contractsTable.id, row.id));

  res.status(201).json(serializeContract(withClient));
});

router.get("/client-contracts/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }

  const [row] = await db
    .select({
      id: contractsTable.id,
      numero: contractsTable.numero,
      clientId: contractsTable.clientId,
      clientName: clientsTable.name,
      referenteCliente: contractsTable.referenteCliente,
      oggetto: contractsTable.oggetto,
      dataStipula: contractsTable.dataStipula,
      dataInizio: contractsTable.dataInizio,
      dataFine: contractsTable.dataFine,
      preavvisoGiorni: contractsTable.preavvisoGiorni,
      serviziJson: contractsTable.serviziJson,
      tranchePagamentoJson: contractsTable.tranchePagamentoJson,
      importoTotale: contractsTable.importoTotale,
      clausoleJson: contractsTable.clausoleJson,
      noteIva: contractsTable.noteIva,
      iban: contractsTable.iban,
      marcaDaBollo: contractsTable.marcaDaBollo,
      stato: contractsTable.stato,
      note: contractsTable.note,
      createdAt: contractsTable.createdAt,
      updatedAt: contractsTable.updatedAt,
    })
    .from(contractsTable)
    .leftJoin(clientsTable, eq(contractsTable.clientId, clientsTable.id))
    .where(eq(contractsTable.id, id));

  if (!row) { res.status(404).json({ error: "Not found" }); return; }

  const userId = getUserId(req);
  if (userId && row.clientId) {
    const accessible = await getAccessibleClientIds(userId);
    if (accessible !== "all" && !accessible.includes(row.clientId)) {
      res.status(403).json({ error: "Accesso negato" });
      return;
    }
  }

  res.json(serializeContract(row));
});

router.patch("/client-contracts/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateClientContractBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const d = parsed.data;
  const updates: Record<string, unknown> = {};
  if (d.numero != null) updates.numero = d.numero;
  if (d.clientId != null) updates.clientId = d.clientId;
  if (d.referenteCliente != null) updates.referenteCliente = d.referenteCliente;
  if (d.oggetto != null) updates.oggetto = d.oggetto;
  if (d.dataStipula != null) updates.dataStipula = d.dataStipula;
  if (d.dataInizio != null) updates.dataInizio = d.dataInizio;
  if (d.dataFine != null) updates.dataFine = d.dataFine;
  if (d.preavvisoGiorni != null) updates.preavvisoGiorni = d.preavvisoGiorni;
  if (d.serviziJson != null) updates.serviziJson = d.serviziJson;
  if (d.tranchePagamentoJson != null) updates.tranchePagamentoJson = d.tranchePagamentoJson;
  if (d.importoTotale != null) updates.importoTotale = d.importoTotale;
  if (d.clausoleJson != null) updates.clausoleJson = d.clausoleJson;
  if (d.noteIva != null) updates.noteIva = d.noteIva;
  if (d.iban != null) updates.iban = d.iban;
  if (d.marcaDaBollo != null) updates.marcaDaBollo = d.marcaDaBollo;
  if (d.stato != null) updates.stato = d.stato;
  if (d.note != null) updates.note = d.note;

  const [upd] = await db
    .update(contractsTable)
    .set(updates)
    .where(eq(contractsTable.id, id))
    .returning();
  if (!upd) { res.status(404).json({ error: "Not found" }); return; }

  const [withClient] = await db
    .select({
      id: contractsTable.id,
      numero: contractsTable.numero,
      clientId: contractsTable.clientId,
      clientName: clientsTable.name,
      referenteCliente: contractsTable.referenteCliente,
      oggetto: contractsTable.oggetto,
      dataStipula: contractsTable.dataStipula,
      dataInizio: contractsTable.dataInizio,
      dataFine: contractsTable.dataFine,
      preavvisoGiorni: contractsTable.preavvisoGiorni,
      serviziJson: contractsTable.serviziJson,
      tranchePagamentoJson: contractsTable.tranchePagamentoJson,
      importoTotale: contractsTable.importoTotale,
      clausoleJson: contractsTable.clausoleJson,
      noteIva: contractsTable.noteIva,
      iban: contractsTable.iban,
      marcaDaBollo: contractsTable.marcaDaBollo,
      stato: contractsTable.stato,
      note: contractsTable.note,
      createdAt: contractsTable.createdAt,
      updatedAt: contractsTable.updatedAt,
    })
    .from(contractsTable)
    .leftJoin(clientsTable, eq(contractsTable.clientId, clientsTable.id))
    .where(eq(contractsTable.id, id));

  res.json(serializeContract(withClient));
});

router.delete("/client-contracts/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db
    .delete(contractsTable)
    .where(eq(contractsTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.sendStatus(204);
});

router.post("/client-contracts/:id/duplicate", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }

  const [orig] = await db.select().from(contractsTable).where(eq(contractsTable.id, id));
  if (!orig) { res.status(404).json({ error: "Not found" }); return; }

  const numero = await getNextNumero();
  const today = new Date().toISOString().slice(0, 10);

  const [dup] = await db
    .insert(contractsTable)
    .values({
      numero,
      clientId: orig.clientId,
      referenteCliente: orig.referenteCliente,
      oggetto: `${orig.oggetto} (copia)`,
      dataStipula: today,
      dataInizio: orig.dataInizio,
      dataFine: orig.dataFine,
      preavvisoGiorni: orig.preavvisoGiorni,
      serviziJson: orig.serviziJson,
      tranchePagamentoJson: orig.tranchePagamentoJson,
      importoTotale: orig.importoTotale,
      clausoleJson: orig.clausoleJson,
      noteIva: orig.noteIva,
      iban: orig.iban,
      marcaDaBollo: orig.marcaDaBollo,
      stato: "bozza",
      note: orig.note,
    })
    .returning();

  res.status(201).json({ id: dup.id, numero: dup.numero });
});

export default router;
