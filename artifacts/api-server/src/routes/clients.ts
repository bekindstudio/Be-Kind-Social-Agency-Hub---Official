import { Router, type IRouter } from "express";
import { randomBytes, createHmac } from "node:crypto";
import { eq, and, isNull } from "drizzle-orm";
import { db, clientsTable, projectsTable, tasksTable, contractsTable, clientReportsTable, teamMembersTable } from "@workspace/db";
import {
  GetClientParams,
  UpdateClientParams,
  DeleteClientParams,
} from "@workspace/api-zod";
import { z } from "zod";
import { getUserId, isEnvAdmin, getAccessibleClientIds } from "../lib/access-control";
import { softDeleteRecord } from "../lib/trash-service";
import { validate } from "../middlewares/validate";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Schemi per i JSON field strutturati (audit security #15/16):
// prima erano accettati as-is e serializzati a DB. Adesso validati prima.
// NB: tutti nullable perché il frontend manda null per campi vuoti del contact
// (es. email vuota → null) — senza nullable la validation fallisce e l'utente
// vede "Errore nel salvataggio" generico.
const clientContactSchema = z.object({
  nome: z.string().trim().max(120).nullable().optional(),
  cognome: z.string().trim().max(120).nullable().optional(),
  ruolo: z.string().trim().max(120).nullable().optional(),
  email: z.string().trim().max(255).nullable().optional(),
  telefono: z.string().trim().max(40).nullable().optional(),
  isPrimary: z.boolean().nullable().optional(),
  metodoContattoPreferito: z.string().trim().max(40).nullable().optional(),
  orarioPreferito: z.string().trim().max(40).nullable().optional(),
}).passthrough();

const createClientSchema = z.object({
  name: z.string().trim().max(200).optional(),
  ragioneSociale: z.string().trim().max(200).optional(),
  nomeCommerciale: z.string().trim().max(200).optional(),
  email: z.string().trim().max(255).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  company: z.string().trim().max(200).nullable().optional(),
  color: z.string().trim().max(20).optional(),
  // logoUrl può essere data:image/...;base64,... (50-300KB tipici per un PNG 256x256
  // con trasparenza); il cap 2MB consente loghi ragionevoli sia come URL esterno
  // sia come data URL inline.
  logoUrl: z.string().trim().max(2_000_000).nullable().optional(),
  piva: z.string().trim().max(40).nullable().optional(),
  codiceFiscale: z.string().trim().max(40).nullable().optional(),
  indirizzo: z.string().trim().max(255).nullable().optional(),
  cap: z.string().trim().max(20).nullable().optional(),
  citta: z.string().trim().max(120).nullable().optional(),
  provincia: z.string().trim().max(80).nullable().optional(),
  paese: z.string().trim().max(120).nullable().optional(),
  website: z.string().trim().max(2048).nullable().optional(),
  notes: z.string().trim().max(10_000).nullable().optional(),
  instagramHandle: z.string().trim().max(120).nullable().optional(),
  metaPageId: z.string().trim().max(80).nullable().optional(),
  googleAdsId: z.string().trim().max(80).nullable().optional(),
  driveUrl: z.string().trim().max(2048).nullable().optional(),
  reportRecipientEmail: z.string().trim().max(255).nullable().optional(),
  settore: z.string().trim().max(120).nullable().optional(),
  dimensione: z.string().trim().max(80).nullable().optional(),
  brandColor: z.string().trim().max(20).nullable().optional(),
  descrizione: z.string().trim().max(5_000).nullable().optional(),
  comeAcquisito: z.string().trim().max(255).nullable().optional(),
  clienteDal: z.string().trim().max(40).nullable().optional(),
  noteInterne: z.string().trim().max(10_000).nullable().optional(),
  tags: z.array(z.string().trim().max(60)).max(50).optional(),
  contacts: z.array(clientContactSchema).max(50).optional(),
  services: z.array(z.string().trim().max(120)).max(50).optional(),
  accountManagerId: z.union([z.number(), z.string(), z.null()]).optional(),
}).passthrough();

const updateClientSchema = createClientSchema.extend({
  contractStatus: z.string().trim().nullable().optional(),
  monthlyValue: z.union([z.number(), z.string(), z.null()]).optional(),
  healthScore: z.union([z.number(), z.string(), z.null()]).optional(),
}).partial().passthrough();

function safeJsonArray(value: string | null | undefined): unknown[] {
  try {
    const v = JSON.parse(value ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function serializeClient(c: typeof clientsTable.$inferSelect) {
  // Mai esporre l'hash del PIN: solo un flag "impostato / no".
  const { portalPinHash, ...rest } = c;
  return {
    ...rest,
    portalPinSet: Boolean(portalPinHash),
    contacts: safeJsonArray(c.contactsJson),
    services: safeJsonArray(c.servicesJson),
    // B12: serializzazione date safe — se per qualche motivo c.createdAt
    // è una stringa Invalid Date, .toISOString() esplodeva con 500.
    // Ora coerciamo prima e ritorniamo null se non parsabile.
    createdAt: safeToIso(c.createdAt),
    updatedAt: safeToIso(c.updatedAt),
  };
}

function safeToIso(v: unknown): string | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v as any);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function computeHealthScore(input: {
  contractStatus: string;
  contractDaysLeft: number | null;
  overdueTasks: number;
  noCommunicationDays: number;
  reportDaysAgo: number | null;
}): number {
  let score = 50;
  if (input.contractStatus === "attivo" && (input.contractDaysLeft == null || input.contractDaysLeft > 30)) score += 20;
  if (input.reportDaysAgo != null && input.reportDaysAgo <= 30) score += 15;
  if (input.overdueTasks === 0) score += 15;
  if (input.noCommunicationDays <= 7) score += 10;
  if (input.contractDaysLeft != null && input.contractDaysLeft <= 30 && input.contractDaysLeft >= 0) score -= 15;
  if (input.contractStatus === "scaduto") score -= 30;
  score -= Math.min(30, input.overdueTasks * 10);
  if (input.noCommunicationDays >= 14) score -= 10;
  if (input.reportDaysAgo != null && input.reportDaysAgo >= 45) score -= 15;
  return Math.max(0, Math.min(100, score));
}

router.get("/clients", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }
  const clients = await db
    .select()
    .from(clientsTable)
    .where(isNull(clientsTable.deletedAt))
    .orderBy(clientsTable.name);

  const accessible = isEnvAdmin(userId) ? ("all" as const) : await getAccessibleClientIds(userId);
  const result = accessible === "all" ? clients : clients.filter((c) => accessible.includes(c.id));
  res.json(result.map(serializeClient));
});

router.get("/clients/duplicate-check", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }
  const q = String(req.query.q ?? "").trim().toLowerCase();
  const piva = String(req.query.piva ?? "").trim();
  if (!q && !piva) { res.json({ matches: [] }); return; }
  const accessible = isEnvAdmin(userId) ? "all" : await getAccessibleClientIds(userId);
  const clients = await db.select().from(clientsTable).where(isNull(clientsTable.deletedAt));
  const matches = clients.filter((c) => {
    if (accessible !== "all" && !accessible.includes(c.id)) return false;
    const byName = q && (c.name?.toLowerCase().includes(q) || (c.ragioneSociale ?? "").toLowerCase().includes(q));
    const byPiva = piva && (c.piva ?? "") === piva;
    return Boolean(byName || byPiva);
  }).slice(0, 5).map((c) => ({ id: c.id, name: c.name }));
  res.json({ matches });
});

router.post("/clients", validate(createClientSchema), async (req, res): Promise<void> => {
  try {
    const body = req.body as Record<string, any>;
    const parsedAccountManagerId =
      body.accountManagerId === undefined || body.accountManagerId === null || String(body.accountManagerId).trim() === ""
        ? null
        : Number(body.accountManagerId);
    const finalName =
      String(body.name ?? "").trim() ||
      String(body.ragioneSociale ?? "").trim() ||
      String(body.nomeCommerciale ?? "").trim() ||
      `Cliente senza nome - ${new Date().toLocaleString("it-IT")}`;
    let client: typeof clientsTable.$inferSelect | undefined;
    const minimalInsert = {
      name: finalName,
      company: body.company ?? body.nomeCommerciale ?? finalName,
      color: body.color ?? "#7a8f5c",
      tagsJson: JSON.stringify(Array.isArray(body.tags) ? body.tags : []),
    };
    try {
      const [created] = await db.insert(clientsTable).values({
        name: finalName,
        email: body.email ?? null,
        phone: body.phone ?? null,
        company: body.company ?? body.nomeCommerciale ?? finalName,
        color: body.color ?? "#7a8f5c",
        logoUrl: body.logoUrl ?? null,
        ragioneSociale: body.ragioneSociale ?? null,
        piva: body.piva ?? null,
        codiceFiscale: body.codiceFiscale ?? null,
        indirizzo: body.indirizzo ?? null,
        cap: body.cap ?? null,
        citta: body.citta ?? null,
        provincia: body.provincia ?? null,
        paese: body.paese ?? "Italia",
        website: body.website ?? null,
        notes: body.notes ?? null,
        instagramHandle: body.instagramHandle ?? null,
        metaPageId: body.metaPageId ?? null,
        googleAdsId: body.googleAdsId ?? null,
        driveUrl: body.driveUrl ?? null,
        reportRecipientEmail: body.reportRecipientEmail ?? null,
        nomeCommerciale: body.nomeCommerciale ?? finalName,
        settore: body.settore ?? null,
        dimensione: body.dimensione ?? null,
        brandColor: body.brandColor ?? body.color ?? "#7a8f5c",
        descrizione: body.descrizione ?? null,
        comeAcquisito: body.comeAcquisito ?? null,
        clienteDal: body.clienteDal ?? null,
        noteInterne: body.noteInterne ?? null,
        pec: body.pec ?? null,
        sdi: body.sdi ?? null,
        iban: body.iban ?? null,
        metodoPagamento: body.metodoPagamento ?? null,
        terminiPagamento: body.terminiPagamento ?? null,
        contactsJson: JSON.stringify(Array.isArray(body.contacts) ? body.contacts : []),
        servicesJson: JSON.stringify(Array.isArray(body.services) ? body.services : []),
        tagsJson: JSON.stringify(Array.isArray(body.tags) ? body.tags : []),
        accountManagerId: Number.isFinite(parsedAccountManagerId as number) ? parsedAccountManagerId : null,
      }).returning();
      client = created;
    } catch (e: any) {
      try {
        const [fallback] = await db.insert(clientsTable).values({
          name: finalName,
          email: body.email ?? null,
          phone: body.phone ?? null,
          company: body.company ?? body.nomeCommerciale ?? finalName,
          color: body.color ?? "#7a8f5c",
          logoUrl: body.logoUrl ?? null,
          website: body.website ?? null,
          notes: body.notes ?? null,
          ragioneSociale: body.ragioneSociale ?? null,
          piva: body.piva ?? null,
          codiceFiscale: body.codiceFiscale ?? null,
          indirizzo: body.indirizzo ?? null,
          cap: body.cap ?? null,
          citta: body.citta ?? null,
          provincia: body.provincia ?? null,
          paese: body.paese ?? "Italia",
          instagramHandle: body.instagramHandle ?? null,
          metaPageId: body.metaPageId ?? null,
          googleAdsId: body.googleAdsId ?? null,
          driveUrl: body.driveUrl ?? null,
          reportRecipientEmail: body.reportRecipientEmail ?? null,
        }).returning();
        client = fallback;
      } catch (fallbackError: any) {
        try {
          const [minimal] = await db.insert(clientsTable).values(minimalInsert).returning();
          client = minimal;
        } catch (minimalError: any) {
          res.status(500).json({
            error:
              minimalError?.message ??
              fallbackError?.message ??
              e?.message ??
              "Errore salvataggio cliente",
            detail: {
              primary: e?.message ?? null,
              fallback: fallbackError?.message ?? null,
              minimal: minimalError?.message ?? null,
            },
          });
          return;
        }
      }
    }

    if (!client) {
      res.status(500).json({ error: "Errore salvataggio cliente: nessun record creato" });
      return;
    }

    // Auto-create onboarding advanced task linked to client.
    // Deliberatamente NON transazionale rispetto all'insert cliente: se la task
    // fallisce (es. schema task non allineato dopo migration) l'utente
    // preferisce avere comunque il cliente creato e poter aggiungere la task
    // manualmente dopo. Il logger.warn rende visibile il fallimento silenzioso
    // segnalato nell'audit di sicurezza.
    try {
      await db.insert(tasksTable).values({
        clientId: client.id,
        title: `Onboarding Nuovo Cliente - ${client.name}`,
        description: "Checklist onboarding creata automaticamente",
        status: "todo",
        priority: "high",
        tipo: "avanzata",
        categoria: "Onboarding Nuovo Cliente",
        checklistJson: JSON.stringify([
          { id: "ob1", testo: "Analisi gratuita", completato: false, gruppo: "" },
          { id: "ob2", testo: "Meeting conoscitivo", completato: false, gruppo: "" },
          { id: "ob3", testo: "Preventivo con portfolio", completato: false, gruppo: "" },
          { id: "ob4", testo: "Contratto firmato", completato: false, gruppo: "" },
          { id: "ob5", testo: "Drive condiviso creato", completato: false, gruppo: "" },
          { id: "ob6", testo: "Briefing con domande e obiettivi", completato: false, gruppo: "" },
          { id: "ob7", testo: "Credenziali ricevute o pagine create", completato: false, gruppo: "" },
          { id: "ob8", testo: "Brand Kit Canva creato", completato: false, gruppo: "" },
          { id: "ob9", testo: "Ricerca competitors completata", completato: false, gruppo: "" },
        ]),
      });
    } catch (err) {
      logger.warn(
        { err, clientId: client.id, clientName: client.name },
        "POST /clients: onboarding task auto-creation failed (cliente creato comunque)",
      );
    }
    res.status(201).json(serializeClient(client));
  } catch (routeError: any) {
    res.status(500).json({ error: routeError?.message ?? "Errore salvataggio cliente" });
  }
});

router.get("/clients/:id", async (req, res): Promise<void> => {
  const params = GetClientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }
  const [client] = await db
    .select()
    .from(clientsTable)
    .where(and(eq(clientsTable.id, params.data.id), isNull(clientsTable.deletedAt)));
  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }

  if (!isEnvAdmin(userId)) {
    const accessible = await getAccessibleClientIds(userId);
    if (accessible !== "all" && !accessible.includes(client.id)) {
      res.status(403).json({ error: "Accesso negato a questo cliente" });
      return;
    }
  }

  res.json(serializeClient(client));
});

// Genera (o rigenera) il link di condivisione col cliente.
async function assertClientAccessForShare(req: any, res: any, clientId: number): Promise<boolean> {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return false; }
  if (isEnvAdmin(userId)) return true;
  const accessible = await getAccessibleClientIds(userId);
  if (accessible !== "all" && !accessible.includes(clientId)) {
    res.status(403).json({ error: "Accesso negato a questo cliente" });
    return false;
  }
  return true;
}

/**
 * Genera token share firmato con scadenza embedded (default 90 giorni).
 * Formato: <rand>.<expiryMs base36>.<sig hex 32 chars>
 * Nessuna migration richiesta: usa la colonna shareToken esistente.
 * Validato in public-portal.ts (vedi verifyShareToken).
 */
// B3: coerente con public-portal.ts shareTokenSecret(). In prod no fallback
// hardcoded → se nessuna env è settata, token generati saranno comunque
// validabili (entrambe le route usano la stessa funzione) ma non forgiabili
// da chi conosce il default.
function shareTokenSecret(): string {
  const fromEnv = process.env.SHARE_TOKEN_SECRET
    || process.env.CRON_SECRET
    || process.env.TOKEN_ENCRYPTION_KEY;
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") return "";
  return "bekind-share-token-dev-only";
}

function generateShareToken(ttlDays = 90): string {
  const rand = randomBytes(18).toString("base64url");
  const expiryMs = (Date.now() + ttlDays * 86_400_000).toString(36);
  const sig = createHmac("sha256", shareTokenSecret()).update(`${rand}.${expiryMs}`).digest("hex").slice(0, 32);
  return `${rand}.${expiryMs}.${sig}`;
}

router.post("/clients/:id/share-link", async (req, res): Promise<void> => {
  const params = GetClientParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  if (!(await assertClientAccessForShare(req, res, params.data.id))) return;

  const token = generateShareToken();
  const [updated] = await db
    .update(clientsTable)
    .set({ shareToken: token })
    .where(and(eq(clientsTable.id, params.data.id), isNull(clientsTable.deletedAt)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Client not found" }); return; }
  // expiresAt esposto per UX (visualizzare scadenza nel dialog di condivisione).
  const ttlMs = 90 * 86_400_000;
  res.json({ shareToken: token, expiresAt: new Date(Date.now() + ttlMs).toISOString() });
});

router.delete("/clients/:id/share-link", async (req, res): Promise<void> => {
  const params = GetClientParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  if (!(await assertClientAccessForShare(req, res, params.data.id))) return;

  const [updated] = await db
    .update(clientsTable)
    .set({ shareToken: null })
    .where(and(eq(clientsTable.id, params.data.id), isNull(clientsTable.deletedAt)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Client not found" }); return; }
  res.json({ ok: true });
});

/** Hash del PIN portale. Identico a hashPortalPin in public-portal.ts. */
function hashPortalPin(clientId: number, pin: string): string {
  return createHmac("sha256", shareTokenSecret()).update(`portal-pin:${clientId}:${pin}`).digest("hex");
}

// Imposta (o rimuove, pin vuoto/null) il PIN del portale cliente.
router.put("/clients/:id/portal-pin", async (req, res): Promise<void> => {
  const params = GetClientParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  if (!(await assertClientAccessForShare(req, res, params.data.id))) return;

  const raw = (req.body as { pin?: unknown })?.pin;
  const pin = raw == null ? "" : String(raw).trim();
  if (pin && !/^\d{4,6}$/.test(pin)) { res.status(400).json({ error: "Il PIN deve essere di 4-6 cifre" }); return; }
  const hash = pin ? hashPortalPin(params.data.id, pin) : null;

  const [updated] = await db
    .update(clientsTable)
    .set({ portalPinHash: hash })
    .where(and(eq(clientsTable.id, params.data.id), isNull(clientsTable.deletedAt)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Client not found" }); return; }
  res.json({ ok: true, pinSet: Boolean(hash) });
});

router.patch("/clients/:id", validate(updateClientSchema), async (req, res): Promise<void> => {
  const params = UpdateClientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const updates: Record<string, unknown> = {};
  const body = req.body as Record<string, any>;
  const fields = [
    "name","email","phone","company","color","logoUrl","ragioneSociale","piva","codiceFiscale","indirizzo","cap","citta","provincia","paese","website","notes","instagramHandle","metaPageId","googleAdsId","driveUrl","reportRecipientEmail","nomeCommerciale","settore","dimensione","brandColor","descrizione","comeAcquisito","clienteDal","noteInterne","accountManagerId","contractStatus","monthlyValue","healthScore","pec","sdi","iban","metodoPagamento","terminiPagamento",
  ];
  for (const f of fields) {
    if (body[f] !== undefined) updates[f] = body[f];
  }
  if (body.tags !== undefined) updates.tagsJson = JSON.stringify(Array.isArray(body.tags) ? body.tags : []);
  if (body.contacts !== undefined) updates.contactsJson = JSON.stringify(Array.isArray(body.contacts) ? body.contacts : []);
  if (body.services !== undefined) updates.servicesJson = JSON.stringify(Array.isArray(body.services) ? body.services : []);

  const [existing] = await db
    .select()
    .from(clientsTable)
    .where(and(eq(clientsTable.id, params.data.id), isNull(clientsTable.deletedAt)));
  if (!existing) {
    res.status(404).json({ error: "Client not found" });
    return;
  }

  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }
  if (!isEnvAdmin(userId)) {
    const accessible = await getAccessibleClientIds(userId);
    if (accessible !== "all" && !accessible.includes(existing.id)) {
      res.status(403).json({ error: "Accesso negato a questo cliente" });
      return;
    }
  }

  const [client] = await db.update(clientsTable).set(updates).where(eq(clientsTable.id, params.data.id)).returning();
  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  res.json(serializeClient(client));
});

router.get("/clients/:id/profile", async (req, res): Promise<void> => {
  const params = GetClientParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const clientId = params.data.id;
  const [client] = await db
    .select()
    .from(clientsTable)
    .where(and(eq(clientsTable.id, clientId), isNull(clientsTable.deletedAt)));
  if (!client) { res.status(404).json({ error: "Client not found" }); return; }

  const profileUserId = getUserId(req);
  if (!profileUserId) { res.status(401).json({ error: "Non autenticato" }); return; }
  if (!isEnvAdmin(profileUserId)) {
    const accessible = await getAccessibleClientIds(profileUserId);
    if (accessible !== "all" && !accessible.includes(client.id)) {
      res.status(403).json({ error: "Accesso negato a questo cliente" });
      return;
    }
  }

  const [projects, tasks, contracts, reports] = await Promise.all([
    db
      .select()
      .from(projectsTable)
      .where(and(eq(projectsTable.clientId, clientId), isNull(projectsTable.deletedAt))),
    db
      .select()
      .from(tasksTable)
      .where(and(eq(tasksTable.clientId, clientId), isNull(tasksTable.deletedAt))),
    db
      .select()
      .from(contractsTable)
      .where(and(eq(contractsTable.clientId, clientId), isNull(contractsTable.deletedAt))),
    db.select().from(clientReportsTable).where(eq(clientReportsTable.clientId, clientId)),
  ]);

  const now = new Date();
  const activeContract = contracts.find((c) => c.stato === "firmato");
  const contractDaysLeft = activeContract ? Math.floor((new Date(activeContract.dataFine).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
  const contractStatus = !activeContract ? "nessuno" : contractDaysLeft != null && contractDaysLeft < 0 ? "scaduto" : contractDaysLeft != null && contractDaysLeft <= 30 ? "in_scadenza" : "attivo";
  const overdueTasks = tasks.filter((t) => t.status !== "done" && t.dueDate && new Date(t.dueDate) < now).length;
  const latestReport = reports.sort((a, b) => (b.createdAt.getTime() - a.createdAt.getTime()))[0];
  const reportDaysAgo = latestReport ? Math.floor((now.getTime() - latestReport.createdAt.getTime()) / (1000 * 60 * 60 * 24)) : null;
  const noCommunicationDays = client.lastActivityAt ? Math.floor((now.getTime() - client.lastActivityAt.getTime()) / (1000 * 60 * 60 * 24)) : 30;
  const healthScore = computeHealthScore({ contractStatus, contractDaysLeft, overdueTasks, reportDaysAgo, noCommunicationDays });

  await db.update(clientsTable).set({ healthScore, contractStatus, lastActivityAt: now }).where(eq(clientsTable.id, clientId));

  const onboardingTask = tasks.find((t) => t.categoria === "Onboarding Nuovo Cliente");
  const onboardingItems = onboardingTask ? (JSON.parse(onboardingTask.checklistJson || "[]") as any[]) : [];
  const onboardingDone = onboardingItems.filter((i) => i.completato).length;

  res.json({
    client: serializeClient({ ...client, healthScore, contractStatus, lastActivityAt: now } as any),
    metrics: {
      progettiAttivi: projects.filter((p) => p.status === "active").length,
      taskInCorso: tasks.filter((t) => t.status === "in-progress").length,
      valoreContrattoMensile: activeContract?.importoTotale ?? client.monthlyValue ?? 0,
      prossimaScadenza: activeContract?.dataFine ?? null,
      ultimoReportInviato: latestReport?.sentAt?.toISOString?.() ?? null,
      onboarding: { done: onboardingDone, total: onboardingItems.length, pct: onboardingItems.length ? Math.round((onboardingDone / onboardingItems.length) * 100) : 0 },
    },
    projects,
    tasks,
    contracts,
    reports,
    health: {
      score: healthScore,
      level: healthScore >= 80 ? "ottimo" : healthScore >= 60 ? "buono" : healthScore >= 40 ? "attenzione" : healthScore >= 20 ? "rischio" : "critico",
    },
  });
});

router.delete("/clients/:id", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId || !isEnvAdmin(userId)) {
    res.status(403).json({ error: "Solo gli amministratori possono eliminare i clienti" });
    return;
  }
  const params = DeleteClientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const r = await softDeleteRecord("clients", String(params.data.id), { deletedBy: userId });
  if (!r.ok) {
    res.status(r.error === "Non trovato" ? 404 : 400).json({ error: r.error });
    return;
  }
  res.json({ ok: true, trashLogId: r.trashLogId, message: "Spostato nel cestino" });
});

export default router;
