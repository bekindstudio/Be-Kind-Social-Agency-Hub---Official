import { Router, type IRouter } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { db, clientsTable, projectsTable, tasksTable, contractsTable, clientReportsTable, teamMembersTable } from "@workspace/db";
import {
  GetClientParams,
  UpdateClientParams,
  DeleteClientParams,
} from "@workspace/api-zod";
import { getUserId, isEnvAdmin, getAccessibleClientIds } from "../lib/access-control";
import { softDeleteRecord } from "../lib/trash-service";

const router: IRouter = Router();

function serializeClient(c: typeof clientsTable.$inferSelect) {
  return {
    ...c,
    createdAt: c.createdAt ? new Date(c.createdAt as any).toISOString() : null,
    updatedAt: c.updatedAt ? new Date(c.updatedAt as any).toISOString() : null,
  };
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

async function seedMockClients() {
  const existing = await db.select().from(clientsTable).where(isNull(clientsTable.deletedAt));
  if (existing.length > 0) return;

  const [manager] = await db.select().from(teamMembersTable).limit(1);
  const managerId = manager?.id ?? null;

  const rows = await db.insert(clientsTable).values([
    {
      name: "Fiore Moda SpA",
      nomeCommerciale: "Fiore Moda",
      ragioneSociale: "Fiore Moda SpA",
      settore: "Fashion",
      dimensione: "Media (50-249)",
      website: "https://fioremoda.example",
      color: "#d946ef",
      brandColor: "#d946ef",
      accountManagerId: managerId,
      tagsJson: JSON.stringify(["VIP", "B2C", "E-commerce"]),
      contractStatus: "attivo",
      monthlyValue: 3200,
      healthScore: 85,
      noteInterne: "Cliente premium, approvazioni rapide",
      clienteDal: "2024-02-01",
    },
    {
      name: "TechNova Startup",
      nomeCommerciale: "TechNova",
      ragioneSociale: "TechNova Startup Srl",
      settore: "Technology",
      dimensione: "Piccola (10-49)",
      website: "https://technova.example",
      color: "#3b82f6",
      brandColor: "#3b82f6",
      accountManagerId: managerId,
      tagsJson: JSON.stringify(["Nuovo", "B2B"]),
      contractStatus: "in_scadenza",
      monthlyValue: 2400,
      healthScore: 62,
      noteInterne: "Contratto in rinnovo, follow-up frequente",
      clienteDal: "2025-01-10",
    },
    {
      name: "Rossi & Partners Srl",
      nomeCommerciale: "Rossi & Partners",
      ragioneSociale: "Rossi & Partners Srl",
      settore: "Consulting",
      dimensione: "Micro (1-9)",
      website: "https://rossipartners.example",
      color: "#f97316",
      brandColor: "#f97316",
      accountManagerId: managerId,
      tagsJson: JSON.stringify(["B2B", "Stagionale"]),
      contractStatus: "nessuno",
      monthlyValue: 900,
      healthScore: 38,
      noteInterne: "Nessun report inviato da oltre 45 giorni",
      clienteDal: "2023-09-15",
    },
  ]).returning();

  const today = new Date();
  const in25 = new Date(); in25.setDate(in25.getDate() + 25);
  const in90 = new Date(); in90.setDate(in90.getDate() + 90);

  await db.insert(contractsTable).values([
    { numero: "CTR-2026-001", clientId: rows[0].id, oggetto: "Gestione Social + Meta Ads", dataStipula: today.toISOString().slice(0, 10), dataInizio: today.toISOString().slice(0, 10), dataFine: in90.toISOString().slice(0, 10), stato: "firmato", importoTotale: 3200 },
    { numero: "CTR-2026-002", clientId: rows[1].id, oggetto: "Google Ads + Meta Ads", dataStipula: today.toISOString().slice(0, 10), dataInizio: today.toISOString().slice(0, 10), dataFine: in25.toISOString().slice(0, 10), stato: "firmato", importoTotale: 2400 },
  ]);
}

router.get("/clients", async (req, res): Promise<void> => {
  await seedMockClients();
  const userId = getUserId(req);
  const clients = await db
    .select()
    .from(clientsTable)
    .where(isNull(clientsTable.deletedAt))
    .orderBy(clientsTable.name);

  if (!userId || isEnvAdmin(userId)) {
    res.json(clients.map(serializeClient));
    return;
  }

  const accessible = await getAccessibleClientIds(userId);
  if (accessible === "all") {
    res.json(clients.map(serializeClient));
    return;
  }

  const filtered = clients.filter((c) => accessible.includes(c.id));
  res.json(filtered.map(serializeClient));
});

router.get("/clients/duplicate-check", async (req, res): Promise<void> => {
  const q = String(req.query.q ?? "").trim().toLowerCase();
  const piva = String(req.query.piva ?? "").trim();
  if (!q && !piva) { res.json({ matches: [] }); return; }
  const clients = await db.select().from(clientsTable).where(isNull(clientsTable.deletedAt));
  const matches = clients.filter((c) => {
    const byName = q && (c.name?.toLowerCase().includes(q) || (c.ragioneSociale ?? "").toLowerCase().includes(q));
    const byPiva = piva && (c.piva ?? "") === piva;
    return Boolean(byName || byPiva);
  }).slice(0, 5).map((c) => ({ id: c.id, name: c.name }));
  res.json({ matches });
});

router.post("/clients", async (req, res): Promise<void> => {
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

    // Auto-create onboarding advanced task linked to client
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
    } catch {
      // Do not fail client creation if onboarding task insertion fails.
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
  const [client] = await db
    .select()
    .from(clientsTable)
    .where(and(eq(clientsTable.id, params.data.id), isNull(clientsTable.deletedAt)));
  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }

  if (userId && !isEnvAdmin(userId)) {
    const accessible = await getAccessibleClientIds(userId);
    if (accessible !== "all" && !accessible.includes(client.id)) {
      res.status(403).json({ error: "Accesso negato a questo cliente" });
      return;
    }
  }

  res.json(serializeClient(client));
});

router.patch("/clients/:id", async (req, res): Promise<void> => {
  const params = UpdateClientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const updates: Record<string, unknown> = {};
  const body = req.body as Record<string, any>;
  const fields = [
    "name","email","phone","company","color","logoUrl","ragioneSociale","piva","codiceFiscale","indirizzo","cap","citta","provincia","paese","website","notes","instagramHandle","metaPageId","googleAdsId","driveUrl","reportRecipientEmail","nomeCommerciale","settore","dimensione","brandColor","descrizione","comeAcquisito","clienteDal","noteInterne","accountManagerId","contractStatus","monthlyValue","healthScore",
  ];
  for (const f of fields) {
    if (body[f] !== undefined) updates[f] = body[f];
  }
  if (body.tags !== undefined) updates.tagsJson = JSON.stringify(Array.isArray(body.tags) ? body.tags : []);

  const [existing] = await db
    .select()
    .from(clientsTable)
    .where(and(eq(clientsTable.id, params.data.id), isNull(clientsTable.deletedAt)));
  if (!existing) {
    res.status(404).json({ error: "Client not found" });
    return;
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
