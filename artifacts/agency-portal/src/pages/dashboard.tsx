import { useMemo, useState, useEffect } from "react";
import { Link } from "wouter";
import {
  useGetDashboardSummary,
  useGetRecentActivity,
  useGetProjectStatusBreakdown,
  useListTasks,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { cn, formatDate, TASK_STATUS_COLORS, TASK_STATUS_LABELS, PRIORITY_COLORS } from "@/lib/utils";
import {
  FolderKanban,
  Users,
  CheckSquare,
  UserCog,
  TrendingUp,
  Plus,
  AlertCircle,
  CalendarClock,
  BarChart3,
  ArrowRight,
  Clock,
  Receipt,
  FileSignature,
  DollarSign,
  Percent,
  Award,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buongiorno";
  if (h < 18) return "Buon pomeriggio";
  return "Buonasera";
}

function StatCard({
  label, value, icon: Icon, sub, color, href,
}: {
  label: string;
  value: number | string | undefined;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  sub?: string;
  color: string;
  href?: string;
}) {
  const inner = (
    <div className={cn(
      "bg-card border border-card-border rounded-xl p-5 shadow-sm transition-all",
      href && "hover:shadow-md hover:border-primary/30 cursor-pointer"
    )}>
      <div className="flex items-start justify-between mb-3">
        <div className={cn("p-2.5 rounded-xl", color)}>
          <Icon size={17} className="text-white" />
        </div>
        {href && <ArrowRight size={14} className="text-muted-foreground/50 mt-1" />}
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-3xl font-bold mt-0.5 tabular-nums">{value ?? "\u2014"}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

const ACTIVITY_COLORS: Record<string, string> = {
  project: "bg-indigo-100 text-indigo-600",
  task: "bg-emerald-100 text-emerald-600",
  message: "bg-sky-100 text-sky-600",
  file: "bg-amber-100 text-amber-600",
};

const ACTIVITY_ICONS: Record<string, string> = {
  project: "P",
  task: "T",
  message: "M",
  file: "F",
};

const STATUS_LABELS_IT: Record<string, string> = {
  planning: "Pianificazione",
  active: "Attivo",
  review: "In revisione",
  completed: "Completato",
  "on-hold": "In pausa",
};

const PIE_COLORS = ["#6366f1", "#83a143", "#f59e0b", "#9ca3af", "#ef4444"];

const QUICK_ACTIONS = [
  { label: "Nuovo Cliente", href: "/clients", icon: Users },
  { label: "Nuovo Progetto", href: "/projects", icon: FolderKanban },
  { label: "Nuovo Task", href: "/tasks", icon: CheckSquare },
];

interface TaskTrend { month: string; creati: number; completati: number; }
interface RevenueData { totalQuotes: number; approvedQuotes: number; activeContracts: number; totalContracts: number; totalRevenue: number; conversionRate: number; }
interface TeamStat { id: number; name: string; role: string; photoUrl: string | null; avatarColor: string | null; tasksCompleted: number; tasksInProgress: number; tasksTodo: number; totalTasks: number; activeProjects: number; }
type DashboardTask = { id: number; title: string; status: string; priority: string; dueDate?: string | null; projectName?: string | null };
type ActivityItem = { id?: number; type?: string; entityName?: string; description?: string; createdAt?: string };
type StatusBreakdownItem = { status?: string; count?: number };

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);
}

export default function Dashboard() {
  const { data: summary } = useGetDashboardSummary();
  const { data: activity } = useGetRecentActivity();
  const { data: statusBreakdown } = useGetProjectStatusBreakdown();
  const { data: allTasks } = useListTasks({});
  const [taskTrends, setTaskTrends] = useState<TaskTrend[]>([]);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [teamStats, setTeamStats] = useState<TeamStat[]>([]);

  const activityList = useMemo<ActivityItem[]>(() => {
    if (!activity) return [];
    if (Array.isArray(activity)) return activity;
    if (Array.isArray((activity as any).items)) return (activity as any).items;
    return [activity as ActivityItem].filter(Boolean);
  }, [activity]);

  useEffect(() => {
    fetch("/api/dashboard/task-trends").then(r => r.json()).then(setTaskTrends).catch(() => {});
    fetch("/api/dashboard/revenue").then(r => r.json()).then(setRevenue).catch(() => {});
    fetch("/api/dashboard/team-stats").then(r => r.json()).then(setTeamStats).catch(() => {});
    fetch("/api/deadlines/check", { method: "POST" }).catch(() => {});
  }, []);

  const today = useMemo(() => new Date(), []);
  const in7days = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  }, []);

  const normalizedStatusBreakdown = useMemo<StatusBreakdownItem[]>(() => {
    if (!statusBreakdown) return [];
    if (Array.isArray(statusBreakdown)) return statusBreakdown;
    if (Array.isArray((statusBreakdown as any).items)) return (statusBreakdown as any).items;
    return [statusBreakdown as StatusBreakdownItem].filter(Boolean);
  }, [statusBreakdown]);

  const normalizedTasks = useMemo<DashboardTask[]>(() => {
    if (!allTasks) return [];
    if (Array.isArray(allTasks)) return allTasks;
    if (Array.isArray((allTasks as any).items)) return (allTasks as any).items;
    return [allTasks as DashboardTask].filter(Boolean);
  }, [allTasks]);

  const { dueSoon, overdue } = useMemo(() => {
    if (!normalizedTasks.length) return { dueSoon: [], overdue: [] };
    const pending = normalizedTasks.filter((t: DashboardTask) => t.status !== "done" && t.dueDate);
    const overdue = pending.filter((t: DashboardTask) => new Date(t.dueDate!) < today);
    const dueSoon = pending.filter((t: DashboardTask) => {
      const d = new Date(t.dueDate!);
      return d >= today && d <= in7days;
    });
    return { dueSoon, overdue };
  }, [normalizedTasks, today, in7days]);

  const total = normalizedStatusBreakdown.reduce((acc: number, s: StatusBreakdownItem) => acc + (s?.count ?? 0), 0);
  const completionRate = summary
    ? summary.totalTasks > 0
      ? Math.round((summary.completedTasks / summary.totalTasks) * 100)
      : 0
    : null;

  const pieData = normalizedStatusBreakdown.map((item: StatusBreakdownItem) => {
    const status = item.status ?? "other";
    return {
      name: STATUS_LABELS_IT[status] ?? status ?? "Altro",
      value: item.count ?? 0,
    };
  });

  return (
    <Layout>
      <div className="p-8 max-w-7xl">

        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{getGreeting()}</p>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          </div>
          <div className="flex gap-2">
            {QUICK_ACTIONS.map(({ label, href, icon: Icon }) => (
              <Link key={href} href={href}>
                <div className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer">
                  <Plus size={13} />
                  {label}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {overdue.length > 0 && (
          <div className="mb-6 flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertCircle size={16} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-700">
              <span className="font-semibold">{overdue.length} task scadut{overdue.length === 1 ? "o" : "i"}</span> — richiedono attenzione immediata.
            </p>
            <Link href="/tasks">
              <span className="ml-auto text-xs text-red-600 font-medium hover:underline cursor-pointer">Vedi tutti</span>
            </Link>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Clienti" value={summary?.totalClients} icon={Users} color="bg-indigo-500" href="/clients" />
          <StatCard label="Progetti Attivi" value={summary?.activeProjects} icon={TrendingUp} color="bg-primary" sub={summary ? `su ${summary.totalProjects} totali` : undefined} href="/projects" />
          <StatCard label="Task Aperti" value={summary ? summary.totalTasks - summary.completedTasks : undefined} icon={CheckSquare} color="bg-amber-500" sub={completionRate != null ? `${completionRate}% completati` : undefined} href="/tasks" />
          <StatCard label="Team" value={summary?.teamMembers} icon={UserCog} color="bg-violet-500" href="/team" />
        </div>

        {revenue && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Fatturato Prev." value={formatCurrency(revenue.totalRevenue)} icon={DollarSign} color="bg-emerald-500" sub="Da preventivi approvati" href="/quotes" />
            <StatCard label="Preventivi" value={revenue.totalQuotes} icon={Receipt} color="bg-cyan-500" sub={`${revenue.approvedQuotes} approvati`} href="/quotes" />
            <StatCard label="Contratti Attivi" value={revenue.activeContracts} icon={FileSignature} color="bg-rose-500" sub={`su ${revenue.totalContracts} totali`} href="/contracts" />
            <StatCard label="Tasso Conv." value={`${revenue.conversionRate}%`} icon={Percent} color="bg-fuchsia-500" sub="Preventivi approvati" />
          </div>
        )}

        {summary && summary.totalTasks > 0 && (
          <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <BarChart3 size={15} className="text-primary" />
                Avanzamento Task
              </p>
              <span className="text-sm font-bold text-primary">{completionRate}%</span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-700"
                style={{ width: `${completionRate}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>{summary.completedTasks} completati</span>
              <span>{summary.totalTasks - summary.completedTasks} aperti</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {taskTrends.length > 0 && (
            <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
              <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <BarChart3 size={15} className="text-primary" />
                Andamento Task (ultimi 6 mesi)
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={taskTrends} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="creati" fill="hsl(83, 28%, 42%)" radius={[4, 4, 0, 0]} name="Creati" />
                  <Bar dataKey="completati" fill="#6366f1" radius={[4, 4, 0, 0]} name="Completati" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {pieData.length > 0 && (
            <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
              <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <FolderKanban size={15} className="text-primary" />
                Distribuzione Progetti
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {pieData.map((_: unknown, i: number) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {teamStats.length > 0 && (
          <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm mb-6">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Award size={15} className="text-primary" />
              Statistiche Team
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {teamStats.filter(m => m.totalTasks > 0).sort((a, b) => b.tasksCompleted - a.tasksCompleted).map((m) => (
                <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden"
                    style={{ backgroundColor: m.avatarColor ?? "#6366f1" }}
                  >
                    {m.photoUrl
                      ? <img src={m.photoUrl} alt="" className="w-full h-full object-cover" />
                      : m.name.charAt(0).toUpperCase()
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.name}</p>
                    <p className="text-[10px] text-muted-foreground">{m.role}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">{m.tasksCompleted} completati</span>
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{m.tasksInProgress} in corso</span>
                      <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{m.activeProjects} progetti</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
              <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <CalendarClock size={15} className="text-primary" />
                Scadenze questa settimana
                {dueSoon.length > 0 && (
                  <span className="ml-auto text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">
                    {dueSoon.length}
                  </span>
                )}
              </h2>
              {dueSoon.length === 0 && overdue.length === 0 ? (
                <div className="text-center py-6">
                  <Clock size={28} className="text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nessuna scadenza nei prossimi 7 giorni</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {[...overdue.slice(0, 3), ...dueSoon.slice(0, 5)].map((t) => {
                    const isOver = overdue.includes(t);
                    return (
                      <div key={t.id} className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border",
                        isOver ? "bg-red-50 border-red-200" : "bg-background border-border"
                      )}>
                        <div className={cn("w-2 h-2 rounded-full shrink-0", isOver ? "bg-red-400" : "bg-amber-400")} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{t.title}</p>
                          {t.projectName && <p className="text-xs text-muted-foreground">{t.projectName}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn("text-xs px-1.5 py-0.5 rounded-full", PRIORITY_COLORS[t.priority])}>{t.priority}</span>
                          <span className={cn("text-xs font-medium", isOver ? "text-red-600" : "text-amber-600")}>
                            {isOver ? "Scaduto" : formatDate(t.dueDate)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <Link href="/tasks">
                    <p className="text-xs text-primary hover:underline text-center mt-2 cursor-pointer">Vedi tutti i task</p>
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm h-fit">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <TrendingUp size={15} className="text-primary" />
              Attivit&agrave; Recente
            </h2>
            {activityList.length > 0 ? (
              <div className="space-y-3">
                {activityList.slice(0, 10).map((itemRaw: ActivityItem, index: number) => {
                  const item = itemRaw ?? {};
                  const type = typeof item.type === "string" && item.type.length > 0 ? item.type : "other";
                  const fallbackInitial = typeof type === "string" && type.length > 0 ? type.charAt(0).toUpperCase() : "?";

                  return (
                    <div key={item.id ?? index} className="flex items-start gap-3">
                      <div
                        className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold",
                          ACTIVITY_COLORS[type] ?? "bg-gray-100 text-gray-600",
                        )}
                      >
                        {ACTIVITY_ICONS[type] ?? fallbackInitial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{item.entityName ?? "Attività"}</p>
                        {item.description && (
                          <p className="text-[11px] text-muted-foreground leading-tight">
                            {item.description}
                          </p>
                        )}
                        {item.createdAt && (
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                            {formatDate(item.createdAt)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6">
                <TrendingUp size={28} className="text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nessuna attivit&agrave; recente</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
