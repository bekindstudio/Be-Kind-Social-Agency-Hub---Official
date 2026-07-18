import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useGetDashboardSummary,
  useGetRecentActivity,
  useGetProjectStatusBreakdown,
  useListProjects,
  useListTasks,
  useListClients,
  portalFetch,
  getListTasksQueryKey,
  getGetRecentActivityQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { useClientContext } from "@/context/ClientContext";
import { useSmartReminders } from "@/hooks/useSmartReminders";
import { cn, formatDate, PRIORITY_COLORS } from "@/lib/utils";
import {
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  CheckSquare,
  Users,
  AlertTriangle,
  CalendarDays,
  MessageCircle,
  Settings,
  GripVertical,
  Inbox,
  ArrowRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

type AnyObj = Record<string, any>;

function arr<T = AnyObj>(v: any): T[] {
  if (!v) return [];
  if (Array.isArray(v)) return v as T[];
  if (Array.isArray(v?.items)) return v.items as T[];
  return [v as T].filter(Boolean);
}

function buildMonthDays(current: Date): Date[] {
  const first = new Date(current.getFullYear(), current.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7;
  const start = new Date(current.getFullYear(), current.getMonth(), 1 - startOffset);
  return Array.from({ length: 42 }, (_, idx) => {
    const d = new Date(start);
    d.setDate(start.getDate() + idx);
    d.setHours(0, 0, 0, 0);
    return d;
  });
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfDay(dateInput: string | Date): Date {
  const date = typeof dateInput === "string" ? new Date(dateInput) : new Date(dateInput);
  date.setHours(0, 0, 0, 0);
  return date;
}

const KPI_COLORS = ["bg-indigo-500", "bg-amber-500", "bg-emerald-500", "bg-violet-500"];

function KpiCard({ title, value, sub, trend, color, onClick, progress }: { title: string; value: string | number; sub: string; trend?: string; color: string; onClick?: () => void; progress?: number }) {
  return (
    <button onClick={onClick} className="text-left bg-card border border-card-border rounded-xl p-4 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        <span className={cn("w-2.5 h-2.5 rounded-full", color)} />
      </div>
      <p className="text-3xl font-bold mt-1">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
      {trend && <p className="text-xs text-primary mt-1">{trend}</p>}
      {progress != null && (
        <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      )}
    </button>
  );
}

function AgencyKpiTile({ label, value, trend }: { label: string; value: string; trend?: string }) {
  return (
    <div className="rounded-lg border border-card-border p-3 bg-card">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-xl font-bold mt-1 tabular-nums">{value}</p>
      {trend && <p className="text-xs text-muted-foreground mt-0.5">{trend}</p>}
    </div>
  );
}

function FunnelStage({ label, value, referenceMax, color, rate }: { label: string; value: number; referenceMax: number; color: string; rate?: number }) {
  const widthPct = referenceMax > 0 ? Math.max(4, Math.round((value / referenceMax) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-32 text-xs font-medium shrink-0">{label}</div>
      <div className="flex-1 h-7 bg-muted rounded relative overflow-hidden">
        <div className="h-full transition-all flex items-center justify-end px-2" style={{ width: `${widthPct}%`, backgroundColor: color }}>
          <span className="text-xs font-bold text-white tabular-nums">{value}</span>
        </div>
      </div>
      {rate != null && (
        <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">{rate}%</span>
      )}
    </div>
  );
}

function trendDelta(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? "Nuovo questo mese" : "Nessun dato precedente";
  const delta = ((current - previous) / previous) * 100;
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${Math.round(delta)}% vs mese scorso`;
}

// Solo i widget che hanno un CORPO renderizzato qui sotto. Prima la lista
// includeva 4 chiavi (scadenze, clienti_attention, attivita_team,
// messaggi_non_letti) senza corpo → 4 card vuote in colonna, e i toggle delle
// Preferenze non controllavano i pannelli veri (che vivono nella colonna destra).
// task_oggi rimosso (ridisegno 3 schermate): la lista task vive tutta su Oggi,
// la Dashboard è "come va", non un'altra lista operativa.
const DEFAULT_WIDGETS = [
  "progetti_corso",
  "editoriale",
  "adv",
] as const;
// Guard: non renderizzare una card se per quella chiave non esiste un corpo
// (protegge da stati widget salvati in localStorage con le vecchie chiavi,
// task_oggi incluso).
const WIDGETS_WITH_BODY = new Set<string>(["progetti_corso", "editoriale", "adv"]);

type WidgetKey = (typeof DEFAULT_WIDGETS)[number];

/* ─── Cruscotto visivo (Wave BT) ─────────────────────────────────────────
   Anello di completamento + riquadro grafico icona/numero. Poco testo. */
function Ring({ value, total, size = 54 }: { value: number; total: number; size?: number }) {
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  const r = (size - 7) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={6} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="hsl(var(--primary))" strokeWidth={6} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="fill-foreground font-bold" fontSize={size * 0.26}>
        {total > 0 ? `${Math.round(pct * 100)}%` : "—"}
      </text>
    </svg>
  );
}

function StatTile({ icon: Icon, value, label, accent, onClick }: { icon: any; value: number | string; label: string; accent: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-card-border bg-card p-4 transition-colors hover:bg-muted/40"
    >
      <Icon size={22} className={accent} />
      <span className="text-2xl md:text-3xl font-bold tabular-nums leading-none">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </button>
  );
}

function usePortalJsonQuery<T>(path: string, staleTime: number) {
  return useQuery({
    queryKey: [path],
    queryFn: async () => {
      const r = await portalFetch(path);
      if (!r.ok) return null;
      return r.json() as Promise<T>;
    },
    staleTime,
  });
}

type TaskTrendRow = { month: string; creati: number; completati: number };
type RevenuePayload = { totalQuotes?: number; totalRevenue?: number; approvedQuotes?: number };

export default function Dashboard() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { posts } = useClientContext();
  const smartReminders = useSmartReminders();
  // La Dashboard è SEMPRE generale (tutta l'agenzia), indipendente dal cliente
  // selezionato nella barra in alto: nessun filtro per cliente attivo.
  const tasksQueryParams = {} as Record<string, never>;
  const { data: summary } = useGetDashboardSummary();
  type PendingApprovalsRes = {
    items: Array<{ id: string; kind: string; title: string; clientId: number; clientName: string; clientColor: string; dueAt: string | null; href: string; badge: string }>;
    counts: { total: number; postApproval: number; reportReview: number; reportSend: number; contractExpiring: number };
  };
  const { data: pendingApprovals } = useQuery<PendingApprovalsRes>({
    queryKey: ["dashboard-pending-approvals"],
    queryFn: async () => {
      const r = await portalFetch("/api/dashboard/pending-approvals");
      if (!r.ok) return { items: [], counts: { total: 0, postApproval: 0, reportReview: 0, reportSend: 0, contractExpiring: 0 } };
      return r.json();
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  type AgencyKpi = {
    month: { label: string; revenue: number; revenuePrev: number; quotesCreated: number; quotesAccepted: number; acceptanceRate: number; projectsStarted: number; projectsCompleted: number };
    funnel: { totalQuotes: number; acceptedQuotes: number; signedContracts: number; activeProjects: number; completedProjects: number };
    topClients: Array<{ id: number; name: string; revenue: number }>;
    renewalsCount: number;
  };
  type EditorialWeekAll = {
    weekStart: string;
    weekEnd: string;
    clients: Array<{
      id: number; name: string; color: string;
      days: Array<{ draft: number; pending: number; approved: number; published: number; rejected: number; total: number }>;
      totals: { draft: number; pending: number; approved: number; published: number; rejected: number; total: number };
    }>;
    overall: { total: number; pending: number; approved: number; published: number };
  };
  const { data: editorialAll } = useQuery<EditorialWeekAll>({
    queryKey: ["dashboard-editorial-week-all"],
    queryFn: async () => {
      const r = await portalFetch("/api/dashboard/editorial-week-all");
      if (!r.ok) throw new Error("editorial-week fetch failed");
      return r.json();
    },
    staleTime: 60_000,
    refetchInterval: 180_000,
  });

  const { data: agencyKpi } = useQuery<AgencyKpi>({
    queryKey: ["dashboard-agency-kpi"],
    queryFn: async () => {
      const r = await portalFetch("/api/dashboard/agency-kpi");
      if (!r.ok) throw new Error("kpi fetch failed");
      return r.json();
    },
    staleTime: 5 * 60_000,
  });
  const { data: activityRaw } = useGetRecentActivity();
  const { data: statusRaw } = useGetProjectStatusBreakdown();
  const { data: projectsRaw } = useListProjects({});
  const { data: tasksRaw } = useListTasks(tasksQueryParams as any);
  const { data: clientsRaw } = useListClients();
  // Calendario eventi UNIFICATO: tutti i clienti, indipendente dal cliente attivo.
  const { data: allEventsRaw } = useQuery({
    queryKey: ["dashboard", "events", "all"],
    staleTime: 60_000,
    queryFn: async () => {
      const r = await portalFetch("/api/dashboard/events", { credentials: "include" });
      if (!r.ok) return [];
      return (await r.json()) as AnyObj[];
    },
  });
  const allClientEvents = useMemo(() => (Array.isArray(allEventsRaw) ? allEventsRaw : []), [allEventsRaw]);

  const [showAlertsAll, setShowAlertsAll] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [tasksTab, setTasksTab] = useState<"oggi" | "settimana" | "scadute">("oggi");
  const [widgets, setWidgets] = useState<WidgetKey[]>(() => {
    try {
      const saved = localStorage.getItem("dashboard-widgets-order-v1");
      if (!saved) return [...DEFAULT_WIDGETS];
      const parsed = JSON.parse(saved) as WidgetKey[];
      return parsed.length ? parsed : [...DEFAULT_WIDGETS];
    } catch {
      return [...DEFAULT_WIDGETS];
    }
  });
  const [hiddenWidgets, setHiddenWidgets] = useState<WidgetKey[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("dashboard-widgets-hidden-v1") ?? "[]");
    } catch {
      return [];
    }
  });
  const [showDashPrefs, setShowDashPrefs] = useState(false);
  const [eventsMonthCursor, setEventsMonthCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const { data: taskTrends } = usePortalJsonQuery<TaskTrendRow[]>("/api/dashboard/task-trends", 60_000);
  const { data: revenueData } = usePortalJsonQuery<RevenuePayload>("/api/dashboard/revenue", 60_000);
  const { data: reportCounts } = usePortalJsonQuery<Record<string, number>>("/api/reports/counts", 60_000);

  useEffect(() => {
    localStorage.setItem("dashboard-widgets-order-v1", JSON.stringify(widgets));
  }, [widgets]);
  useEffect(() => {
    localStorage.setItem("dashboard-widgets-hidden-v1", JSON.stringify(hiddenWidgets));
  }, [hiddenWidgets]);

  const projects = arr(projectsRaw);
  const tasks = arr(tasksRaw);
  const clients = arr(clientsRaw);
  const activity = arr(activityRaw);
  const statusBreakdown = arr(statusRaw);

  const now = new Date();
  const weekEnd = new Date();
  weekEnd.setDate(now.getDate() + 7);
  const in14 = new Date();
  in14.setDate(now.getDate() + 14);

  // `dueDate` è una data "YYYY-MM-DD": confrontarla con l'istante corrente la
  // faceva risultare "scaduta" già dalle 02:00 (mezzanotte UTC in ora italiana).
  // Confronto sempre per GIORNO locale, come today.tsx e isOverdue().
  const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
  const isSameLocalDay = (ds: string) => {
    const d = new Date(ds);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  };
  const isBeforeToday = (ds: string) => { const d = new Date(ds); d.setHours(0, 0, 0, 0); return d < startToday; };
  const dedupById = (list: AnyObj[]) => {
    const seen = new Set<unknown>();
    return list.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
  };

  const tasksDueTodayAll = tasks.filter((t: AnyObj) => t.dueDate && isSameLocalDay(t.dueDate));
  const tasksDueToday = tasksDueTodayAll.filter((t: AnyObj) => t.status !== "done");
  const tasksOverdue = tasks.filter((t: AnyObj) => t.status !== "done" && t.dueDate && isBeforeToday(t.dueDate));
  // "Questa settimana": da oggi (incluso) a +7 giorni, solo non completate.
  const tasksDueWeek = tasks.filter(
    (t: AnyObj) => t.status !== "done" && t.dueDate && !isBeforeToday(t.dueDate) && new Date(t.dueDate) <= weekEnd,
  );
  // Insieme unico "oggi": scadute + in scadenza oggi, senza contare due volte.
  const tasksTodayList = dedupById([...tasksOverdue, ...tasksDueTodayAll]);
  const tasksTodayTotal = tasksTodayList.length;
  const tasksTodayDone = tasksTodayList.filter((t: AnyObj) => t.status === "done").length;

  const activeProjects = projects.filter((p: AnyObj) => p.status === "active");
  const dueWeekProjects = activeProjects.filter((p: AnyObj) => p.deadline && new Date(p.deadline) <= weekEnd);
  const clientsAtRisk = clients.filter((c: AnyObj) => Number(c.healthScore ?? 0) < 60);

  const y = now.getFullYear();
  const mo = now.getMonth();
  const newClientsMonth = clients.filter((c: AnyObj) => {
    const d = c.createdAt ? new Date(c.createdAt as string) : null;
    return d && d.getMonth() === mo && d.getFullYear() === y;
  }).length;

  const upcomingDeadlines = useMemo(() => {
    const nowMs = Date.now();
    const in14Ms = in14.getTime();
    const fromTasks = tasks
      .filter((task: AnyObj) => task.dueDate && new Date(task.dueDate).getTime() >= nowMs && new Date(task.dueDate).getTime() <= in14Ms)
      .map((task: AnyObj) => ({
        type: "task",
        title: task.title,
        when: task.dueDate,
        priority: task.priority,
        ref: "/tasks",
      }));
    const fromProjects = projects
      .filter((project: AnyObj) => project.deadline && new Date(project.deadline).getTime() >= nowMs && new Date(project.deadline).getTime() <= in14Ms)
      .map((project: AnyObj) => ({
        type: "deadline",
        title: project.name,
        when: project.deadline,
        priority: "high",
        ref: `/projects/${project.id}`,
      }));
    const fromEditorialCalendar = posts
      .filter((post) => post.status !== "published")
      .filter((post) => {
        const t = new Date(post.scheduledDate).getTime();
        return t >= nowMs && t <= in14Ms;
      })
      .map((post) => ({
        type: "calendar_post",
        title: `Post: ${post.title}`,
        when: post.scheduledDate,
        priority: post.status === "pending_approval" ? "high" : "medium",
        ref: "/tools/calendar",
      }));
    const fromEventsCalendar = allClientEvents
      .filter((event) => {
        const start = new Date(event.date).getTime();
        const end = event.endDate ? new Date(event.endDate).getTime() : start;
        return end >= nowMs && start <= in14Ms;
      })
      .map((event) => ({
        type: "event",
        title: `Evento: ${event.title}`,
        when: event.date,
        priority: event.priority,
        ref: "/tools/events",
      }));

    return [...fromTasks, ...fromProjects, ...fromEditorialCalendar, ...fromEventsCalendar]
      .sort((a, b) => new Date(a.when).getTime() - new Date(b.when).getTime())
      .slice(0, 8);
  }, [allClientEvents, in14, posts, projects, tasks]);

  const alerts = useMemo(() => {
    const list: Array<{ id: string; level: "critical" | "warning" | "info"; text: string; href: string }> = [];
    for (const p of projects.filter((x: AnyObj) => x.healthStatus === "delayed").slice(0, 2)) {
      list.push({ id: `delayed-${p.id}`, level: "critical", text: `Progetto ${p.name} è in ritardo`, href: `/projects/${p.id}` });
    }
    for (const c of clients.filter((x: AnyObj) => x.contractStatus === "scaduto").slice(0, 1)) {
      list.push({ id: `expired-${c.id}`, level: "critical", text: `Contratto ${c.name} scaduto`, href: `/clients/${c.id}` });
    }
    if (tasksOverdue.length > 0) list.push({ id: "overdue-tasks", level: "critical", text: `${tasksOverdue.length} task scadute oggi senza completamento`, href: "/tasks" });
    for (const c of clients.filter((x: AnyObj) => x.contractStatus === "in_scadenza").slice(0, 2)) {
      list.push({ id: `expiring-${c.id}`, level: "warning", text: `Contratto ${c.name} scade presto`, href: `/clients/${c.id}` });
    }
    for (const p of projects.filter((x: AnyObj) => Number(x.budget ?? 0) > 0 && (Number(x.budgetSpeso ?? 0) / Number(x.budget ?? 1)) >= 0.85).slice(0, 2)) {
      list.push({ id: `budget-${p.id}`, level: "warning", text: `Budget ${p.name} all'85%`, href: `/projects/${p.id}` });
    }
    return list.filter((a) => !dismissed.includes(a.id));
  }, [projects, clients, tasksOverdue.length, dismissed]);

  const shownAlerts = showAlertsAll ? alerts : alerts.slice(0, 5);
  const pieData = statusBreakdown.map((s: AnyObj) => ({ name: s.status, value: s.count }));

  const { trendData, projectLine } = useMemo(() => {
    const rows = Array.isArray(taskTrends) ? taskTrends : [];
    if (rows.length === 0) {
      return {
        trendData: [{ week: "—", done: 0, creati: 0 }],
        projectLine: [{ period: "—", avviati: 0, completati: 0 }],
      };
    }
    return {
      trendData: rows.map((m) => ({
        week: m.month,
        done: Number(m.completati ?? 0),
        creati: Number(m.creati ?? 0),
      })),
      projectLine: rows.map((m) => ({
        period: m.month,
        avviati: Number(m.creati ?? 0),
        completati: Number(m.completati ?? 0),
      })),
    };
  }, [taskTrends]);

  const reportsInviatiCount = useMemo(() => {
    if (!reportCounts) return null;
    const inv = (reportCounts.inviato ?? 0) + (reportCounts.inviato_al_cliente ?? 0);
    return inv;
  }, [reportCounts]);
  const editorialWeek = useMemo(() => {
    const labels = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
    const weekStart = startOfDay(new Date());
    const offset = (weekStart.getDay() + 6) % 7;
    weekStart.setDate(weekStart.getDate() - offset);
    const weekEndDate = new Date(weekStart);
    weekEndDate.setDate(weekStart.getDate() + 6);
    weekEndDate.setHours(23, 59, 59, 999);

    const initial = labels.map((label) => ({
      day: label,
      post: 0,
      draft: 0,
      pending: 0,
      approved: 0,
      published: 0,
    }));

    posts.forEach((post) => {
      const scheduled = new Date(post.scheduledDate);
      if (scheduled < weekStart || scheduled > weekEndDate) return;
      const idx = (scheduled.getDay() + 6) % 7;
      initial[idx].post += 1;
      if (post.status === "draft") initial[idx].draft += 1;
      if (post.status === "pending_approval") initial[idx].pending += 1;
      if (post.status === "approved") initial[idx].approved += 1;
      if (post.status === "published") initial[idx].published += 1;
    });

    return initial;
  }, [posts]);
  const editorialWeekTotals = useMemo(() => {
    const weekTotal = editorialWeek.reduce((acc, day) => acc + day.post, 0);
    const pendingTotal = editorialWeek.reduce((acc, day) => acc + day.pending, 0);
    return { weekTotal, pendingTotal };
  }, [editorialWeek]);
  // Nessun dato finto: questi widget si popolano da fonti reali quando disponibili.
  // - messaggi: nessun tracciamento "non letti" ancora → vuoto finché non implementato
  // - campagne ADV: gli account Meta/Google non sono collegati → vuoto
  const unreadMessages: { id: number; channel: string; preview: string; time: string; unread: number }[] = [];
  const advCampaigns: { id: number; client: string; name: string; platform: string; spesa: number; kpi: string; status: string }[] = [];

  const visibleWidget = (k: WidgetKey) => !hiddenWidgets.includes(k);
  const moveWidget = (idx: number, delta: number) => {
    const to = idx + delta;
    if (to < 0 || to >= widgets.length) return;
    const next = [...widgets];
    const [x] = next.splice(idx, 1);
    next.splice(to, 0, x);
    setWidgets(next);
  };

  const onToggleTaskDone = async (task: AnyObj) => {
    try {
      const res = await portalFetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: task.status === "done" ? "todo" : "done" }),
      });
      if (!res.ok) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(tasksQueryParams as any) }),
        queryClient.invalidateQueries({ queryKey: getGetRecentActivityQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }),
      ]);
    } catch {
      /* ignore */
    }
  };

  const taskListByTab = tasksTab === "oggi" ? tasksTodayList : tasksTab === "settimana" ? tasksDueWeek : tasksOverdue;
  const riskProjects = projects.filter((p: AnyObj) => p.healthStatus === "at-risk" || p.healthStatus === "delayed").slice(0, 5);
  const eventDays = useMemo(() => buildMonthDays(eventsMonthCursor), [eventsMonthCursor]);
  const eventMonth = eventsMonthCursor.getMonth();
  const eventYear = eventsMonthCursor.getFullYear();
  const eventsByDay = useMemo(() => {
    const map = new Map<string, typeof allClientEvents>();
    for (const event of allClientEvents) {
      const start = startOfDay(event.date);
      const end = event.endDate ? startOfDay(event.endDate) : start;
      const safeEnd = end.getTime() >= start.getTime() ? end : start;
      const span = Math.min(90, Math.floor((safeEnd.getTime() - start.getTime()) / 86400000));
      for (let idx = 0; idx <= span; idx += 1) {
        const d = new Date(start);
        d.setDate(start.getDate() + idx);
        const key = dayKey(d);
        const current = map.get(key) ?? [];
        map.set(key, [...current, event]);
      }
    }
    return map;
  }, [allClientEvents]);

  return (
    <Layout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
        {/* Hero (Wave BP): unica headline actionable + sotto-riga di contesto.
            L'header doppione (saluto/ricerca/profilo) è stato rimosso: campanella
            e "Nuovo" sono nella topbar globale, profilo/logout nella sidebar.
            Il blocco è cliccabile → porta a /today (la lista del giorno). */}
        {(() => {
          const pendingTotal = pendingApprovals?.counts?.total ?? 0;
          const actionable = pendingTotal + tasksOverdue.length;
          return (
            <div
              role="button"
              tabIndex={0}
              onClick={() => navigate("/today")}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/today"); } }}
              className="cursor-pointer rounded-xl -mx-2 px-2 py-1 transition-colors hover:bg-muted/40"
            >
              {actionable === 0 ? (
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                  Tutto sotto controllo. <span className="text-emerald-600">Nessuna azione urgente ✓</span>
                </h1>
              ) : (
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                  Hai <span className="text-primary tabular-nums">{actionable}</span> {actionable === 1 ? "cosa" : "cose"} da gestire
                  {tasksOverdue.length > 0 && (
                    <span className="text-amber-600">, {tasksOverdue.length} {tasksOverdue.length === 1 ? "task scaduta" : "task scadute"}</span>
                  )}
                </h1>
              )}
              <p className="text-sm text-muted-foreground mt-2">
                {activeProjects.length} progetti attivi · {tasksTodayTotal} task per oggi ({tasksTodayDone} {tasksTodayDone === 1 ? "fatta" : "fatte"}) · {clients.length} clienti attivi
              </p>
            </div>
          );
        })()}

        {/* ───────── Cruscotto visivo (Wave BT) ─────────
            Numeri chiave a colpo d'occhio, pochissimo testo. Tutti i dettagli
            (KPI, code, calendari, widget, insights) sono sotto "Mostra tutti i
            dettagli": nessun dato eliminato, solo nascosto di default. */}
        {(() => {
          const todayStart = startOfDay(new Date());
          const eventsThisWeekCount = allClientEvents.filter((e: AnyObj) => {
            const d = new Date(e.date);
            return d >= todayStart && d <= weekEnd;
          }).length;
          const healthProjects = (riskProjects.length ? riskProjects : activeProjects).slice(0, 5);
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatTile icon={Users} value={clients.length} label="Clienti" accent="text-sky-500" onClick={() => navigate("/clients")} />
                <StatTile icon={FolderKanban} value={projects.length} label="Progetti" accent="text-primary" onClick={() => navigate("/projects")} />
                <button
                  type="button"
                  onClick={() => navigate("/today")}
                  className="flex items-center justify-center gap-3 rounded-2xl border border-card-border bg-card p-4 transition-colors hover:bg-muted/40"
                >
                  <Ring value={tasksTodayDone} total={tasksTodayTotal} />
                  <div className="text-left leading-tight">
                    <p className="text-sm font-semibold">Task oggi</p>
                    <p className="text-xs text-muted-foreground tabular-nums">{tasksTodayDone}/{tasksTodayTotal} fatte</p>
                    {tasksOverdue.length > 0 && <p className="text-xs text-amber-600">{tasksOverdue.length} in ritardo</p>}
                  </div>
                </button>
                <StatTile icon={CalendarDays} value={eventsThisWeekCount} label="Eventi 7gg" accent="text-rose-500" onClick={() => navigate("/agenda?view=calendar")} />
              </div>

              <div>
                {healthProjects.length > 0 && (
                  <div className="rounded-2xl border border-card-border bg-card p-4">
                    <p className="text-sm font-semibold mb-3">Salute progetti</p>
                    <div className="space-y-2.5">
                      {healthProjects.map((p: AnyObj) => {
                        const prog = Math.max(0, Math.min(100, Number(p.progress ?? 0)));
                        const bar = p.healthStatus === "delayed" ? "bg-rose-500" : p.healthStatus === "at-risk" ? "bg-amber-500" : "bg-emerald-500";
                        return (
                          <button key={p.id} type="button" onClick={() => navigate(`/projects/${p.id}`)} className="w-full text-left">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="font-medium truncate">{p.name}</span>
                              <span className="text-muted-foreground tabular-nums shrink-0 ml-2">{prog}%</span>
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                              <div className={cn("h-full rounded-full", bar)} style={{ width: `${prog}%` }} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Dettagli completi (Wave BT): tutto il resto della dashboard
            collassato di default per "vedere meno". Nessun dato eliminato. */}
        <details className="group rounded-xl border border-card-border bg-card/30">
          <summary className="cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden px-4 py-3 flex items-center justify-between text-sm font-medium">
            <span className="inline-flex items-center gap-2"><Inbox size={15} className="text-muted-foreground" /> Mostra tutti i dettagli</span>
            <ChevronDown size={16} className="text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-4 pb-4 space-y-6">

        {/* KPI Agenzia (mese corrente + funnel Quote→Project)
            Wave BI: scende DOPO "In attesa di te" — è informativo, non
            actionable: chi apre la Dashboard di solito vuole vedere prima
            cosa va sistemato, non i KPI commerciali del mese. */}
        {agencyKpi && (
          <details className="bg-card border border-card-border rounded-xl group">
            <summary className="cursor-pointer p-4 flex items-center justify-between gap-2 list-none [&::-webkit-details-marker]:hidden">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">KPI Agenzia · {agencyKpi.month.label}</p>
                <h3 className="font-semibold text-sm mt-0.5">Numeri del mese e funnel commerciale</h3>
              </div>
              <ChevronDown size={16} className="text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="px-4 pb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <AgencyKpiTile
                label="Fatturato mese"
                value={`€ ${Math.round(agencyKpi.month.revenue).toLocaleString("it-IT")}`}
                trend={trendDelta(agencyKpi.month.revenue, agencyKpi.month.revenuePrev)}
              />
              <AgencyKpiTile
                label="Quote create"
                value={String(agencyKpi.month.quotesCreated)}
                trend={`${agencyKpi.month.quotesAccepted} accettate · ${agencyKpi.month.acceptanceRate}%`}
              />
              <AgencyKpiTile
                label="Progetti avviati"
                value={String(agencyKpi.month.projectsStarted)}
                trend={`${agencyKpi.month.projectsCompleted} completati`}
              />
              <AgencyKpiTile
                label="Rinnovi 90gg"
                value={String(agencyKpi.renewalsCount)}
                trend={agencyKpi.renewalsCount > 0 ? "contratti in scadenza" : "nessun rinnovo imminente"}
              />
            </div>

            {/* Funnel orizzontale Quote → Contract → Project */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Funnel commerciale (totali)</p>
              <FunnelStage
                label="Quote totali"
                value={agencyKpi.funnel.totalQuotes}
                referenceMax={agencyKpi.funnel.totalQuotes}
                color="#94a3b8"
              />
              <FunnelStage
                label="Quote accettate"
                value={agencyKpi.funnel.acceptedQuotes}
                referenceMax={agencyKpi.funnel.totalQuotes}
                color="#7a8f5c"
                rate={agencyKpi.funnel.totalQuotes > 0 ? Math.round((agencyKpi.funnel.acceptedQuotes / agencyKpi.funnel.totalQuotes) * 100) : 0}
              />
              <FunnelStage
                label="Contratti firmati"
                value={agencyKpi.funnel.signedContracts}
                referenceMax={agencyKpi.funnel.totalQuotes}
                color="#4a6629"
                rate={agencyKpi.funnel.acceptedQuotes > 0 ? Math.round((agencyKpi.funnel.signedContracts / agencyKpi.funnel.acceptedQuotes) * 100) : 0}
              />
              <FunnelStage
                label="Progetti avviati"
                value={agencyKpi.funnel.activeProjects}
                referenceMax={agencyKpi.funnel.totalQuotes}
                color="#2d3f1c"
                rate={agencyKpi.funnel.signedContracts > 0 ? Math.round((agencyKpi.funnel.activeProjects / agencyKpi.funnel.signedContracts) * 100) : 0}
              />
            </div>

            {agencyKpi.topClients.length > 0 && (
              <div className="mt-4 pt-3 border-t border-card-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Top 5 clienti per fatturato accettato</p>
                <div className="space-y-1">
                  {agencyKpi.topClients.map((tc, i) => (
                    <div key={tc.id} className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground tabular-nums w-4">{i + 1}.</span>
                      <button onClick={() => navigate(`/clients/${tc.id}`)} className="font-medium truncate hover:text-primary text-left flex-1">
                        {tc.name}
                      </button>
                      <span className="font-semibold tabular-nums">€ {Math.round(tc.revenue).toLocaleString("it-IT")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            </div>
          </details>
        )}

        {/* Coda unificata: cose in attesa di azione cross-cliente */}
        {pendingApprovals && pendingApprovals.items.length > 0 && (
          <div className="bg-card border border-card-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <Inbox size={18} className="text-amber-600 shrink-0" />
                <div>
                  <h3 className="font-semibold text-sm">In attesa di te</h3>
                  <p className="text-xs text-muted-foreground">
                    {pendingApprovals.counts.total} elementi richiedono un'azione
                    {pendingApprovals.counts.postApproval > 0 && ` · ${pendingApprovals.counts.postApproval} post`}
                    {pendingApprovals.counts.reportReview > 0 && ` · ${pendingApprovals.counts.reportReview} report da revisionare`}
                    {pendingApprovals.counts.reportSend > 0 && ` · ${pendingApprovals.counts.reportSend} da inviare`}
                    {pendingApprovals.counts.contractExpiring > 0 && ` · ${pendingApprovals.counts.contractExpiring} contratti in scadenza`}
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {pendingApprovals.items.slice(0, 12).map((item) => {
                const dueDate = item.dueAt ? new Date(item.dueAt) : null;
                const overdue = dueDate && dueDate < new Date();
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(item.href)}
                    className="w-full flex items-center gap-3 rounded-lg border border-card-border px-3 py-2 hover:bg-muted/40 transition-colors text-left"
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.clientColor }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.clientName} · {item.badge}
                      </p>
                    </div>
                    {dueDate && (
                      <span className={cn("text-xs tabular-nums shrink-0", overdue ? "text-red-600 font-semibold" : "text-muted-foreground")}>
                        {dueDate.toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                      </span>
                    )}
                    <ArrowRight size={13} className="text-muted-foreground shrink-0" />
                  </button>
                );
              })}
              {pendingApprovals.items.length > 12 && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  +{pendingApprovals.items.length - 12} altri
                </p>
              )}
            </div>
          </div>
        )}

        {/* Calendario editoriale settimana (tutti i clienti aggregati).
            B9: Array.isArray guard difensivo — se la response cambiasse forma o
            arrivasse parziale, il render non crasha. */}
        {editorialAll && Array.isArray(editorialAll.clients) && editorialAll.clients.length > 0 && editorialAll.overall && (
          <div className="bg-card border border-card-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Settimana corrente · tutti i clienti</p>
                <h3 className="font-semibold text-sm mt-0.5">Calendario editoriale aggregato</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {editorialAll.overall.total} contenuti · {editorialAll.overall.pending} da approvare · {editorialAll.overall.published} pubblicati
                </p>
              </div>
              <button onClick={() => navigate("/tools/calendar")} className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                Apri calendario completo <ArrowRight size={11} />
              </button>
            </div>

            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full text-xs min-w-[640px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-2 font-semibold text-muted-foreground w-44">Cliente</th>
                    {["Lun","Mar","Mer","Gio","Ven","Sab","Dom"].map((d) => (
                      <th key={d} className="text-center py-2 px-1 font-semibold text-muted-foreground">{d}</th>
                    ))}
                    <th className="text-right py-2 pl-2 font-semibold text-muted-foreground w-12">Tot</th>
                  </tr>
                </thead>
                <tbody>
                  {editorialAll.clients.slice(0, 10).map((cl) => (
                    <tr key={cl.id} className="border-b border-border/40 last:border-b-0 hover:bg-muted/20 transition-colors">
                      <td className="py-2 pr-2">
                        <button
                          onClick={() => navigate(`/clients/${cl.id}`)}
                          className="flex items-center gap-2 hover:text-primary text-left w-full"
                        >
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cl.color }} />
                          <span className="truncate font-medium">{cl.name}</span>
                        </button>
                      </td>
                      {cl.days.map((day, i) => (
                        <td key={i} className="text-center py-2 px-1">
                          {day.total > 0 ? (
                            <div className="inline-flex flex-col items-center gap-0.5" title={`Tot ${day.total} · pendenti ${day.pending} · approvati ${day.approved} · pubblicati ${day.published}`}>
                              <span className="text-xs font-semibold tabular-nums">{day.total}</span>
                              <div className="flex items-center gap-0.5">
                                {day.pending > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                                {day.approved > 0 && <span className="w-1.5 h-1.5 rounded-full bg-lime-500" />}
                                {day.published > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />}
                                {day.draft > 0 && day.pending === 0 && day.approved === 0 && day.published === 0 && <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/40">—</span>
                          )}
                        </td>
                      ))}
                      <td className="text-right py-2 pl-2 font-semibold tabular-nums">{cl.totals.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> In approvazione</span>
                <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-lime-500" /> Approvato</span>
                <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-600" /> Pubblicato</span>
                <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-zinc-400" /> Bozza</span>
              </div>
              {editorialAll.clients.length > 10 && (
                <span>+{editorialAll.clients.length - 10} clienti</span>
              )}
            </div>
          </div>
        )}

        {/* Alerts */}
        {smartReminders.reminders.length > 0 && (
          <div className="bg-card border border-card-border rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold">Reminder intelligenti</p>
              {smartReminders.unreadCount > 0 && (
                <button onClick={smartReminders.markAllRead} className="text-xs text-primary hover:underline">
                  Segna tutti letti
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {smartReminders.reminders.slice(0, 6).map((reminder) => (
                <button
                  key={reminder.id}
                  onClick={() => {
                    smartReminders.markRead(reminder.id);
                    navigate(reminder.link);
                  }}
                  className={cn(
                    "px-2.5 py-1.5 rounded-full text-xs border inline-flex items-center gap-1",
                    reminder.severity === "critical"
                      ? "bg-red-50 border-red-200 text-red-700"
                      : reminder.severity === "warning"
                        ? "bg-amber-50 border-amber-200 text-amber-700"
                        : "bg-blue-50 border-blue-200 text-blue-700",
                    !smartReminders.isRead(reminder.id) && "ring-1 ring-primary/30",
                  )}
                >
                  <AlertTriangle size={12} />
                  {reminder.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {alerts.length > 0 && (
          <div className="bg-card border border-card-border rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold">Alert & Urgenze</p>
              <div className="flex items-center gap-3">
                <button onClick={() => setDismissed(alerts.map((a) => a.id))} className="text-xs text-muted-foreground hover:underline">Ignora tutti</button>
                <button onClick={() => setShowAlertsAll((s) => !s)} className="text-xs text-primary hover:underline">{showAlertsAll ? "Mostra meno" : "Vedi tutti"}</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {shownAlerts.map((a) => (
                <button key={a.id} onClick={() => navigate(a.href)} className={cn("px-2.5 py-1.5 rounded-full text-xs border inline-flex items-center gap-1", a.level === "critical" ? "bg-red-50 border-red-200 text-red-700" : a.level === "warning" ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-blue-50 border-blue-200 text-blue-700")}>
                  <AlertTriangle size={12} /> {a.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          <div className="xl:col-span-3 space-y-4">
            {widgets.map((wk, idx) => visibleWidget(wk) && WIDGETS_WITH_BODY.has(wk) && (
              <div key={wk} className="bg-card border border-card-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-sm capitalize">{wk.replaceAll("_", " ")}</p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => moveWidget(idx, -1)} className="p-1 rounded hover:bg-muted"><GripVertical size={13} /></button>
                    <button onClick={() => moveWidget(idx, +1)} className="p-1 rounded hover:bg-muted"><ChevronDown size={13} /></button>
                  </div>
                </div>

                {wk === "progetti_corso" && (
                  <div className="space-y-2">
                    {(riskProjects.length === 0 ? activeProjects : riskProjects).slice(0, 5).map((p: AnyObj) => (
                      <button key={p.id} onClick={() => navigate(`/projects/${p.id}`)} className="w-full text-left border border-border rounded-lg p-3 hover:bg-muted/40">
                        <div className="flex items-center justify-between"><p className="font-medium text-sm">{p.name}</p><span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", p.healthStatus === "delayed" ? "bg-red-100 text-red-700" : p.healthStatus === "at-risk" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")}>{p.healthStatus ?? "on-track"}</span></div>
                        <p className="text-xs text-muted-foreground">{p.clientName ?? "Cliente"}</p>
                        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary" style={{ width: `${p.progress ?? 0}%` }} /></div>
                        <div className="mt-1 flex items-center justify-between text-xs"><span>€ {Number(p.budget ?? 0).toLocaleString("it-IT")}</span><span className={cn(p.deadline && new Date(p.deadline) <= weekEnd ? "text-red-600" : "text-muted-foreground")}>{p.deadline ? formatDate(p.deadline) : "—"}</span></div>
                      </button>
                    ))}
                    <Link href="/projects" className="text-xs text-primary hover:underline">Vedi tutto</Link>
                  </div>
                )}


                {wk === "editoriale" && (
                  <div>
                    <div className="grid grid-cols-7 gap-1">
                      {editorialWeek.map((d) => (
                        <div key={d.day} className="border border-border rounded-lg p-2 text-center">
                          <p className="text-[10px] text-muted-foreground mb-1">{d.day}</p>
                          <div className="flex justify-center gap-1 flex-wrap">
                            {d.post > 0 && <span className="w-2 h-2 rounded-full bg-violet-500" title="post" />}
                            {d.draft > 0 && <span className="w-2 h-2 rounded-full bg-slate-400" title="bozze" />}
                            {d.pending > 0 && <span className="w-2 h-2 rounded-full bg-amber-500" title="in approvazione" />}
                            {d.approved > 0 && <span className="w-2 h-2 rounded-full bg-blue-500" title="approvati" />}
                            {d.published > 0 && <span className="w-2 h-2 rounded-full bg-emerald-500" title="pubblicati" />}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {editorialWeekTotals.weekTotal} contenuti programmati questa settimana ·{" "}
                      <span className="text-amber-600">{editorialWeekTotals.pendingTotal} da approvare</span>
                    </p>
                  </div>
                )}

                {wk === "adv" && (
                  <div className="space-y-2">
                    {advCampaigns.length === 0 ? (
                      <div className="py-3 px-3 rounded-lg border border-dashed border-card-border bg-muted/30">
                        <p className="text-sm text-muted-foreground mb-1.5">Nessuna campagna attiva.</p>
                        <button
                          onClick={() => navigate("/settings")}
                          className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                        >
                          Collega Meta / Google ADV → <ArrowRight size={11} />
                        </button>
                      </div>
                    ) : (
                      <>
                        {advCampaigns.slice(0, 3).map((c) => <div key={c.id} className="border border-border rounded-lg p-2.5 text-sm"><p className="font-medium">{c.client} · {c.name}</p><p className="text-xs text-muted-foreground">{c.platform} · Spesa oggi €{c.spesa} · {c.kpi} · {c.status}</p></div>)}
                        <button onClick={() => navigate("/reports")} className="text-xs text-primary hover:underline">Vedi tutte le campagne</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="xl:col-span-2 space-y-4">
            <div className="bg-card border border-card-border rounded-xl p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-semibold text-sm">Calendario Eventi (tutti i clienti)</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEventsMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                    className="rounded border border-input p-1"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <p className="text-xs font-medium capitalize min-w-[120px] text-center">
                    {eventsMonthCursor.toLocaleDateString("it-IT", { month: "long", year: "numeric" })}
                  </p>
                  <button
                    type="button"
                    onClick={() => setEventsMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                    className="rounded border border-input p-1"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 border-b border-border bg-muted/30">
                {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((label) => (
                  <div key={label} className="px-1 py-1 text-center text-[10px] font-semibold text-muted-foreground">
                    {label}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {eventDays.map((date) => {
                  const key = dayKey(date);
                  const inMonth = date.getMonth() === eventMonth && date.getFullYear() === eventYear;
                  const items = eventsByDay.get(key) ?? [];
                  return (
                    <div
                      key={key}
                      className={cn(
                        "min-h-[72px] border-b border-r border-border p-1",
                        inMonth ? "bg-background" : "bg-muted/20 text-muted-foreground",
                      )}
                    >
                      <p className="text-[10px] font-medium">{date.getDate()}</p>
                      <div className="space-y-0.5">
                        {items.slice(0, 2).map((event) => (
                          <div
                            key={event.id}
                            className="flex items-center gap-1 truncate rounded bg-muted px-1 py-0.5 text-[10px] text-foreground"
                            title={`${event.title} — ${event.clientName ?? "Cliente"}`}
                          >
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: event.clientColor || "#7a8f5c" }} />
                            <span className="truncate">{event.title}</span>
                          </div>
                        ))}
                        {items.length > 2 && <p className="text-[10px] text-muted-foreground">+{items.length - 2}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-card border border-card-border rounded-xl p-4">
              <p className="font-semibold text-sm mb-2">Scadenze imminenti</p>
              <div className="space-y-2">
                {upcomingDeadlines.slice(0, 8).map((d, i) => {
                  const dt = new Date(d.when);
                  const isToday = dt.toDateString() === now.toDateString();
                  const isTomorrow = dt.toDateString() === new Date(now.getTime() + 86400000).toDateString();
                  return (
                    <button key={i} onClick={() => navigate(d.ref)} className="w-full text-left border border-border rounded-lg p-2 text-sm hover:bg-muted/40">
                      <p className={cn("text-xs font-semibold", isToday ? "text-red-600" : isTomorrow ? "text-amber-600" : "text-muted-foreground")}>{isToday ? "Oggi" : isTomorrow ? "Domani" : formatDate(d.when)}</p>
                      <p>{d.title}</p>
                    </button>
                  );
                })}
              </div>
              <button onClick={() => navigate("/tasks?new=1")} className="mt-2 text-xs text-primary hover:underline">+ Aggiungi scadenza</button>
            </div>

            <div className="bg-card border border-card-border rounded-xl p-4">
              <p className="font-semibold text-sm mb-2">Clienti che necessitano attenzione</p>
              {clientsAtRisk.length === 0 ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">Tutti i clienti sono in ottima salute ✓</div>
              ) : (
                <div className="space-y-2">
                  {clientsAtRisk.slice(0, 4).map((c: AnyObj) => (
                    <div key={c.id} className="border border-border rounded-lg p-2.5">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm">{c.name}</p>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", Number(c.healthScore) < 40 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700")}>{c.healthScore}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{c.contractStatus === "in_scadenza" ? "Contratto in scadenza" : "Nessun report / task scadute"}</p>
                      <button onClick={() => navigate(`/clients/${c.id}`)} className="text-xs text-primary hover:underline mt-1">Agisci</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-card border border-card-border rounded-xl p-4">
              <p className="font-semibold text-sm mb-2">Attività recente del team</p>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {activity.slice(0, 8).map((a: AnyObj, i: number) => <div key={a.id ?? i} className="text-xs border border-border rounded-lg p-2"><p><strong>{a.entityName ?? "Team"}</strong> {a.description ?? "ha aggiornato un elemento"}</p><p className="text-muted-foreground mt-0.5">{formatDate(a.createdAt)}</p></div>)}
              </div>
            </div>

            <div className="bg-card border border-card-border rounded-xl p-4">
              <p className="font-semibold text-sm mb-2">Chat team</p>
              <div className="py-3 px-3 rounded-lg border border-dashed border-card-border bg-muted/30">
                <p className="text-sm text-muted-foreground mb-1.5">Conversazioni e annunci interni del team.</p>
                <button
                  onClick={() => navigate("/chat")}
                  className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                >
                  Apri chat → <ArrowRight size={11} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Insights */}
        <div className="bg-card border border-card-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-sm">Andamento del mese</p>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="h-64">
              <p className="text-xs text-muted-foreground mb-1">Task create e completate (ultimi 6 mesi)</p>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="creati" fill="#c4d4a8" radius={[4, 4, 0, 0]} name="Create" />
                  <Bar dataKey="done" fill="#7a8f5c" radius={[4, 4, 0, 0]} name="Completate" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="h-64">
              <p className="text-xs text-muted-foreground mb-1">Distribuzione stato progetti</p>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={85}>
                      {pieData.map((_, i) => <Cell key={i} fill={["#6366f1", "#8b5cf6", "#0ea5e9", "#14b8a6", "#84cc16"][i % 5]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                  Nessun dato disponibile
                </div>
              )}
            </div>
            <div className="h-64">
              <p className="text-xs text-muted-foreground mb-1">Andamento task (create vs completate)</p>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={projectLine}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="avviati" name="Create" stroke="#8b5cf6" strokeWidth={2} />
                  <Line type="monotone" dataKey="completati" name="Completate" stroke="#14b8a6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 mt-3">
            <div className="border border-border rounded-lg p-2"><p className="text-xs text-muted-foreground">Task in sospeso</p><p className="font-semibold">{(summary as AnyObj)?.pendingTasks ?? 0}</p></div>
            <div className="border border-border rounded-lg p-2"><p className="text-xs text-muted-foreground">Task completate</p><p className="font-semibold">{tasks.filter((t: AnyObj) => t.status === "done").length}</p></div>
            <div className="border border-border rounded-lg p-2"><p className="text-xs text-muted-foreground">Nuovi clienti (mese)</p><p className="font-semibold">{newClientsMonth}</p></div>
            <div className="border border-border rounded-lg p-2"><p className="text-xs text-muted-foreground">Preventivi (template)</p><p className="font-semibold">{revenueData?.totalQuotes ?? "—"}</p></div>
            <div className="border border-border rounded-lg p-2"><p className="text-xs text-muted-foreground">Valore preventivi accettati</p><p className="font-semibold">{revenueData?.totalRevenue != null ? `€ ${Number(revenueData.totalRevenue).toLocaleString("it-IT")}` : "—"}</p></div>
            <div className="border border-border rounded-lg p-2"><p className="text-xs text-muted-foreground">Report inviati</p><p className="font-semibold">{reportsInviatiCount != null ? reportsInviatiCount : "—"}</p></div>
          </div>
        </div>
          </div>
        </details>

        {/* FAB rimosso: si apriva solo con l'hover (morto al tocco su PWA) e
            duplicava il menu "Nuovo" della topbar, con etichette divergenti.
            La creazione rapida è in topbar su ogni pagina (QuickCreate). */}

        {/* Dashboard Settings */}
        <button onClick={() => setShowDashPrefs(true)} className="fixed top-20 right-6 z-30 p-2 rounded-lg border border-input bg-background"><Settings size={16} /></button>
        {showDashPrefs && (
          <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
            <div className="bg-card border border-card-border rounded-xl w-full max-w-xl p-5">
              <h3 className="font-semibold mb-3">Preferenze Dashboard</h3>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {DEFAULT_WIDGETS.map((w) => (
                  <label key={w} className="flex items-center justify-between border border-border rounded-lg px-3 py-2 text-sm">
                    <span>{w.replaceAll("_", " ")}</span>
                    <input type="checkbox" checked={!hiddenWidgets.includes(w)} onChange={(e) => setHiddenWidgets((prev) => e.target.checked ? prev.filter((x) => x !== w) : [...prev, w])} />
                  </label>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => { setWidgets([...DEFAULT_WIDGETS]); setHiddenWidgets([]); }} className="px-3 py-2 text-sm border border-input rounded-lg">Reset default</button>
                <button onClick={() => setShowDashPrefs(false)} className="px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg">Salva</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
