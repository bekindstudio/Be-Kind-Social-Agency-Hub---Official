import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { portalFetch } from "@workspace/api-client-react";
import { useSupabaseAuth } from "@/auth/SupabaseAuthContext";
import { useClientContext } from "@/context/ClientContext";
import { useToast } from "@/hooks/use-toast";
import { cn, formatDate } from "@/lib/utils";
import {
  Sun,
  AlertTriangle,
  CalendarDays,
  CheckSquare,
  Inbox,
  FileText,
  ChevronRight,
  List,
  X,
  Check,
} from "lucide-react";

/* Pagina "Oggi" — dashboard giornaliera focalizzata.
   Consolida task in scadenza, eventi imminenti, report da approvare e
   promemoria (brief incompleti, contratti in scadenza) di TUTTI i clienti. */

type AnyObj = Record<string, any>;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Ordine urgenza (per il sort secondario delle task: prima cronologico, poi urgenza).
const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

function useApi<T>(key: (string | number)[], path: string, staleSec = 60): { data: T | null; loading: boolean } {
  const q = useQuery({
    queryKey: key,
    staleTime: staleSec * 1000,
    queryFn: async () => {
      const r = await portalFetch(path, { credentials: "include" });
      if (!r.ok) return null as any;
      return r.json();
    },
  });
  return { data: (q.data as T) ?? null, loading: q.isLoading };
}

function StatCard({
  label, value, hint, tone, icon: Icon, href,
}: { label: string; value: number; hint?: string; tone: "neutral" | "warn" | "ok"; icon: any; href?: string }) {
  // Cleanup UX (Wave BD): niente più bg colorato pieno (4 card affiancate con
  // ambra/verde/blu/grigio sovraccaricavano). Solo border-left sottile + valore
  // colorato quando > 0 — l'occhio va dove conta, senza rumore cromatico.
  const accent =
    tone === "warn" ? "border-l-amber-400" :
    tone === "ok" ? "border-l-emerald-400" : "border-l-primary/40";
  const valueColor =
    tone === "warn" && value > 0 ? "text-amber-700" :
    tone === "ok" && value > 0 ? "text-emerald-700" : "text-foreground";
  const body = (
    <div className={cn("rounded-xl border border-card-border border-l-4 bg-card p-4 transition-colors hover:shadow-sm", accent)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-bold mt-1", valueColor)}>{value}</p>
      <div className="flex items-center justify-between mt-1">
        <p className="text-xs text-muted-foreground">{hint ?? " "}</p>
        <Icon size={15} className="text-muted-foreground/70" />
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function TaskTodayRow({
  task, onClick, onToggleDone, overdue,
}: { task: AnyObj; onClick: () => void; onToggleDone: () => void; overdue: boolean }) {
  const isDone = task.status === "done";
  return (
    <div className={cn(
      // Cleanup UX (Wave BD): niente bg ambra/verde pieni. Border-left sottile
      // basta a comunicare overdue; per done solo opacity ridotta + line-through.
      "flex items-start gap-2.5 rounded-lg p-2.5 transition-colors group border border-card-border/60 hover:bg-muted/40",
      overdue && "border-l-2 border-l-amber-400",
      isDone && "opacity-60",
    )}>
      {/* Checkbox inline per toggle done */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleDone(); }}
        aria-label={isDone ? "Segna come da fare" : "Segna come fatta"}
        title={isDone ? "Segna come da fare" : "Segna come fatta"}
        className={cn(
          "shrink-0 mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors",
          isDone
            ? "bg-emerald-600 border-emerald-600 text-white"
            : "border-muted-foreground/40 hover:border-primary hover:bg-primary/5"
        )}
      >
        {isDone && <Check size={12} strokeWidth={3} />}
      </button>

      <button
        type="button"
        onClick={onClick}
        className="text-left flex-1 min-w-0"
      >
        <p className={cn("text-sm font-medium truncate", isDone && "line-through text-muted-foreground")}>
          {task.title}
        </p>
        <p className={cn("text-xs", overdue ? "text-amber-700" : "text-muted-foreground")}>
          {overdue && task.dueDate ? `Scaduta il ${formatDate(task.dueDate)}` : task.dueDate ? `Scadenza oggi` : "Senza scadenza"}
          {/* Mostra SEMPRE il cliente (in evidenza) così si capisce di chi è la
              task; poi il progetto come contesto secondario. */}
          {task.clientName && <> · <span className="font-medium text-foreground/80">{task.clientName}</span></>}
          {task.projectName ? ` · ${task.projectName}` : ""}
          {!task.clientName && !task.projectName && !task.clientId && !task.projectId ? " · Generale" : ""}
        </p>
      </button>

      {task.priority === "urgent" && !isDone && (
        <span className="text-xs rounded-full bg-rose-100 text-rose-700 px-2 py-0.5 shrink-0 mt-0.5">Urgente</span>
      )}
      <ChevronRight size={13} className="text-muted-foreground shrink-0 mt-1" />
    </div>
  );
}

function SectionCard({ title, icon: Icon, action, children, empty }: { title: string; icon: any; action?: React.ReactNode; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="rounded-xl border border-card-border bg-card p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <Icon size={15} className="text-primary" /> {title}
        </h2>
        {action}
      </div>
      {empty ? <p className="text-sm text-muted-foreground py-4 text-center">Niente da segnalare.</p> : children}
    </div>
  );
}

export default function TodayPage() {
  const [, navigate] = useLocation();
  const { user } = useSupabaseAuth();
  const { clients: contextClients, setActiveClient } = useClientContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);

  // Toggle done/undone su una task con optimistic update locale + refetch.
  const toggleTaskDone = async (task: AnyObj) => {
    const newStatus = task.status === "done" ? "todo" : "done";
    try {
      const r = await portalFetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!r.ok) {
        toast({ variant: "destructive", title: "Aggiornamento non riuscito" });
        return;
      }
      // Invalida le query touched (today.tasks)
      queryClient.invalidateQueries({ queryKey: ["today", "tasks"] });
      if (newStatus === "done") {
        toast({ title: `✓ ${task.title}` });
      }
    } catch {
      toast({ variant: "destructive", title: "Errore di rete" });
    }
  };

  const todayKey = isoDate(startOfToday());
  const sevenDaysFromNow = new Date(startOfToday().getTime() + 7 * 86400000);
  const sevenKey = isoDate(sevenDaysFromNow);

  // Dati
  const tasks = useApi<AnyObj[]>(["today", "tasks"], "/api/tasks", 60).data ?? [];
  const events = useApi<AnyObj[]>(["today", "events"], "/api/dashboard/events", 60).data ?? [];
  const reports = useApi<AnyObj[]>(["today", "reports"], "/api/reports", 90).data ?? [];
  const expContracts = useApi<AnyObj[]>(["today", "expContracts"], "/api/client-contracts/expiring", 120).data ?? [];
  const clients = useApi<AnyObj[]>(["today", "clients"], "/api/clients", 120).data ?? [];
  const projects = useApi<AnyObj[]>(["today", "projects"], "/api/projects", 120).data ?? [];

  // ── Risoluzione cliente per ciascuna task ──────────────────────────────
  // Le task legate a un progetto NON portano il nome cliente (solo projectId/
  // projectName). Lo ricaviamo via progetto → cliente. Serve sia per mostrarlo
  // nella riga ("cliente · progetto") sia per il click che deve portare al
  // cliente giusto, non a quello eventualmente filtrato altrove.
  const clientNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const c of clients) if (c?.id != null) m.set(Number(c.id), String(c.name ?? ""));
    return m;
  }, [clients]);
  const projectClientById = useMemo(() => {
    const m = new Map<number, { clientId: number | null; clientName: string | null }>();
    for (const p of projects) if (p?.id != null) m.set(Number(p.id), { clientId: p.clientId ?? null, clientName: p.clientName ?? null });
    return m;
  }, [projects]);
  const resolveClient = (t: AnyObj): { clientId: number | null; clientName: string | null } => {
    const proj = t?.projectId != null ? projectClientById.get(Number(t.projectId)) : undefined;
    const clientId = (t?.clientId ?? proj?.clientId) ?? null;
    const clientName =
      t?.clientName
      ?? (clientId != null ? clientNameById.get(Number(clientId)) : undefined)
      ?? proj?.clientName
      ?? null;
    return { clientId, clientName };
  };
  // Task arricchite col cliente risolto: tutte le viste (lista, popup) lo usano.
  const tasksEnriched = useMemo(
    () => tasks.map((t): AnyObj => {
      const { clientId, clientName } = resolveClient(t);
      return { ...t, clientId: clientId ?? t.clientId ?? null, clientName: clientName ?? null };
    }),
    [tasks, clientNameById, projectClientById],
  );

  // Click su task → pagina /tasks (lista task) filtrata sul cliente proprietario.
  // /tasks filtra in base al cliente attivo del context, quindi prima imposto
  // quel cliente come attivo (così barra in alto + filtro mostrano lui) e poi
  // navigo. Fallback: progetto, o /tasks globale per task senza cliente.
  const goToTask = (t: AnyObj): void => {
    const { clientId } = resolveClient(t);
    if (clientId != null) {
      const match = contextClients.find((c) => String(c.id) === String(clientId));
      if (match) setActiveClient(match);
      navigate("/tasks");
      return;
    }
    if (t?.projectId) { navigate(`/projects/${t.projectId}`); return; }
    navigate(`/tasks?id=${t?.id ?? ""}`);
  };

  // Brief per ciascun cliente — uso react-query per ogni cliente
  const briefQueries = clients.slice(0, 30).map((c: AnyObj) => {
    return { id: Number(c.id), name: c.name as string };
  });
  const briefsAgg = useQuery({
    queryKey: ["today", "briefs", briefQueries.map((b) => b.id).join(",")],
    enabled: briefQueries.length > 0,
    staleTime: 120 * 1000,
    queryFn: async () => {
      const out: { clientId: number; name: string; pct: number }[] = [];
      for (const b of briefQueries) {
        const r = await portalFetch(`/api/clients/${b.id}/brief`, { credentials: "include" });
        if (!r.ok) continue;
        const data = await r.json();
        let total = 0;
        let filled = 0;
        if (data?.parsedJson) {
          try {
            const p = JSON.parse(data.parsedJson);
            for (const sec of Object.values(p ?? {})) {
              if (sec && typeof sec === "object") {
                for (const v of Object.values(sec as Record<string, unknown>)) {
                  total += 1;
                  if (typeof v === "string" && v.trim()) filled += 1;
                }
              }
            }
          } catch { /* ignore */ }
        }
        const pct = total ? Math.round((filled / total) * 100) : 0;
        out.push({ clientId: b.id, name: b.name, pct });
      }
      return out;
    },
  });
  const briefStats = briefsAgg.data ?? [];

  // Aggregati
  const aggregates = useMemo(() => {
    const today = startOfToday();
    const tomorrow = new Date(today.getTime() + 86400000);
    const week = sevenDaysFromNow;

    const tasksDoneToday = tasksEnriched.filter(
      (t) => t.status === "done" && (t.completedAt ? new Date(t.completedAt).getTime() >= today.getTime() : false),
    );
    const tasksOverdue = tasksEnriched.filter(
      (t) => t.status !== "done" && t.dueDate && new Date(t.dueDate) < today,
    );
    const tasksToday = tasksEnriched.filter(
      (t) => t.status !== "done" && t.dueDate && isoDate(new Date(t.dueDate)) === todayKey,
    );
    const tasksThisWeek = tasksEnriched.filter((t) => {
      if (t.status === "done") return false;
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d >= today && d <= week;
    });
    const eventsThisWeek = events.filter((e) => {
      const s = new Date(e.date);
      return s >= today && s <= week;
    });
    const eventsToday = events.filter((e) => isoDate(new Date(e.date)) === todayKey);
    const reportsToApprove = reports.filter(
      (r) => r.status && /in_attesa|attesa|review|revisione|pending/i.test(String(r.status)),
    );
    const reportsToSend = reports.filter(
      (r) => r.status === "approvato" || r.status === "ready",
    );
    const briefsIncomplete = briefStats.filter((b) => b.pct < 50);

    return {
      tasksOverdue, tasksToday, tasksThisWeek, tasksDoneToday,
      eventsToday, eventsThisWeek,
      reportsToApprove, reportsToSend,
      briefsIncomplete,
      contractsExpiring: expContracts,
    };
  }, [tasksEnriched, events, reports, expContracts, briefStats, todayKey, sevenDaysFromNow]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 6) return "Buona notte";
    if (h < 13) return "Buongiorno";
    if (h < 19) return "Buon pomeriggio";
    return "Buona sera";
  }, []);

  const userLabel = (user as any)?.email?.split("@")[0] || "team";

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-6xl mx-auto">
        {/* Hero compatto (Wave BE): una sola headline che dice quante task
            hai per oggi. Niente più 4 StatCard che competono per attenzione. */}
        {(() => {
          const todoCount = aggregates.tasksOverdue.length + aggregates.tasksToday.length;
          const overdueCount = aggregates.tasksOverdue.length;
          return (
            <div className="mb-8">
              <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                <p className="text-sm text-muted-foreground capitalize inline-flex items-center gap-2">
                  <Sun size={16} className="text-amber-500" />
                  {greeting}, {userLabel} · {new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
                </p>
                <p className="text-xs text-muted-foreground">Vista quotidiana · tutti i clienti</p>
              </div>
              {todoCount === 0 ? (
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                  Nessuna task per oggi. <span className="text-emerald-600">Tutto in ordine ✓</span>
                </h1>
              ) : (
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                  Hai <span className="text-primary tabular-nums">{todoCount}</span> {todoCount === 1 ? "task" : "task"} per oggi
                  {overdueCount > 0 && (
                    <span className="text-amber-600">, {overdueCount} in ritardo</span>
                  )}
                </h1>
              )}
              {(aggregates.tasksDoneToday.length > 0 || aggregates.eventsThisWeek.length > 0) && (
                <p className="text-sm text-muted-foreground mt-2">
                  {aggregates.tasksDoneToday.length > 0 && `${aggregates.tasksDoneToday.length} ${aggregates.tasksDoneToday.length === 1 ? "completata" : "completate"} oggi`}
                  {aggregates.tasksDoneToday.length > 0 && aggregates.eventsThisWeek.length > 0 && " · "}
                  {aggregates.eventsThisWeek.length > 0 && `${aggregates.eventsThisWeek.length} ${aggregates.eventsThisWeek.length === 1 ? "evento" : "eventi"} nei prossimi 7 giorni`}
                </p>
              )}
            </div>
          );
        })()}

        {/* Sezione principale: solo "Da fare oggi" full-width. Le altre 3
            sezioni (Eventi, Approvare, Promemoria) sono consolidate sotto
            in un blocco compatto "Altro da sapere" — meno carico cognitivo. */}
        <div className="space-y-4">
          {/* Da fare oggi — tutte (scadute + di oggi + completate oggi), no slice
              Click task → naviga al cliente, checkbox per toggle done */}
          <SectionCard
            title="Da fare oggi"
            icon={CheckSquare}
            action={
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPopupOpen(true)}
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                  title="Apri vista popup con tutte le task del giorno"
                >
                  <List size={12} /> Vista completa
                </button>
                <Link href="/tasks"><span className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1">Tutte <ChevronRight size={12} /></span></Link>
              </div>
            }
            empty={aggregates.tasksOverdue.length === 0 && aggregates.tasksToday.length === 0}
          >
            <div className="space-y-2">
              {/* Scadute prima, poi di oggi. Mostro fino a 10 senza toggle, sopra
                  espongo un bottone "Vedi altre N" che le fa apparire tutte. */}
              {(() => {
                const all = [
                  ...aggregates.tasksOverdue.map((t) => ({ t, overdue: true })),
                  ...aggregates.tasksToday.map((t) => ({ t, overdue: false })),
                ].sort((a, b) => {
                  // Ordine cronologico (scadenza più vecchia prima), poi urgenza.
                  const da = a.t.dueDate ? new Date(a.t.dueDate).getTime() : Infinity;
                  const db = b.t.dueDate ? new Date(b.t.dueDate).getTime() : Infinity;
                  if (da !== db) return da - db;
                  return (PRIORITY_ORDER[a.t.priority] ?? 2) - (PRIORITY_ORDER[b.t.priority] ?? 2);
                });
                const limit = 10;
                const visible = showAllTasks ? all : all.slice(0, limit);
                const hidden = all.length - visible.length;
                return (
                  <>
                    {visible.map(({ t, overdue }) => (
                      <TaskTodayRow
                        key={t.id}
                        task={t}
                        overdue={overdue}
                        onClick={() => goToTask(t)}
                        onToggleDone={() => toggleTaskDone(t)}
                      />
                    ))}
                    {hidden > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowAllTasks(true)}
                        className="w-full text-center text-xs text-primary hover:underline py-1.5 border border-dashed border-card-border rounded-lg"
                      >
                        Mostra altre {hidden} task
                      </button>
                    )}
                    {showAllTasks && all.length > limit && (
                      <button
                        type="button"
                        onClick={() => setShowAllTasks(false)}
                        className="w-full text-center text-xs text-muted-foreground hover:underline pt-1"
                      >
                        Collassa
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          </SectionCard>

          {/* Altro da sapere (Wave BE): 3 righe compatte che consolidano
              Eventi/Report/Promemoria. Ogni riga linka alla pagina dedicata
              per il dettaglio — qui basta il conteggio + il next item. */}
          {(() => {
            const nextEvent = [...aggregates.eventsThisWeek]
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
            const totalReports = aggregates.reportsToApprove.length + aggregates.reportsToSend.length;
            const totalReminders = aggregates.briefsIncomplete.length + aggregates.contractsExpiring.length;
            const anything = aggregates.eventsThisWeek.length + totalReports + totalReminders;
            if (anything === 0) return null;
            return (
              <div className="rounded-xl border border-card-border bg-card p-5">
                <h2 className="font-semibold text-sm flex items-center gap-2 mb-1">
                  <Inbox size={15} className="text-primary" /> Altro da sapere
                </h2>
                <div className="divide-y divide-card-border/50 -mx-5">
                  {aggregates.eventsThisWeek.length > 0 && (
                    <Link href="/tools/events">
                      <div className="flex items-center gap-3 py-3 px-5 hover:bg-muted/40 transition-colors cursor-pointer">
                        <CalendarDays size={16} className="text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            {aggregates.eventsThisWeek.length} {aggregates.eventsThisWeek.length === 1 ? "evento" : "eventi"} nei prossimi 7 giorni
                          </p>
                          {nextEvent && (
                            <p className="text-xs text-muted-foreground truncate">
                              Prossimo: {nextEvent.title} · {formatDate(nextEvent.date)}{nextEvent.clientName ? ` · ${nextEvent.clientName}` : ""}
                            </p>
                          )}
                        </div>
                        <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                      </div>
                    </Link>
                  )}
                  {totalReports > 0 && (
                    <Link href="/tools/reports">
                      <div className="flex items-center gap-3 py-3 px-5 hover:bg-muted/40 transition-colors cursor-pointer">
                        <FileText size={16} className="text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            {totalReports} {totalReports === 1 ? "report" : "report"} da gestire
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {aggregates.reportsToApprove.length > 0 && `${aggregates.reportsToApprove.length} in revisione`}
                            {aggregates.reportsToApprove.length > 0 && aggregates.reportsToSend.length > 0 && " · "}
                            {aggregates.reportsToSend.length > 0 && `${aggregates.reportsToSend.length} pronti da inviare`}
                          </p>
                        </div>
                        <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                      </div>
                    </Link>
                  )}
                  {totalReminders > 0 && (
                    <Link href={aggregates.briefsIncomplete[0]
                      ? `/clients/${aggregates.briefsIncomplete[0].clientId}`
                      : aggregates.contractsExpiring[0]
                        ? `/clients/${aggregates.contractsExpiring[0].clientId}`
                        : "/clients"}>
                      <div className="flex items-center gap-3 py-3 px-5 hover:bg-muted/40 transition-colors cursor-pointer">
                        <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            {totalReminders} {totalReminders === 1 ? "promemoria" : "promemoria"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {aggregates.briefsIncomplete.length > 0 && `${aggregates.briefsIncomplete.length} brief incompleti`}
                            {aggregates.briefsIncomplete.length > 0 && aggregates.contractsExpiring.length > 0 && " · "}
                            {aggregates.contractsExpiring.length > 0 && `${aggregates.contractsExpiring.length} contratti in scadenza`}
                          </p>
                        </div>
                        <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                      </div>
                    </Link>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Dati aggiornati automaticamente. Vista per oggi · {sevenKey}
        </p>
      </div>

      {/* Wave BA: Popup full-page con TUTTE le task del giorno + scadute + completate.
          Vista alternativa al DailyFocusPopup one-at-a-time. */}
      {popupOpen && (
        <TodayTasksPopup
          tasksOverdue={aggregates.tasksOverdue}
          tasksToday={aggregates.tasksToday}
          tasksDoneToday={aggregates.tasksDoneToday}
          onClose={() => setPopupOpen(false)}
          onClick={(t) => { setPopupOpen(false); goToTask(t); }}
          onToggleDone={toggleTaskDone}
        />
      )}
    </Layout>
  );
}

/* ─── Popup vista completa task del giorno (Wave BA) ──────────────────────
   Differenza vs DailyFocusPopup: quello fa "una task alla volta" con focus.
   Questo le mostra TUTTE in lista in un colpo solo, per chi vuole pianificare
   la giornata. Checkbox per toggle done inline + click per andare al cliente. */
function TodayTasksPopup({
  tasksOverdue, tasksToday, tasksDoneToday, onClose, onClick, onToggleDone,
}: {
  tasksOverdue: AnyObj[];
  tasksToday: AnyObj[];
  tasksDoneToday: AnyObj[];
  onClose: () => void;
  onClick: (t: AnyObj) => void;
  onToggleDone: (t: AnyObj) => void;
}) {
  const total = tasksOverdue.length + tasksToday.length + tasksDoneToday.length;
  const todoCount = tasksOverdue.length + tasksToday.length;
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-card border border-card-border rounded-2xl w-full max-w-3xl max-h-[90vh] shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-card-border flex items-center gap-3">
          <Sun size={20} className="text-amber-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-base">Task di oggi</h2>
            <p className="text-xs text-muted-foreground">
              {todoCount} da fare · {tasksDoneToday.length} completate oggi · {total} totali
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Chiudi" className="p-2 rounded-lg hover:bg-muted">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {tasksOverdue.length > 0 && (
            <section>
              <h3 className="text-xs uppercase tracking-wide text-amber-700 font-semibold mb-2 flex items-center gap-1.5">
                <AlertTriangle size={12} /> In ritardo ({tasksOverdue.length})
              </h3>
              <div className="space-y-1.5">
                {tasksOverdue.map((t) => (
                  <TaskTodayRow key={t.id} task={t} overdue onClick={() => onClick(t)} onToggleDone={() => onToggleDone(t)} />
                ))}
              </div>
            </section>
          )}

          {tasksToday.length > 0 && (
            <section>
              <h3 className="text-xs uppercase tracking-wide text-foreground/70 font-semibold mb-2 flex items-center gap-1.5">
                <CheckSquare size={12} /> Da fare oggi ({tasksToday.length})
              </h3>
              <div className="space-y-1.5">
                {tasksToday.map((t) => (
                  <TaskTodayRow key={t.id} task={t} overdue={false} onClick={() => onClick(t)} onToggleDone={() => onToggleDone(t)} />
                ))}
              </div>
            </section>
          )}

          {tasksDoneToday.length > 0 && (
            <section>
              <h3 className="text-xs uppercase tracking-wide text-emerald-700 font-semibold mb-2 flex items-center gap-1.5">
                <Check size={12} /> Completate oggi ({tasksDoneToday.length})
              </h3>
              <div className="space-y-1.5">
                {tasksDoneToday.map((t) => (
                  <TaskTodayRow key={t.id} task={t} overdue={false} onClick={() => onClick(t)} onToggleDone={() => onToggleDone(t)} />
                ))}
              </div>
            </section>
          )}

          {total === 0 && (
            <div className="text-center py-12">
              <CheckSquare size={28} className="mx-auto text-muted-foreground/60 mb-3" />
              <p className="text-sm font-medium">Nessuna task per oggi</p>
              <p className="text-xs text-muted-foreground mt-1">Goditi la pausa o pianifica le prossime.</p>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-card-border bg-muted/30 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Click sulla task per andare al cliente · checkbox per marcare fatta
          </p>
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:opacity-90">
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
