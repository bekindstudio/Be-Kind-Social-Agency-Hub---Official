import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { portalFetch } from "@workspace/api-client-react";
import { useSupabaseAuth } from "@/auth/SupabaseAuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn, formatDate } from "@/lib/utils";
import {
  Sun,
  AlertTriangle,
  CalendarDays,
  CheckSquare,
  Inbox,
  FileText,
  Receipt,
  BookOpen,
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
  const toneCls =
    tone === "warn" ? "bg-amber-50 border-amber-200" :
    tone === "ok" ? "bg-emerald-50 border-emerald-200" : "bg-card border-card-border";
  const dot =
    tone === "warn" ? "bg-amber-500" :
    tone === "ok" ? "bg-emerald-500" : "bg-primary";
  const body = (
    <div className={cn("rounded-xl border p-4 transition-colors hover:shadow-sm", toneCls)}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">{label}</p>
        <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <div className="flex items-center justify-between mt-1">
        <p className="text-[11px] text-muted-foreground">{hint ?? " "}</p>
        <Icon size={16} className="text-muted-foreground" />
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

/**
 * Naviga alla destinazione "più contestuale" per una task:
 * - se ha clientId → scheda cliente con tab Progetti & Task
 * - altrimenti se ha projectId → dettaglio progetto
 * - altrimenti → lista task globale filtrata sull'id (deep link).
 * Risponde alla richiesta utente: "clic su task → vai al cliente, non a /tasks".
 */
function taskHref(t: AnyObj): string {
  if (t?.clientId) return `/clients/${t.clientId}`;
  if (t?.projectId) return `/projects/${t.projectId}`;
  return `/tasks?id=${t?.id ?? ""}`;
}

function TaskTodayRow({
  task, onClick, onToggleDone, overdue,
}: { task: AnyObj; onClick: () => void; onToggleDone: () => void; overdue: boolean }) {
  const isDone = task.status === "done";
  return (
    <div className={cn(
      "flex items-start gap-2.5 rounded-lg p-2.5 transition-colors group border",
      overdue ? "border-amber-200 bg-amber-50 hover:bg-amber-100"
        : isDone ? "border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50"
        : "border-card-border/60 hover:bg-muted/40"
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
        <p className={cn("text-[11px]", overdue ? "text-amber-700" : "text-muted-foreground")}>
          {overdue && task.dueDate ? `Scaduta il ${formatDate(task.dueDate)}` : task.dueDate ? `Scadenza oggi` : "Senza scadenza"}
          {task.clientName ? ` · ${task.clientName}` : task.projectName ? ` · ${task.projectName}` : (!task.clientId && !task.projectId ? " · Generale" : "")}
        </p>
      </button>

      {task.priority === "urgent" && !isDone && (
        <span className="text-[10px] rounded-full bg-rose-100 text-rose-700 px-2 py-0.5 shrink-0 mt-0.5">Urgente</span>
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

    const tasksDoneToday = tasks.filter(
      (t) => t.status === "done" && (t.completedAt ? new Date(t.completedAt).getTime() >= today.getTime() : false),
    );
    const tasksOverdue = tasks.filter(
      (t) => t.status !== "done" && t.dueDate && new Date(t.dueDate) < today,
    );
    const tasksToday = tasks.filter(
      (t) => t.status !== "done" && t.dueDate && isoDate(new Date(t.dueDate)) === todayKey,
    );
    const tasksThisWeek = tasks.filter((t) => {
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
  }, [tasks, events, reports, expContracts, briefStats, todayKey, sevenDaysFromNow]);

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
        {/* Header */}
        <div className="mb-6 flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sun size={22} className="text-amber-500" /> {greeting}, {userLabel}
            </h1>
            <p className="text-sm text-muted-foreground capitalize">
              {new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">Vista quotidiana · tutti i clienti</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard
            label="Task scadute"
            value={aggregates.tasksOverdue.length}
            hint={aggregates.tasksOverdue.length ? "Da recuperare" : "Tutto in ordine"}
            tone={aggregates.tasksOverdue.length > 0 ? "warn" : "ok"}
            icon={AlertTriangle}
            href="/tasks"
          />
          <StatCard
            label="Task oggi"
            value={aggregates.tasksToday.length}
            hint={aggregates.tasksToday.length ? `${aggregates.tasksDoneToday.length} completate oggi` : "Nessuna scadenza"}
            tone="neutral"
            icon={CheckSquare}
            href="/tasks"
          />
          <StatCard
            label="Eventi 7gg"
            value={aggregates.eventsThisWeek.length}
            hint={aggregates.eventsToday.length ? `${aggregates.eventsToday.length} oggi` : "Nessuno oggi"}
            tone="neutral"
            icon={CalendarDays}
            href="/tools/events"
          />
          <StatCard
            label="Da approvare"
            value={aggregates.reportsToApprove.length + aggregates.reportsToSend.length}
            hint={
              aggregates.reportsToApprove.length || aggregates.reportsToSend.length
                ? `${aggregates.reportsToApprove.length} in revisione · ${aggregates.reportsToSend.length} da inviare`
                : "Nessun report pendente"
            }
            tone={aggregates.reportsToApprove.length + aggregates.reportsToSend.length > 0 ? "warn" : "ok"}
            icon={Inbox}
            href="/tools/reports"
          />
        </div>

        {/* Sezioni principali */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                ];
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
                        onClick={() => navigate(taskHref(t))}
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
                        className="w-full text-center text-[10px] text-muted-foreground hover:underline pt-1"
                      >
                        Collassa
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          </SectionCard>

          {/* Eventi prossimi */}
          <SectionCard
            title="Eventi prossimi (7gg)"
            icon={CalendarDays}
            action={<Link href="/tools/events"><span className="text-xs text-primary hover:underline inline-flex items-center gap-1">Tutti gli eventi <ChevronRight size={12} /></span></Link>}
            empty={aggregates.eventsThisWeek.length === 0}
          >
            <div className="space-y-2">
              {aggregates.eventsThisWeek.slice(0, 6).map((e: AnyObj) => (
                <div key={e.id} className="flex items-start gap-2.5 rounded-lg border border-card-border/60 p-2.5">
                  <span className="h-2 w-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: e.clientColor || "#7a8f5c" }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{e.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDate(e.date)}{e.clientName ? ` · ${e.clientName}` : ""}
                    </p>
                  </div>
                  <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 shrink-0">{e.type}</span>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Da approvare / inviare */}
          <SectionCard
            title="Da approvare / inviare"
            icon={Inbox}
            action={<Link href="/tools/reports"><span className="text-xs text-primary hover:underline inline-flex items-center gap-1">Tutti i report <ChevronRight size={12} /></span></Link>}
            empty={aggregates.reportsToApprove.length === 0 && aggregates.reportsToSend.length === 0}
          >
            <div className="space-y-2">
              {aggregates.reportsToApprove.slice(0, 4).map((r: AnyObj) => (
                <Link key={r.id} href="/tools/reports">
                  <div className="flex items-start gap-2.5 rounded-lg border border-card-border/60 p-2.5 hover:bg-muted/40 transition-colors cursor-pointer">
                    <FileText size={14} className="text-amber-600 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{r.titolo ?? r.title ?? "Report"}</p>
                      <p className="text-[11px] text-muted-foreground">In attesa di approvazione{r.clientName ? ` · ${r.clientName}` : ""}</p>
                    </div>
                  </div>
                </Link>
              ))}
              {aggregates.reportsToSend.slice(0, 4).map((r: AnyObj) => (
                <Link key={r.id} href="/tools/reports">
                  <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 hover:bg-emerald-100 transition-colors cursor-pointer">
                    <FileText size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{r.titolo ?? r.title ?? "Report"}</p>
                      <p className="text-[11px] text-emerald-700">Pronto da inviare{r.clientName ? ` · ${r.clientName}` : ""}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </SectionCard>

          {/* Promemoria intelligenti */}
          <SectionCard
            title="Promemoria"
            icon={AlertTriangle}
            empty={aggregates.briefsIncomplete.length === 0 && aggregates.contractsExpiring.length === 0}
          >
            <div className="space-y-2">
              {aggregates.briefsIncomplete.slice(0, 4).map((b) => (
                <Link key={b.clientId} href={`/clients/${b.clientId}`}>
                  <div className="flex items-center gap-2.5 rounded-lg border border-card-border/60 p-2.5 hover:bg-muted/40 transition-colors cursor-pointer">
                    <BookOpen size={14} className="text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">Brief incompleto: {b.name}</p>
                      <p className="text-[11px] text-muted-foreground">Compilato al {b.pct}%</p>
                    </div>
                    <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                  </div>
                </Link>
              ))}
              {aggregates.contractsExpiring.slice(0, 4).map((c: AnyObj) => (
                <Link key={c.id} href={`/clients/${c.clientId}`}>
                  <div className="flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-2.5 hover:bg-amber-100 transition-colors cursor-pointer">
                    <Receipt size={14} className="text-amber-600 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">Contratto in scadenza: {c.clientName ?? "Cliente"}</p>
                      <p className="text-[11px] text-amber-700">Scade il {formatDate(c.dataFine)}</p>
                    </div>
                    <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          </SectionCard>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
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
          onClick={(t) => { setPopupOpen(false); navigate(taskHref(t)); }}
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
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <Sun size={18} className="text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-base">Task di oggi</h2>
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
              <h3 className="text-[10px] uppercase tracking-widest text-amber-700 font-semibold mb-2 flex items-center gap-1.5">
                <AlertTriangle size={11} /> In ritardo ({tasksOverdue.length})
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
              <h3 className="text-[10px] uppercase tracking-widest text-foreground/70 font-semibold mb-2 flex items-center gap-1.5">
                <CheckSquare size={11} /> Da fare oggi ({tasksToday.length})
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
              <h3 className="text-[10px] uppercase tracking-widest text-emerald-700 font-semibold mb-2 flex items-center gap-1.5">
                <Check size={11} /> Completate oggi ({tasksDoneToday.length})
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
          <p className="text-[11px] text-muted-foreground">
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
