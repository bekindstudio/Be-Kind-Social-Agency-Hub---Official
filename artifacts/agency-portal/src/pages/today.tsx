import { useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { portalFetch } from "@workspace/api-client-react";
import { useSupabaseAuth } from "@/auth/SupabaseAuthContext";
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
      <div className="p-6 md:p-8 max-w-6xl mx-auto">
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
          {/* Da fare oggi */}
          <SectionCard
            title="Da fare oggi"
            icon={CheckSquare}
            action={<Link href="/tasks"><span className="text-xs text-primary hover:underline inline-flex items-center gap-1">Tutte le task <ChevronRight size={12} /></span></Link>}
            empty={aggregates.tasksOverdue.length === 0 && aggregates.tasksToday.length === 0}
          >
            <div className="space-y-2">
              {aggregates.tasksOverdue.slice(0, 4).map((t: AnyObj) => (
                <button key={t.id} onClick={() => navigate("/tasks")} className="w-full flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-left hover:bg-amber-100 transition-colors">
                  <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    <p className="text-[11px] text-amber-700">
                      Scaduta il {formatDate(t.dueDate)}{t.projectName ? ` · ${t.projectName}` : ""}
                    </p>
                  </div>
                </button>
              ))}
              {aggregates.tasksToday.slice(0, 5).map((t: AnyObj) => (
                <button key={t.id} onClick={() => navigate("/tasks")} className="w-full flex items-start gap-2.5 rounded-lg border border-card-border/60 p-2.5 text-left hover:bg-muted/40 transition-colors">
                  <CheckSquare size={14} className="text-primary mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Oggi{t.projectName ? ` · ${t.projectName}` : ""}
                    </p>
                  </div>
                  {t.priority === "urgent" && <span className="text-[10px] rounded-full bg-rose-100 text-rose-700 px-2 py-0.5">Urgente</span>}
                </button>
              ))}
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
    </Layout>
  );
}
