import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { ChevronLeft, CalendarDays, BarChart2, Download, Share2, Copy, Archive, Plus } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

interface Props { id: string; }

const TABS = ["panoramica", "task", "piano-editoriale", "adv-campagne", "file", "comunicazioni", "timeline", "report", "storico"] as const;

function HealthBadge({ health }: { health: string }) {
  const map: Record<string, string> = {
    "on-track": "bg-emerald-100 text-emerald-700",
    "at-risk": "bg-amber-100 text-amber-700",
    delayed: "bg-red-100 text-red-700",
    completed: "bg-teal-100 text-teal-700",
    paused: "bg-gray-100 text-gray-600",
  };
  return <span className={cn("text-xs px-2 py-1 rounded-full font-medium", map[health] ?? map["on-track"])}>{health}</span>;
}

export default function ProjectDetail({ id }: Props) {
  const projectId = Number(id);
  const [tab, setTab] = useState<(typeof TABS)[number]>("panoramica");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/workspace`);
        const json = await res.json();
        setData(json);
        setNotes(json?.project?.notes ?? "");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId]);

  const project = data?.project;
  const tasks = Array.isArray(data?.tasks) ? data.tasks : [];
  const activity = Array.isArray(data?.activity) ? data.activity : [];
  const members = Array.isArray(data?.members) ? data.members : [];
  const milestones = Array.isArray(data?.milestones) ? data.milestones : [];
  const expenses = Array.isArray(data?.expenses) ? data.expenses : [];
  const types = useMemo(() => {
    try { return JSON.parse(project?.typeJson ?? "[]") as string[]; } catch { return []; }
  }, [project?.typeJson]);

  if (loading) return <Layout><div className="p-8 text-muted-foreground">Caricamento...</div></Layout>;
  if (!project) return <Layout><div className="p-8 text-muted-foreground">Progetto non trovato</div></Layout>;

  const budget = Number(data?.stats?.budget ?? project.budget ?? 0);
  const spent = Number(data?.stats?.spent ?? project.budgetSpeso ?? 0);
  const budgetPct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
  const overdueTasks = tasks.filter((t: any) => t.status !== "done" && t.dueDate && new Date(t.dueDate) < new Date());

  return (
    <Layout>
      <div className="p-8 space-y-5">
        <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft size={16} /> Progetti</Link>

        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">{project.name}</h1>
              <p className="text-sm text-muted-foreground">{data?.client?.name ?? project.clientName ?? "Cliente"}</p>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {types.map((t) => <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{t}</span>)}
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{project.status}</span>
                <HealthBadge health={project.healthStatus ?? "on-track"} />
              </div>
            </div>
            <div className="text-right text-sm">
              <p className="inline-flex items-center gap-1 text-muted-foreground"><CalendarDays size={14} /> {project.deadline ? formatDate(project.deadline) : "—"}</p>
              <p className="mt-1 font-semibold">€ {spent.toLocaleString("it-IT")} / € {budget.toLocaleString("it-IT")} ({budgetPct}%)</p>
            </div>
          </div>
          <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden"><div className={cn("h-full", budgetPct > 95 ? "bg-red-500" : budgetPct >= 80 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${Math.min(100, budgetPct)}%` }} /></div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="px-3 py-1.5 text-xs border border-input rounded-lg">Edit</button>
            <button onClick={() => fetch(`/api/projects/${project.id}/archive`, { method: "POST" })} className="px-3 py-1.5 text-xs border border-input rounded-lg inline-flex items-center gap-1"><Archive size={12} /> Archive</button>
            <button onClick={() => fetch(`/api/projects/${project.id}/duplicate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ copyTasks: true }) })} className="px-3 py-1.5 text-xs border border-input rounded-lg inline-flex items-center gap-1"><Copy size={12} /> Duplicate</button>
            <button className="px-3 py-1.5 text-xs border border-input rounded-lg inline-flex items-center gap-1"><Download size={12} /> Export</button>
            <button className="px-3 py-1.5 text-xs border border-input rounded-lg inline-flex items-center gap-1"><Share2 size={12} /> Share brief</button>
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-3 flex gap-1 overflow-x-auto">
          {TABS.map((t) => <button key={t} onClick={() => setTab(t)} className={cn("px-3 py-1.5 text-xs rounded-lg whitespace-nowrap", tab === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{t}</button>)}
        </div>

        {tab === "panoramica" && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 space-y-4">
              <div className="bg-card border border-card-border rounded-xl p-4">
                <h3 className="font-semibold mb-2">Descrizione</h3>
                <p className="text-sm text-muted-foreground">{project.description ?? "Nessuna descrizione"}</p>
                <div className="grid grid-cols-3 gap-3 mt-4 text-sm">
                  <div><p className="text-xs text-muted-foreground">Start</p><p>{project.startDate ? formatDate(project.startDate) : "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">End</p><p>{project.endDate ? formatDate(project.endDate) : "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Last update</p><p>{formatDate(project.updatedAt)}</p></div>
                </div>
              </div>
              <div className="bg-card border border-card-border rounded-xl p-4">
                <h3 className="font-semibold mb-2">Budget breakdown</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>Budget totale: <strong>€ {budget.toLocaleString("it-IT")}</strong></div>
                  <div>Ore stimate/lavorate: <strong>{project.oreStimate ?? 0}/{project.oreLavorate ?? 0}</strong></div>
                  <div>Costo reale: <strong>€ {spent.toLocaleString("it-IT")}</strong></div>
                  <div>Remaining budget: <strong>€ {Math.max(0, budget - spent).toLocaleString("it-IT")}</strong></div>
                </div>
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground mb-1">Budget burndown</p>
                  <div className="h-24 rounded-lg bg-muted/50 border border-border flex items-end gap-1 px-2 pb-2">
                    {[25, 45, 53, 60, 78, 88, budgetPct].map((v, i) => <div key={i} className="flex-1 bg-primary/70 rounded-sm" style={{ height: `${Math.max(8, Math.min(100, v))}%` }} />)}
                  </div>
                </div>
              </div>
              <div className="bg-card border border-card-border rounded-xl p-4">
                <h3 className="font-semibold mb-2">Team members</h3>
                <div className="flex flex-wrap gap-2">{members.map((m: any) => <span key={m.id} className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">{m.role} · {m.userId}</span>)}</div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-card border border-card-border rounded-xl p-4">
                <h3 className="font-semibold mb-2">Activity feed</h3>
                <div className="space-y-2">{activity.slice(0, 10).map((a: any) => <div key={a.id} className="text-xs bg-muted/40 rounded px-2 py-1.5"><strong>{a.action}</strong> · {formatDate(a.createdAt)}</div>)}</div>
              </div>
              <div className="bg-card border border-card-border rounded-xl p-4">
                <h3 className="font-semibold mb-2">Upcoming deadlines</h3>
                <div className="space-y-1">{tasks.filter((t: any) => t.dueDate).slice(0, 7).map((t: any) => <p key={t.id} className="text-xs">{t.title} · <span className={cn(t.status !== "done" && new Date(t.dueDate) < new Date() ? "text-red-600" : "text-muted-foreground")}>{formatDate(t.dueDate)}</span></p>)}</div>
              </div>
              <div className="bg-card border border-card-border rounded-xl p-4">
                <h3 className="font-semibold mb-2">Quick notes</h3>
                <textarea rows={4} className="w-full px-2.5 py-2 border border-input rounded-lg bg-background text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} />
                <button onClick={() => fetch(`/api/projects/${project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes, lastActivityAt: new Date().toISOString() }) })} className="mt-2 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded">Salva note</button>
              </div>
            </div>
          </div>
        )}

        {tab === "task" && (
          <div className="bg-card border border-card-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3"><h3 className="font-semibold">Task progetto</h3><button onClick={() => (window.location.href = "/tasks")} className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded inline-flex items-center gap-1"><Plus size={12} /> Nuova Task</button></div>
            <p className="text-sm text-muted-foreground mb-2">{data?.stats?.tasksDone ?? 0} task completate su {data?.stats?.tasksTotal ?? 0} totali</p>
            <div className="space-y-2">{tasks.map((t: any) => <div key={t.id} className="border border-border rounded-lg px-3 py-2 text-sm flex items-center justify-between"><span>{t.title}</span><span className="text-xs text-muted-foreground">{t.status}</span></div>)}</div>
          </div>
        )}

        {tab === "piano-editoriale" && (
          <div className="bg-card border border-card-border rounded-xl p-4">
            {types.includes("Social Media") ? <div><h3 className="font-semibold mb-2">Piano editoriale</h3><p className="text-sm text-muted-foreground">Contenuti: Da creare / In lavorazione / Pronto / Approvato / Pubblicato</p><a href="/tools" className="text-primary text-sm hover:underline mt-2 inline-block">Apri tool piano editoriale</a></div> : <p className="text-sm text-muted-foreground">Tab visibile solo per progetti Social Media.</p>}
          </div>
        )}

        {tab === "adv-campagne" && (
          <div className="bg-card border border-card-border rounded-xl p-4">
            {(types.includes("ADV Meta") || types.includes("ADV Google")) ? <div className="grid grid-cols-2 gap-3 text-sm"><div className="border rounded-lg p-3">Meta: spesa / reach / ROAS / status</div><div className="border rounded-lg p-3">Google: spesa / click / conversioni / status</div></div> : <p className="text-sm text-muted-foreground">Tab visibile solo per progetti ADV.</p>}
          </div>
        )}

        {tab === "file" && <div className="bg-card border border-card-border rounded-xl p-4 text-sm text-muted-foreground">Cartelle: Brief e strategia, Contenuti, Approvazioni, Report, Contratti/Preventivi, Altro.</div>}
        {tab === "comunicazioni" && <div className="bg-card border border-card-border rounded-xl p-4 text-sm text-muted-foreground">Canale messaggi progetto + meeting notes + client log.</div>}
        {tab === "timeline" && <div className="bg-card border border-card-border rounded-xl p-4"><h3 className="font-semibold mb-3">Timeline / Gantt</h3><div className="h-40 border rounded-lg bg-muted/30 relative"><div className="absolute left-2 right-2 top-8 h-2 bg-primary/40 rounded" /><div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-red-500" /><p className="absolute left-2 top-2 text-xs text-muted-foreground">Today line</p></div><div className="mt-3 text-sm">{milestones.map((m: any) => <div key={m.id} className="py-1">{m.name} · {m.status} · {m.dueDate ? formatDate(m.dueDate) : "—"}</div>)}</div></div>}
        {tab === "report" && <div className="bg-card border border-card-border rounded-xl p-4 text-sm text-muted-foreground">Report progetto: Bozza / Approvato / Inviato.</div>}
        {tab === "storico" && <div className="bg-card border border-card-border rounded-xl p-4"><h3 className="font-semibold mb-2">Audit log</h3>{activity.map((a: any) => <div key={a.id} className="text-xs py-1 border-b border-border/50">{a.action} · {formatDate(a.createdAt)}</div>)}</div>}

        <div className="bg-card border border-card-border rounded-xl p-4">
          <h3 className="font-semibold mb-2 inline-flex items-center gap-2"><BarChart2 size={15} /> Milestones & Budget alerts</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="border rounded-lg p-3 text-sm">Milestones: {milestones.length} (notifica prevista a -3 giorni)</div>
            <div className={cn("border rounded-lg p-3 text-sm", budgetPct >= 95 ? "border-red-300 text-red-700" : budgetPct >= 80 ? "border-amber-300 text-amber-700" : "")}>Budget gauge: {budgetPct}% {budgetPct >= 95 ? "⚠️ over 95%" : budgetPct >= 80 ? "attenzione 80%" : "ok"}</div>
            <div className={cn("border rounded-lg p-3 text-sm", overdueTasks.length > 0 ? "border-red-300 text-red-700" : "")}>{overdueTasks.length > 0 ? `Overdue alert: ${overdueTasks.length} task in ritardo` : "Nessun overdue"}</div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
