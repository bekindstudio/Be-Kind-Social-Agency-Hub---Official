import { Router, type IRouter } from "express";
import { eq, and, sql, desc, asc, gte, lte, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  tasksTable,
  projectsTable,
  teamMembersTable,
  clientsTable,
  dailyFocusSessionsTable,
  taskFocusActionsTable,
} from "@workspace/db";
import { getUserId, isEnvAdmin } from "../lib/access-control";

const taskIdArraySchema = z
  .array(z.number().int().positive())
  .max(500)
  .optional();

const dailyFocusSessionBodySchema = z
  .object({
    tasksShownJson: taskIdArraySchema,
    tasksCompletedJson: taskIdArraySchema,
    tasksSkippedJson: taskIdArraySchema,
    tasksDelegatedJson: taskIdArraySchema,
    tasksPostponedJson: taskIdArraySchema,
    completionRate: z.number().min(0).max(1).optional(),
  })
  .strict();

const router: IRouter = Router();

// Timezone di riferimento per "oggi" lato server. Tutte le route che salvano o
// leggono date "giornaliere" (sessione, azioni, stats, streak) DEVONO passare
// per qui per evitare drift UTC: alle 00:30 italiane new Date().toISOString()
// e' gia' del giorno dopo e le azioni finiscono attribuite a domani -> il
// popup "Focus" riappare la mattina perche' non trova la sessione di "oggi".
const LOCAL_TZ = process.env.APP_TZ ?? "Europe/Rome";
const LOCAL_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: LOCAL_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function localDateStr(date: Date = new Date()): string {
  // en-CA formatta sempre come YYYY-MM-DD, identico al vecchio
  // toISOString().slice(0,10) ma calcolato nel fuso configurato.
  return LOCAL_DATE_FORMATTER.format(date);
}

function todayStr(): string {
  return localDateStr();
}

// Cache (lazy, one-shot) per la presenza della colonna tasks.completed_from_focus.
// In ambienti dove la migrazione non e' ancora stata applicata la colonna manca:
// dobbiamo costruire il payload UNA volta e non perdere segnali di errore reali
// dentro try/catch silenziosi che mascheravano fallimenti (RLS, constraint, ecc).
let completedFromFocusColumnExistsPromise: Promise<boolean> | null = null;
async function hasCompletedFromFocusColumn(): Promise<boolean> {
  if (!completedFromFocusColumnExistsPromise) {
    completedFromFocusColumnExistsPromise = (async () => {
      try {
        const result: any = await db.execute(
          sql`SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'completed_from_focus' LIMIT 1`,
        );
        const rows: any[] = Array.isArray(result)
          ? result
          : (result?.rows ?? []);
        return rows.length > 0;
      } catch (err) {
        // Se l'introspection fallisce non possiamo concludere nulla: meglio
        // assumere assente per evitare crash, e ritentare la rilevazione alla
        // prossima richiesta.
        console.error("[daily-focus] introspection completed_from_focus failed:", err);
        completedFromFocusColumnExistsPromise = null;
        return false;
      }
    })();
  }
  return completedFromFocusColumnExistsPromise;
}

function addDays(base: Date, n: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  // Stesso accorgimento di todayStr: formatto nel fuso locale per evitare
  // che un addDays(now, 0) restituisca "domani" dopo mezzanotte UTC.
  return localDateStr(d);
}

function computeFocusScore(task: typeof tasksTable.$inferSelect): {
  score: number;
  quadrant: number;
} {
  let score = 0;
  const priority = (task.priority ?? "medium").toLowerCase();
  if (priority === "urgente") score += 100;
  else if (priority === "alta") score += 75;
  else if (priority === "media" || priority === "medium") score += 50;
  else if (priority === "bassa" || priority === "low") score += 25;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let daysUntilDue = 999;
  if (task.dueDate) {
    const due = new Date(task.dueDate);
    due.setHours(0, 0, 0, 0);
    daysUntilDue = Math.floor(
      (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysUntilDue < 0) score += 50;
    else if (daysUntilDue === 0) score += 40;
    else if (daysUntilDue === 1) score += 30;
    else if (daysUntilDue <= 3) score += 20;
    else if (daysUntilDue <= 7) score += 10;
  }

  if (task.projectId || task.clientId) score += 15;
  if ((task.estimatedHours ?? 0) > 0 && (task.estimatedHours ?? 0) <= 1) score += 5;
  if (String(task.description ?? "").toLowerCase().includes("blocca")) score += 10;

  let quadrant: number;
  const isUrgent = daysUntilDue <= 1;
  const isImportant =
    priority === "urgente" || priority === "alta" || priority === "medium" || priority === "media";

  if (isUrgent && isImportant) quadrant = 1;
  else if (!isUrgent && isImportant) quadrant = 2;
  else if (isUrgent && !isImportant) quadrant = 3;
  else quadrant = 4;

  return { score, quadrant };
}

router.get("/daily-focus", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Non autenticato" });
    return;
  }

  const teamMember = await db
    .select()
    .from(teamMembersTable)
    .where(eq(teamMembersTable.authUserId, userId));
  const memberId = teamMember[0]?.id ?? null;
  const memberName =
    teamMember[0]
      ? `${teamMember[0].name ?? ""} ${teamMember[0].surname ?? ""}`.trim()
      : null;

  let tasks;
  if (memberId) {
    tasks = await db
      .select()
      .from(tasksTable)
      .where(
        and(
          eq(tasksTable.assigneeId, memberId),
          sql`${tasksTable.status} != 'done'`,
        ),
      );
  } else {
    tasks = await db
      .select()
      .from(tasksTable)
      .where(sql`${tasksTable.status} != 'done'`);
  }

  if (false) { // Demo seed task DISATTIVATO: niente task finti
    const now = new Date();
    await db.insert(tasksTable).values([
      {
        title: "Consegnare grafiche Spring a Fiore Moda",
        description: "Dipendenza cliente: materiali finali per calendario editoriale",
        priority: "alta",
        dueDate: addDays(now, 0),
        status: "todo",
        categoria: "Design",
        assigneeId: memberId,
        estimatedHours: 1,
      },
      {
        title: "Attivare campagna Meta TechNova",
        description: "Task bloccante per l'avvio lead generation",
        priority: "urgente",
        dueDate: addDays(now, -1),
        status: "todo",
        categoria: "ADV",
        assigneeId: memberId,
        estimatedHours: 2,
      },
      {
        title: "Preparare piano editoriale Maggio — Rossi & Partners",
        priority: "alta",
        dueDate: addDays(now, 5),
        status: "todo",
        categoria: "Piano Editoriale",
        assigneeId: memberId,
      },
      {
        title: "Scrivere caption 8 post Instagram Fiore Moda",
        priority: "media",
        dueDate: addDays(now, 3),
        status: "todo",
        categoria: "Copy",
        assigneeId: memberId,
      },
      {
        title: "Aggiornare spreadsheet ore lavorate",
        priority: "bassa",
        dueDate: addDays(now, 1),
        status: "todo",
        categoria: "Admin",
        assigneeId: memberId,
      },
      {
        title: "Riorganizzare cartelle Drive clienti",
        priority: "bassa",
        dueDate: addDays(now, 20),
        status: "todo",
        categoria: "Organizzazione",
        assigneeId: memberId,
      },
    ]);
    if (memberId) {
      tasks = await db.select().from(tasksTable).where(
        and(eq(tasksTable.assigneeId, memberId), sql`${tasksTable.status} != 'done'`),
      );
    } else {
      tasks = await db.select().from(tasksTable).where(sql`${tasksTable.status} != 'done'`);
    }
  }

  const [projects, members, clients] = await Promise.all([
    db.select().from(projectsTable),
    db.select().from(teamMembersTable),
    db.select().from(clientsTable),
  ]);
  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const memberMap = new Map(members.map((m) => [m.id, m]));

  const scored = tasks.map((t) => {
    const { score, quadrant } = computeFocusScore(t);
    const project = t.projectId ? projectMap.get(t.projectId) : null;
    const assignee = t.assigneeId ? memberMap.get(t.assigneeId) : null;
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      projectId: t.projectId,
      projectName: project?.name ?? null,
      clientId: project?.clientId ?? null,
      clientName: project?.clientId
        ? (clients.find((c) => c.id === project.clientId)?.name ?? null)
        : null,
      assigneeId: t.assigneeId,
      assigneeName: assignee
        ? `${assignee.name ?? ""} ${assignee.surname ?? ""}`.trim()
        : null,
      categoria: t.categoria,
      checklistJson: t.checklistJson,
      estimatedHours: t.estimatedHours,
      pacchettoContenuti: t.pacchettoContenuti,
      score,
      quadrant,
      postponedCount: t.postponedCount,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  const today = todayStr();
  const [session] = await db
    .select()
    .from(dailyFocusSessionsTable)
    .where(
      and(
        eq(dailyFocusSessionsTable.userId, userId),
        eq(dailyFocusSessionsTable.date, today),
      ),
    );

  const todayActions = await db
    .select()
    .from(taskFocusActionsTable)
    .where(
      and(
        eq(taskFocusActionsTable.userId, userId),
        eq(taskFocusActionsTable.date, today),
      ),
    );

  res.json({
    memberName,
    tasks: scored,
    session: session ?? null,
    todayActions,
    teamMembers: members
      .filter((m) => m.isActive)
      .map((m) => ({
        id: m.id,
        name: `${m.name ?? ""} ${m.surname ?? ""}`.trim(),
      })),
  });
});

router.post("/daily-focus/session", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Non autenticato" });
    return;
  }
  const today = todayStr();

  const parsed = dailyFocusSessionBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Payload non valido",
      details: parsed.error.flatten(),
    });
    return;
  }
  const {
    tasksShownJson,
    tasksCompletedJson,
    tasksSkippedJson,
    tasksDelegatedJson,
    tasksPostponedJson,
  } = parsed.data;
  // completionRate viene IGNORATO dal client e ricalcolato server-side dai
  // safeTasks*Json piu' sotto: cosi' la streak in /stats e avgCompletionRate
  // non possono essere gonfiati inviando completionRate=1 da fuori.

  // ACL: filtra i taskId tenendo solo quelli effettivamente assegnati al
  // memberId corrente (o creati dall'utente). Gli env admin possono usare
  // qualunque id valido nel DB.
  const teamMember = await db
    .select()
    .from(teamMembersTable)
    .where(eq(teamMembersTable.authUserId, userId));
  const memberId = teamMember[0]?.id ?? null;
  const envAdmin = isEnvAdmin(userId);

  const allIds = Array.from(
    new Set(
      [
        ...(tasksShownJson ?? []),
        ...(tasksCompletedJson ?? []),
        ...(tasksSkippedJson ?? []),
        ...(tasksDelegatedJson ?? []),
        ...(tasksPostponedJson ?? []),
      ],
    ),
  );

  let allowedIds = new Set<number>();
  if (allIds.length > 0) {
    const rows = await db
      .select({
        id: tasksTable.id,
        assigneeId: tasksTable.assigneeId,
        createdBy: tasksTable.createdBy,
      })
      .from(tasksTable)
      .where(inArray(tasksTable.id, allIds));
    for (const r of rows) {
      if (envAdmin) {
        allowedIds.add(r.id);
        continue;
      }
      if (memberId && r.assigneeId === memberId) {
        allowedIds.add(r.id);
        continue;
      }
      if (r.createdBy && r.createdBy === userId) {
        allowedIds.add(r.id);
      }
    }
  }
  const filterIds = (ids?: number[]) =>
    (ids ?? []).filter((id) => allowedIds.has(id));

  const safeTasksShownJson =
    tasksShownJson !== undefined ? filterIds(tasksShownJson) : undefined;
  const safeTasksCompletedJson =
    tasksCompletedJson !== undefined
      ? filterIds(tasksCompletedJson)
      : undefined;
  const safeTasksSkippedJson =
    tasksSkippedJson !== undefined ? filterIds(tasksSkippedJson) : undefined;
  const safeTasksDelegatedJson =
    tasksDelegatedJson !== undefined
      ? filterIds(tasksDelegatedJson)
      : undefined;
  const safeTasksPostponedJson =
    tasksPostponedJson !== undefined
      ? filterIds(tasksPostponedJson)
      : undefined;

  // Calcolo authoritative del completionRate: solo le task ACL-validate
  // contano. Numerator = completed reali, denominator = shown reali.
  // Se shown e' assente o vuoto il rate e' 0 (evitiamo divisioni per zero
  // che producevano NaN e contaminavano avgCompletionRate). Clampiamo
  // comunque in [0,1] per resilienza, anche se per costruzione il valore
  // ci sta gia' dentro.
  function computeServerCompletionRate(
    shown?: number[],
    completed?: number[],
  ): number | undefined {
    if (shown === undefined && completed === undefined) return undefined;
    const shownArr = shown ?? [];
    const completedArr = completed ?? [];
    if (shownArr.length === 0) return 0;
    // Conta solo i completed che sono effettivamente tra gli shown:
    // evita che un client invii completed = [id1] e shown = [id2] gonfiando.
    const shownSet = new Set(shownArr);
    const completedInShown = completedArr.filter((id) => shownSet.has(id));
    const rate = completedInShown.length / shownArr.length;
    if (!Number.isFinite(rate)) return 0;
    return Math.max(0, Math.min(1, rate));
  }
  const serverCompletionRate = computeServerCompletionRate(
    safeTasksShownJson,
    safeTasksCompletedJson,
  );

  const [existing] = await db
    .select()
    .from(dailyFocusSessionsTable)
    .where(
      and(
        eq(dailyFocusSessionsTable.userId, userId),
        eq(dailyFocusSessionsTable.date, today),
      ),
    );

  if (existing) {
    const updates: any = {};
    if (safeTasksShownJson !== undefined)
      updates.tasksShownJson = safeTasksShownJson;
    if (safeTasksCompletedJson !== undefined)
      updates.tasksCompletedJson = safeTasksCompletedJson;
    if (safeTasksSkippedJson !== undefined)
      updates.tasksSkippedJson = safeTasksSkippedJson;
    if (safeTasksDelegatedJson !== undefined)
      updates.tasksDelegatedJson = safeTasksDelegatedJson;
    if (safeTasksPostponedJson !== undefined)
      updates.tasksPostponedJson = safeTasksPostponedJson;
    // completionRate ricalcolato server-side: ignora qualsiasi valore inviato
    // dal client. Lo scriviamo solo se almeno uno tra shown/completed e' stato
    // aggiornato (altrimenti serverCompletionRate e' undefined e non vogliamo
    // sovrascrivere il valore esistente con uno spurio).
    if (serverCompletionRate !== undefined)
      updates.completionRate = serverCompletionRate;
    updates.closedAt = new Date();
    const [updated] = await db
      .update(dailyFocusSessionsTable)
      .set(updates)
      .where(eq(dailyFocusSessionsTable.id, existing.id))
      .returning();
    res.json(updated);
  } else {
    const [created] = await db
      .insert(dailyFocusSessionsTable)
      .values({
        userId,
        date: today,
        tasksShownJson: safeTasksShownJson ?? [],
        tasksCompletedJson: safeTasksCompletedJson ?? [],
        tasksSkippedJson: safeTasksSkippedJson ?? [],
        tasksDelegatedJson: safeTasksDelegatedJson ?? [],
        tasksPostponedJson: safeTasksPostponedJson ?? [],
        // Server-side: completed_in_shown / shown, gia' clampato in [0,1].
        completionRate: serverCompletionRate ?? 0,
      })
      .returning();
    res.status(201).json(created);
  }
});

router.post("/daily-focus/action", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Non autenticato" });
    return;
  }
  const { taskId, action, note } = req.body;
  if (!taskId || !action) {
    res.status(400).json({ error: "taskId e action obbligatori" });
    return;
  }
  // Validazione esplicita di taskId: Number('abc') => NaN, Number({}) => NaN,
  // Number('0') => 0. Tutti questi passerebbero il check !taskId sopra (tranne
  // '0' che pero' lo passa per "0" non vuoto) e finirebbero in una query
  // Drizzle 'where id = NaN' che esplode a runtime (500 non gestito).
  // Richiediamo intero positivo, rispondendo 400 altrimenti.
  const parsedTaskId = Number(taskId);
  if (!Number.isInteger(parsedTaskId) || parsedTaskId <= 0) {
    res.status(400).json({ error: "taskId deve essere un intero positivo" });
    return;
  }

  const validActions = [
    "viewed",
    "started",
    "completed",
    "skipped",
    "delegated",
    "postponed",
  ];
  if (!validActions.includes(action)) {
    res.status(400).json({ error: "Azione non valida" });
    return;
  }

  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, parsedTaskId));
  if (!task) { res.status(404).json({ error: "Task non trovata" }); return; }

  const teamMember = await db.select().from(teamMembersTable).where(eq(teamMembersTable.authUserId, userId));
  const memberId = teamMember[0]?.id ?? null;
  const envAdmin = isEnvAdmin(userId);
  // ACL: blocca utenti senza team_member (a meno che non siano env admin) per
  // evitare bypass su task di altri clienti.
  if (!memberId && !envAdmin) {
    res.status(403).json({ error: "Utente non collegato a un team member" }); return;
  }
  if (task.assigneeId) {
    // Task con assegnatario: solo l'assegnatario o un env admin possono agire.
    if (!envAdmin && task.assigneeId !== memberId) {
      res.status(403).json({ error: "Non puoi modificare task assegnate ad altri" }); return;
    }
  } else {
    // Task senza assegnatario: serve env admin, oppure essere creatore della task,
    // PM/creatore del progetto, o account manager del cliente collegato.
    if (!envAdmin) {
      let allowed = false;
      if (task.createdBy && task.createdBy === userId) allowed = true;
      if (!allowed && task.projectId) {
        const [proj] = await db
          .select()
          .from(projectsTable)
          .where(eq(projectsTable.id, task.projectId));
        if (proj) {
          if (proj.createdBy && proj.createdBy === userId) allowed = true;
          if (!allowed && memberId && proj.projectManagerId === memberId) allowed = true;
        }
      }
      if (!allowed && task.clientId && memberId) {
        const [cli] = await db
          .select()
          .from(clientsTable)
          .where(eq(clientsTable.id, task.clientId));
        if (cli && cli.accountManagerId === memberId) allowed = true;
      }
      if (!allowed) {
        res.status(403).json({ error: "Non puoi modificare task non assegnate" }); return;
      }
    }
  }

  if (action === "started") {
    await db.update(tasksTable).set({ status: "in-progress" }).where(eq(tasksTable.id, parsedTaskId));
  } else if (action === "completed") {
    // Costruiamo il payload UNA volta in base alla presenza effettiva della colonna,
    // evitando il vecchio try/catch silenzioso che mascherava errori reali (RLS,
    // constraint, connessione) e lasciava la task non completata pur loggando
    // un'azione 'completed': lo streak e il completionRate diventavano falsi.
    const hasFocusCol = await hasCompletedFromFocusColumn();
    const updatePayload: Record<string, unknown> = {
      status: "done",
      completedAt: new Date(),
    };
    if (hasFocusCol) updatePayload.completedFromFocus = true;
    try {
      await db
        .update(tasksTable)
        .set(updatePayload as any)
        .where(eq(tasksTable.id, parsedTaskId));
    } catch (err) {
      console.error("[daily-focus] failed to mark task completed", {
        taskId: parsedTaskId,
        userId,
        hasFocusCol,
        err,
      });
      res.status(500).json({ error: "Impossibile completare la task" });
      return;
    }
  } else if (action === "postponed") {
    // Bottone "Sposta di N giorni" (default 1).
    // Bug storico: se task.dueDate era scaduto da 10 giorni, calcolare
    // currentDue = task.dueDate + 1 lo spostava da -10 a -9 e la task
    // restava nel passato -> riappariva subito nel popup Daily Focus.
    // Fix: base = max(task.dueDate, today), poi + days. In questo modo:
    //  - task scaduta  -> oggi + days (>= domani con days=1)
    //  - task di oggi  -> oggi + days
    //  - task futura   -> dueDate + days (rispetta lo "sposta di N")
    // La nuova dueDate e' quindi sempre >= oggi + 1, niente piu' rientro
    // in selezione del Daily Focus per la stessa task.
    // Il calcolo via localDateStr/addDays evita il drift UTC vicino a
    // mezzanotte locale (vedi addDays).
    let days = 1;
    const rawDays = (req.body as any)?.days;
    if (rawDays !== undefined && rawDays !== null && rawDays !== "") {
      const parsedDays = Number(rawDays);
      if (!Number.isInteger(parsedDays) || parsedDays < 1 || parsedDays > 30) {
        res.status(400).json({
          error: "days deve essere un intero tra 1 e 30",
        });
        return;
      }
      days = parsedDays;
    }
    const today = todayStr();
    // task.dueDate puo' arrivare come stringa "YYYY-MM-DD" (colonna date)
    // o come Date; normalizziamo in stringa locale per il confronto.
    const currentDue =
      typeof task.dueDate === "string"
        ? task.dueDate
        : task.dueDate
          ? localDateStr(new Date(task.dueDate as any))
          : null;
    // Confronto su YYYY-MM-DD: stesso formato/padding -> lessicografico = cronologico.
    const baseStr = currentDue && currentDue > today ? currentDue : today;
    const [by, bm, bd] = baseStr.split("-").map((n) => Number(n));
    const baseDate = new Date(by ?? 1970, (bm ?? 1) - 1, bd ?? 1);
    const newDueDate = addDays(baseDate, days);
    await db.update(tasksTable).set({
      dueDate: newDueDate,
      lastPostponedAt: new Date(),
      postponedCount: (task.postponedCount ?? 0) + 1,
    }).where(eq(tasksTable.id, parsedTaskId));
  } else if (action === "delegated") {
    const { newAssigneeId } = req.body;
    // Validazione: newAssigneeId obbligatorio e deve essere intero positivo.
    // Number('abc') => NaN, !Number.isInteger(NaN) => true -> 400.
    const parsedAssignee = Number(newAssigneeId);
    if (
      newAssigneeId === undefined ||
      newAssigneeId === null ||
      newAssigneeId === "" ||
      !Number.isInteger(parsedAssignee) ||
      parsedAssignee <= 0
    ) {
      res.status(400).json({ error: "newAssigneeId obbligatorio e deve essere un intero positivo" });
      return;
    }
    // ACL riassegnazione: solo l'assegnatario attuale, env admin, o (per task
    // senza assegnatario) chi ha gia' superato il controllo sopra puo' delegare.
    // Replico la stessa policy gia' applicata all'action: se siamo qui significa
    // che l'utente e' autorizzato sul task, ma blocchiamo esplicitamente chi
    // non e' ne' assegnatario corrente ne' env admin per evitare delega da terzi.
    if (!envAdmin && task.assigneeId && task.assigneeId !== memberId) {
      res.status(403).json({ error: "Solo l'assegnatario corrente o un admin possono delegare" });
      return;
    }
    // Verifica esistenza e attivita' del nuovo assegnatario in team_members.
    const [newMember] = await db
      .select()
      .from(teamMembersTable)
      .where(eq(teamMembersTable.id, parsedAssignee));
    if (!newMember) {
      res.status(400).json({ error: "newAssigneeId non corrisponde a nessun team member" });
      return;
    }
    if (!newMember.isActive) {
      res.status(400).json({ error: "Il team member selezionato non e' attivo" });
      return;
    }
    await db.update(tasksTable).set({ assigneeId: parsedAssignee }).where(eq(tasksTable.id, parsedTaskId));
  }

  const [logged] = await db
    .insert(taskFocusActionsTable)
    .values({
      userId,
      taskId: parsedTaskId,
      date: todayStr(),
      action,
      note: note ?? null,
    })
    .returning();

  res.status(201).json(logged);
});

router.get("/daily-focus/should-open", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }
  const today = todayStr();
  const [session] = await db.select().from(dailyFocusSessionsTable).where(
    and(eq(dailyFocusSessionsTable.userId, userId), eq(dailyFocusSessionsTable.date, today)),
  );
  if (!session) {
    res.json({ shouldOpen: true, reason: "first_open_today", highlightUrgentOnly: false });
    return;
  }
  const teamMember = await db.select().from(teamMembersTable).where(eq(teamMembersTable.authUserId, userId));
  const memberId = teamMember[0]?.id ?? null;
  const envAdmin = isEnvAdmin(userId);
  // ACL: senza team_member e senza env admin non possiamo esporre id di task di altri.
  // Evitiamo il leak e segnaliamo che non c'e' nulla da aprire.
  if (!memberId && !envAdmin) {
    res.json({ shouldOpen: false, reason: "no_team_member", highlightUrgentOnly: false });
    return;
  }
  // Limita la query alle sole task dell'utente loggato (env admin vede tutto).
  let openTasks = memberId
    ? await db
        .select()
        .from(tasksTable)
        .where(and(sql`${tasksTable.status} != 'done'`, eq(tasksTable.assigneeId, memberId)))
    : await db.select().from(tasksTable).where(sql`${tasksTable.status} != 'done'`);
  const lastSeen = session.closedAt ?? session.openedAt;
  const newUrgent = openTasks.filter((t) => {
    const created = t.createdAt ? new Date(t.createdAt) : null;
    if (!created || !lastSeen) return false;
    const scored = computeFocusScore(t);
    return created > lastSeen && scored.quadrant === 1;
  });
  if (newUrgent.length > 0) {
    res.json({ shouldOpen: true, reason: "new_urgent_tasks", highlightUrgentOnly: true, urgentTaskIds: newUrgent.map((t) => t.id) });
    return;
  }
  res.json({ shouldOpen: false, reason: "already_seen_today", highlightUrgentOnly: false });
});

router.get("/daily-focus/stats", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Non autenticato" });
    return;
  }

  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + 1);
  // weekStartStr serve a filtrare le sessioni "da lunedi' in poi": usiamo il
  // fuso locale per non escludere lunedi' in modo errato a notte fonda.
  const weekStartStr = localDateStr(weekStart);

  const sessions = await db
    .select()
    .from(dailyFocusSessionsTable)
    .where(
      and(
        eq(dailyFocusSessionsTable.userId, userId),
        gte(dailyFocusSessionsTable.date, weekStartStr),
      ),
    )
    .orderBy(asc(dailyFocusSessionsTable.date));

  const actions = await db
    .select()
    .from(taskFocusActionsTable)
    .where(
      and(
        eq(taskFocusActionsTable.userId, userId),
        gte(taskFocusActionsTable.date, weekStartStr),
      ),
    );

  const dayNames = [
    "Lunedi",
    "Martedi",
    "Mercoledi",
    "Giovedi",
    "Venerdi",
    "Sabato",
    "Domenica",
  ];

  const dailyStats = dayNames.map((name, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const dateStr = localDateStr(d);
    const dayActions = actions.filter((a) => a.date === dateStr);
    return {
      day: name,
      date: dateStr,
      completed: dayActions.filter((a) => a.action === "completed").length,
      started: dayActions.filter((a) => a.action === "started").length,
      skipped: dayActions.filter((a) => a.action === "skipped").length,
      delegated: dayActions.filter((a) => a.action === "delegated").length,
    };
  });

  const totalCompleted = actions.filter(
    (a) => a.action === "completed",
  ).length;
  const totalDelegated = actions.filter(
    (a) => a.action === "delegated",
  ).length;
  const avgRate =
    sessions.length > 0
      ? sessions.reduce((sum, s) => sum + (s.completionRate ?? 0), 0) /
        sessions.length
      : 0;

  let streak = 0;
  const checkDate = new Date(today);
  for (let i = 0; i < 30; i++) {
    // Confronta nel fuso locale: altrimenti la sera tardi salteremmo "oggi"
    // e lo streak si interromperebbe per un giorno gia' completato.
    const dStr = localDateStr(checkDate);
    const session = sessions.find((s) => s.date === dStr);
    if (session && (session.completionRate ?? 0) > 0) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  res.json({
    dailyStats,
    totalCompleted,
    totalDelegated,
    avgCompletionRate: Math.round(avgRate * 100) / 100,
    streak,
    sessionsCount: sessions.length,
  });
});

export default router;
