import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useGetDashboardSummary,
  useGetRecentActivity,
  useGetProjectStatusBreakdown,
  useListProjects,
  useListTasks,
  useListClients,
  portalFetch,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { cn, formatDate, PRIORITY_COLORS } from "@/lib/utils";
import {
  Search,
  Bell,
  Plus,
  ChevronDown,
  FolderKanban,
  CheckSquare,
  Users,
  Timer,
  AlertTriangle,
  CalendarDays,
  MessageCircle,
  Settings,
  LogOut,
  GripVertical,
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

function greeting(name: string) {
  const h = new Date().getHours();
  if (h < 12) return `Buongiorno, ${name} ☀️`;
  if (h <= 17) return `Buon pomeriggio, ${name} 👋`;
  return `Buonasera, ${name} 🌙`;
}

function italianDate() {
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
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
      {trend && <p className="text-[11px] text-primary mt-1">{trend}</p>}
      {progress != null && (
        <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      )}
    </button>
  );
}

const DEFAULT_WIDGETS = [
  "progetti_corso",
  "task_oggi",
  "editoriale",
  "adv",
  "scadenze",
  "clienti_attention",
  "attivita_team",
  "messaggi_non_letti",
] as const;

type WidgetKey = (typeof DEFAULT_WIDGETS)[number];

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { data: summary } = useGetDashboardSummary();
  const { data: activityRaw } = useGetRecentActivity();
  const { data: statusRaw } = useGetProjectStatusBreakdown();
  const { data: projectsRaw } = useListProjects({});
  const { data: tasksRaw } = useListTasks({});
  const { data: clientsRaw } = useListClients();

  const [showQuick, setShowQuick] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [search, setSearch] = useState("");
  const [showAlertsAll, setShowAlertsAll] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [insightTab, setInsightTab] = useState<"mese" | "scorso" | "3mesi">("mese");
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
  const weekEnd = new Date(); weekEnd.setDate(now.getDate() + 7);
  const in14 = new Date(); in14.setDate(now.getDate() + 14);

  const tasksDueToday = tasks.filter((t: AnyObj) => t.dueDate && new Date(t.dueDate).toDateString() === now.toDateString());
  const tasksOverdue = tasks.filter((t: AnyObj) => t.status !== "done" && t.dueDate && new Date(t.dueDate) < now);
  const tasksDueWeek = tasks.filter((t: AnyObj) => t.dueDate && new Date(t.dueDate) >= now && new Date(t.dueDate) <= weekEnd);
  const tasksTodayTotal = tasksDueToday.length + tasksOverdue.length;
  const tasksTodayDone = [...tasksDueToday, ...tasksOverdue].filter((t: AnyObj) => t.status === "done").length;

  const activeProjects = projects.filter((p: AnyObj) => p.status === "active");
  const dueWeekProjects = activeProjects.filter((p: AnyObj) => p.deadline && new Date(p.deadline) <= weekEnd);
  const completedThisMonth = projects.filter((p: AnyObj) => p.status === "completed" && new Date(p.updatedAt ?? p.createdAt).getMonth() === now.getMonth());
  const valueInCourse = activeProjects.reduce((acc: number, p: AnyObj) => acc + Number(p.budget ?? 0), 0);
  const clientsAtRisk = clients.filter((c: AnyObj) => Number(c.healthScore ?? 0) < 60);

  const upcomingDeadlines = [
    ...tasks.filter((t: AnyObj) => t.dueDate && new Date(t.dueDate) <= in14).map((t: AnyObj) => ({ type: "task", title: t.title, when: t.dueDate, priority: t.priority, ref: `/tasks` })),
    ...projects.filter((p: AnyObj) => p.deadline && new Date(p.deadline) <= in14).map((p: AnyObj) => ({ type: "deadline", title: p.name, when: p.deadline, priority: "high", ref: `/projects/${p.id}` })),
  ].sort((a, b) => new Date(a.when).getTime() - new Date(b.when).getTime()).slice(0, 8);

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
    list.push({ id: "msg-info", level: "info", text: "Nuovo messaggio da un membro del team", href: "/chat" });
    return list.filter((a) => !dismissed.includes(a.id));
  }, [projects, clients, tasksOverdue.length, dismissed]);

  const shownAlerts = showAlertsAll ? alerts : alerts.slice(0, 5);
  const pieData = statusBreakdown.map((s: AnyObj) => ({ name: s.status, value: s.count }));
  const trendData = [
    { week: "Set 1", done: 28, byType: 20 },
    { week: "Set 2", done: 34, byType: 24 },
    { week: "Set 3", done: 31, byType: 22 },
    { week: "Set 4", done: 39, byType: 26 },
  ];
  const hoursDonut = clients.slice(0, 5).map((c: AnyObj, i) => ({ name: c.name, value: 10 + i * 7 }));
  const projectLine = [
    { period: "Gen", avviati: 4, completati: 2 },
    { period: "Feb", avviati: 5, completati: 3 },
    { period: "Mar", avviati: 6, completati: 4 },
    { period: "Apr", avviati: 5, completati: 5 },
  ];
  const editorialWeek = [
    { day: "Lun", post: 1, reel: 1, story: 1, carousel: 0 },
    { day: "Mar", post: 0, reel: 1, story: 1, carousel: 1 },
    { day: "Mer", post: 1, reel: 0, story: 1, carousel: 0 },
    { day: "Gio", post: 0, reel: 1, story: 0, carousel: 1 },
    { day: "Ven", post: 1, reel: 1, story: 1, carousel: 0 },
    { day: "Sab", post: 0, reel: 0, story: 1, carousel: 0 },
    { day: "Dom", post: 0, reel: 0, story: 0, carousel: 1 },
  ];
  const unreadMessages = [
    { id: 1, channel: "Progetto TechNova", preview: "Ho aggiornato il piano media, puoi verificare?", time: "10:12", unread: 3 },
    { id: 2, channel: "DM - Marco", preview: "Ci sentiamo alle 15 per il brief cliente?", time: "09:45", unread: 1 },
  ];
  const advCampaigns = [
    { id: 1, client: "TechNova", name: "Launch X1", platform: "Meta", spesa: 420, kpi: "ROAS 2.8", status: "attiva" },
    { id: 2, client: "Fiore Moda", name: "Spring Sale", platform: "Google", spesa: 280, kpi: "CPC €0,78", status: "attiva" },
  ];

  const visibleWidget = (k: WidgetKey) => !hiddenWidgets.includes(k);
  const moveWidget = (idx: number, delta: number) => {
    const to = idx + delta;
    if (to < 0 || to >= widgets.length) return;
    const next = [...widgets];
    const [x] = next.splice(idx, 1);
    next.splice(to, 0, x);
    setWidgets(next);
  };

  const onToggleTaskDone = (task: AnyObj) => {
    portalFetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: task.status === "done" ? "todo" : "done" }),
    }).catch(() => {});
  };

  const filteredGlobal = [
    ...projects.filter((p: AnyObj) => p.name?.toLowerCase?.().includes(search.toLowerCase())).map((x: AnyObj) => ({ label: x.name, href: `/projects/${x.id}`, type: "progetto" })),
    ...clients.filter((c: AnyObj) => c.name?.toLowerCase?.().includes(search.toLowerCase())).map((x: AnyObj) => ({ label: x.name, href: `/clients/${x.id}`, type: "cliente" })),
    ...tasks.filter((t: AnyObj) => t.title?.toLowerCase?.().includes(search.toLowerCase())).map((x: AnyObj) => ({ label: x.title, href: `/tasks`, type: "task" })),
  ].slice(0, 6);

  const taskListByTab = tasksTab === "oggi" ? [...tasksOverdue, ...tasksDueToday] : tasksTab === "settimana" ? tasksDueWeek : tasksOverdue;
  const riskProjects = projects.filter((p: AnyObj) => p.healthStatus === "at-risk" || p.healthStatus === "delayed").slice(0, 5);

  return (
    <Layout>
      <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
        {/* Top Header Bar */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{greeting("Team")}</h1>
            <p className="text-sm text-muted-foreground capitalize">{italianDate()}</p>
          </div>
          <div className="flex items-center gap-2 relative">
            <div className="relative w-72 max-w-[45vw]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border border-input rounded-lg bg-background" placeholder="Cerca progetti, clienti, task..." />
              {search.trim() && (
                <div className="absolute z-20 mt-1 w-full bg-card border border-card-border rounded-lg shadow-lg p-1">
                  {filteredGlobal.length === 0 ? <p className="px-2 py-2 text-xs text-muted-foreground">Nessun risultato</p> : filteredGlobal.map((r, i) => (
                    <button key={i} onClick={() => { setSearch(""); navigate(r.href); }} className="w-full text-left px-2 py-1.5 rounded hover:bg-muted text-sm">
                      <span className="font-medium">{r.label}</span> <span className="text-xs text-muted-foreground">({r.type})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="relative p-2 rounded-lg border border-input bg-background"><Bell size={16} />{alerts.length > 0 && <span className="absolute -top-1 -right-1 text-[10px] w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center">{Math.min(alerts.length, 9)}</span>}</button>
            <div className="relative">
              <button onClick={() => setShowQuick((s) => !s)} className="px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg inline-flex items-center gap-1"><Plus size={14} /> Nuovo <ChevronDown size={14} /></button>
              {showQuick && (
                <div className="absolute right-0 mt-1 w-48 bg-card border border-card-border rounded-lg shadow-lg p-1 z-20">
                  {[["Nuovo progetto", "/projects"], ["Nuova task", "/tasks"], ["Nuovo cliente", "/clients"], ["Nuovo preventivo", "/quotes"], ["Nuovo messaggio", "/chat"]].map(([l, h]) => (
                    <button key={l} onClick={() => { setShowQuick(false); navigate(h); }} className="w-full text-left px-2 py-1.5 rounded hover:bg-muted text-sm">{l}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <button onClick={() => setShowProfile((s) => !s)} className="w-9 h-9 rounded-full bg-primary/10 text-primary font-semibold">U</button>
              {showProfile && (
                <div className="absolute right-0 mt-1 w-44 bg-card border border-card-border rounded-lg shadow-lg p-1 z-20">
                  <button className="w-full text-left px-2 py-1.5 rounded hover:bg-muted text-sm">Profile</button>
                  <button onClick={() => navigate("/settings")} className="w-full text-left px-2 py-1.5 rounded hover:bg-muted text-sm inline-flex items-center gap-1"><Settings size={13} /> Settings</button>
                  <button className="w-full text-left px-2 py-1.5 rounded hover:bg-muted text-sm inline-flex items-center gap-1"><LogOut size={13} /> Logout</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <KpiCard title="Progetti Attivi" value={activeProjects.length} sub={`${dueWeekProjects.length} in scadenza questa settimana`} trend="+2 vs mese scorso" color={KPI_COLORS[0]} onClick={() => navigate("/projects")} />
          <KpiCard title="Task di Oggi" value={tasksTodayTotal} sub={`${tasksTodayDone} completate oggi`} progress={tasksTodayTotal ? (tasksTodayDone / tasksTodayTotal) * 100 : 0} color={KPI_COLORS[1]} onClick={() => navigate("/tasks")} />
          <KpiCard title="Clienti Attivi" value={clients.length} sub={`${clients.filter((c: AnyObj) => c.contractStatus === "in_scadenza").length} contratti in scadenza (30gg)`} trend={`${clientsAtRisk.length} clienti a rischio`} color={KPI_COLORS[2]} onClick={() => navigate("/clients")} />
          <KpiCard title="Ore Questa Settimana" value={Math.max(12, (summary as AnyObj)?.pendingTasks ?? 0)} sub="8 ore fatturabili" color={KPI_COLORS[3]} onClick={() => navigate("/tools/time-tracker")} />
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="bg-card border border-card-border rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold">Alert & Urgenze</p>
              <div className="flex items-center gap-3">
                <button onClick={() => setDismissed(alerts.map((a) => a.id))} className="text-xs text-muted-foreground hover:underline">Dismiss all</button>
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
            {widgets.map((wk, idx) => visibleWidget(wk) && (
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

                {wk === "task_oggi" && (
                  <div>
                    <div className="flex gap-1 mb-2">{(["oggi", "settimana", "scadute"] as const).map((t) => <button key={t} onClick={() => setTasksTab(t)} className={cn("px-2 py-1 text-xs rounded", tasksTab === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{t === "oggi" ? "Oggi" : t === "settimana" ? "Questa settimana" : "Scadute"}</button>)}</div>
                    <div className="space-y-1.5 max-h-72 overflow-y-auto">
                      {taskListByTab.slice(0, 8).map((t: AnyObj) => (
                        <label key={t.id} className="flex items-center gap-2 text-sm border border-border rounded-lg px-2 py-1.5">
                          <input type="checkbox" checked={t.status === "done"} onChange={() => onToggleTaskDone(t)} />
                          <span className={cn("flex-1", t.status === "done" && "line-through text-muted-foreground")}>{t.title}</span>
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", PRIORITY_COLORS[t.priority] ?? "bg-muted")}>{t.priority}</span>
                        </label>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center justify-between"><button onClick={() => navigate("/tasks")} className="text-xs text-primary hover:underline">Vedi tutte</button><button onClick={() => navigate("/tasks")} className="text-xs px-2 py-1 border border-input rounded">+ Nuova task</button></div>
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
                            {d.reel > 0 && <span className="w-2 h-2 rounded-full bg-pink-500" title="reel" />}
                            {d.story > 0 && <span className="w-2 h-2 rounded-full bg-teal-500" title="story" />}
                            {d.carousel > 0 && <span className="w-2 h-2 rounded-full bg-blue-500" title="carousel" />}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">14 contenuti programmati questa settimana · <span className="text-amber-600">3 da approvare</span></p>
                  </div>
                )}

                {wk === "adv" && (
                  <div className="space-y-2">
                    {advCampaigns.slice(0, 3).map((c) => <div key={c.id} className="border border-border rounded-lg p-2.5 text-sm"><p className="font-medium">{c.client} · {c.name}</p><p className="text-xs text-muted-foreground">{c.platform} · Spesa oggi €{c.spesa} · {c.kpi} · {c.status}</p></div>)}
                    <button onClick={() => navigate("/reports")} className="text-xs text-primary hover:underline">Vedi tutte le campagne</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="xl:col-span-2 space-y-4">
            <div className="bg-card border border-card-border rounded-xl p-4">
              <p className="font-semibold text-sm mb-2">Scadenze imminenti</p>
              <div className="space-y-2">
                {upcomingDeadlines.slice(0, 8).map((d, i) => {
                  const dt = new Date(d.when);
                  const isToday = dt.toDateString() === now.toDateString();
                  const isTomorrow = dt.toDateString() === new Date(now.getTime() + 86400000).toDateString();
                  return (
                    <button key={i} onClick={() => navigate(d.ref)} className="w-full text-left border border-border rounded-lg p-2 text-sm hover:bg-muted/40">
                      <p className={cn("text-[11px] font-semibold", isToday ? "text-red-600" : isTomorrow ? "text-amber-600" : "text-muted-foreground")}>{isToday ? "Oggi" : isTomorrow ? "Domani" : formatDate(d.when)}</p>
                      <p>{d.title}</p>
                    </button>
                  );
                })}
              </div>
              <button className="mt-2 text-xs text-primary hover:underline">+ Aggiungi scadenza</button>
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
              <p className="font-semibold text-sm mb-2">Messaggi non letti</p>
              <div className="space-y-2">
                {unreadMessages.map((m) => (
                  <button key={m.id} onClick={() => navigate("/chat")} className="w-full text-left border border-border rounded-lg p-2 hover:bg-muted/40">
                    <div className="flex items-center justify-between"><p className="text-sm font-medium">{m.channel}</p><span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">{m.unread}</span></div>
                    <p className="text-xs text-muted-foreground truncate">{m.preview}</p>
                    <p className="text-[10px] text-muted-foreground">{m.time}</p>
                  </button>
                ))}
              </div>
              <button onClick={() => navigate("/chat")} className="mt-2 text-xs text-primary hover:underline">Vai alla chat</button>
            </div>
          </div>
        </div>

        {/* Insights */}
        <div className="bg-card border border-card-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-sm">Monthly Performance Overview</p>
            <div className="flex gap-1">{(["mese", "scorso", "3mesi"] as const).map((t) => <button key={t} onClick={() => setInsightTab(t)} className={cn("px-2 py-1 text-xs rounded", insightTab === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{t === "mese" ? "Questo mese" : t === "scorso" ? "Mese scorso" : "Ultimi 3 mesi"}</button>)}</div>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="h-64">
              <p className="text-xs text-muted-foreground mb-1">Task completate per settimana</p>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="done" fill="#7a8f5c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="h-64">
              <p className="text-xs text-muted-foreground mb-1">Distribuzione ore per cliente</p>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={hoursDonut} dataKey="value" nameKey="name" outerRadius={85}>
                    {hoursDonut.map((_, i) => <Cell key={i} fill={["#6366f1", "#8b5cf6", "#0ea5e9", "#14b8a6", "#84cc16"][i % 5]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="h-64">
              <p className="text-xs text-muted-foreground mb-1">Andamento progetti</p>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={projectLine}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="avviati" stroke="#8b5cf6" strokeWidth={2} />
                  <Line type="monotone" dataKey="completati" stroke="#14b8a6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 mt-3">
            <div className="border border-border rounded-lg p-2"><p className="text-[11px] text-muted-foreground">Ore totali</p><p className="font-semibold">126</p></div>
            <div className="border border-border rounded-lg p-2"><p className="text-[11px] text-muted-foreground">Task completate</p><p className="font-semibold">{tasks.filter((t: AnyObj) => t.status === "done").length}</p></div>
            <div className="border border-border rounded-lg p-2"><p className="text-[11px] text-muted-foreground">Nuovi clienti</p><p className="font-semibold">3</p></div>
            <div className="border border-border rounded-lg p-2"><p className="text-[11px] text-muted-foreground">Preventivi inviati</p><p className="font-semibold">11</p></div>
            <div className="border border-border rounded-lg p-2"><p className="text-[11px] text-muted-foreground">Valore contratti</p><p className="font-semibold">€ 18.500</p></div>
            <div className="border border-border rounded-lg p-2"><p className="text-[11px] text-muted-foreground">Report inviati</p><p className="font-semibold">9</p></div>
          </div>
        </div>

        {/* FAB */}
        <div className="fixed right-5 bottom-5 z-40">
          <div className="group relative">
            <button className="w-14 h-14 rounded-full bg-violet-600 text-white shadow-xl inline-flex items-center justify-center"><Plus size={24} /></button>
            <div className="absolute bottom-16 right-0 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity bg-card border border-card-border rounded-lg shadow-lg p-2 space-y-1 min-w-44">
              {[["+ Progetto", "/projects"], ["+ Task", "/tasks"], ["+ Cliente", "/clients"], ["+ Timer", "/tools/time-tracker"], ["AI Chat", "/chat"]].map(([l, h]) => <button key={l} onClick={() => navigate(h)} className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted">{l}</button>)}
            </div>
          </div>
        </div>

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
