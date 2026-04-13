import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useListProjects, useListClients, useCreateProject, getListProjectsQueryKey, portalFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, LayoutGrid, List, AlertTriangle, MessageCircle, Archive, CalendarDays } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

const TYPE_OPTIONS = ["Social Media", "ADV Meta", "ADV Google", "Web", "Branding", "SEO", "Email Marketing", "Altro"];
const STATUS_OPTIONS = [
  { value: "planning", label: "Bozza" },
  { value: "active", label: "Attivo" },
  { value: "on-hold", label: "In pausa" },
  { value: "review", label: "In revisione" },
  { value: "completed", label: "Completato" },
  { value: "archived", label: "Archiviato" },
];

function healthStyle(h: string) {
  if (h === "on-track") return "bg-emerald-100 text-emerald-700";
  if (h === "at-risk") return "bg-amber-100 text-amber-700";
  if (h === "delayed") return "bg-red-100 text-red-700";
  if (h === "completed") return "bg-teal-100 text-teal-700";
  return "bg-gray-100 text-gray-600";
}

export default function Projects() {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { data: projects, isLoading } = useListProjects({});
  const { data: clients } = useListClients();
  const createProject = useCreateProject();

  const [view, setView] = useState<"card" | "table">("card");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [client, setClient] = useState("");
  const [type, setType] = useState("");
  const [sortBy, setSortBy] = useState("dueDate");
  const [showCreate, setShowCreate] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<any>({
    name: "", clientId: "", projectTypes: [], description: "", color: "#7a8f5c",
    startDate: "", endDate: "", oreStimate: "", budget: "", paymentStructure: "Una tantum", billingRate: "",
    projectManagerId: "", members: [], autoCreateChannel: true, autoCreateOnboardingTask: true, notifyTeam: true,
  });

  const projectList = Array.isArray(projects) ? projects : Array.isArray((projects as any)?.items) ? (projects as any).items : projects ? [projects as any] : [];
  const clientList = Array.isArray(clients) ? clients : Array.isArray((clients as any)?.items) ? (clients as any).items : clients ? [clients as any] : [];
  const clientMap = new Map(clientList.map((c: any) => [String(c.id), c]));

  const filtered = useMemo(() => {
    const now = new Date();
    return projectList
      .filter((p: any) => String(p?.name ?? "").toLowerCase().includes(search.toLowerCase()) || String(p?.clientName ?? "").toLowerCase().includes(search.toLowerCase()))
      .filter((p: any) => !status || p.status === status)
      .filter((p: any) => !client || String(p.clientId) === client)
      .filter((p: any) => !type || String(p.typeJson ?? "").includes(type))
      .sort((a: any, b: any) => {
        if (sortBy === "name") return String(a.name).localeCompare(String(b.name));
        if (sortBy === "budget") return Number(b.budget ?? 0) - Number(a.budget ?? 0);
        if (sortBy === "progress") return Number(b.progress ?? 0) - Number(a.progress ?? 0);
        if (sortBy === "client") return String(a.clientName ?? "").localeCompare(String(b.clientName ?? ""));
        if (sortBy === "lastActivity") return new Date(b.lastActivityAt ?? b.updatedAt).getTime() - new Date(a.lastActivityAt ?? a.updatedAt).getTime();
        return new Date(a.deadline ?? "2999-12-31").getTime() - new Date(b.deadline ?? "2999-12-31").getTime();
      })
      .map((p: any) => {
        const dueDays = p.deadline ? Math.ceil((new Date(p.deadline).getTime() - now.getTime()) / 86400000) : null;
        return { ...p, dueDays };
      });
  }, [projectList, search, status, client, type, sortBy]);

  const stats = useMemo(() => {
    const now = new Date();
    const weekEnd = new Date(); weekEnd.setDate(now.getDate() + 7);
    const month = now.getMonth();
    return {
      active: projectList.filter((p: any) => p.status === "active").length,
      dueWeek: projectList.filter((p: any) => p.deadline && new Date(p.deadline) <= weekEnd && new Date(p.deadline) >= now).length,
      completedMonth: projectList.filter((p: any) => p.status === "completed" && new Date(p.updatedAt).getMonth() === month).length,
      valueInCourse: projectList.filter((p: any) => p.status !== "completed" && p.status !== "archived").reduce((a: number, p: any) => a + Number(p.budget ?? 0), 0),
    };
  }, [projectList]);

  const create = () => {
    if (!form.name || !form.clientId) {
      toast({
        variant: "destructive",
        title: "Dati mancanti",
        description: "Inserisci almeno nome progetto e cliente.",
      });
      return;
    }
    createProject.mutate({
      data: {
        name: form.name,
        description: form.description || null,
        clientId: Number(form.clientId),
        status: "planning",
        progress: 0,
        deadline: form.endDate || null,
        budget: form.budget ? Number(form.budget) : null,
        color: form.color,
        projectTypes: form.projectTypes,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        oreStimate: form.oreStimate ? Number(form.oreStimate) : null,
        paymentStructure: form.paymentStructure,
        billingRate: form.billingRate ? Number(form.billingRate) : null,
        projectManagerId: form.projectManagerId ? Number(form.projectManagerId) : null,
        members: form.members,
        autoCreateChannel: form.autoCreateChannel,
        autoCreateOnboardingTask: form.autoCreateOnboardingTask,
        notifyTeam: form.notifyTeam,
      } as any,
    }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        setShowCreate(false);
        setStep(1);
        toast({ title: "Progetto creato con successo" });
      },
      onError: (err: any) => {
        const base =
          err?.data?.error ||
          err?.data?.message ||
          "Impossibile creare il progetto";
        const hint = err?.data?.hint;
        toast({
          variant: "destructive",
          title: "Creazione progetto non riuscita",
          description: hint ? `${base}. ${hint}` : base,
        });
      },
    });
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-card border border-card-border rounded-xl p-4"><p className="text-xs text-muted-foreground">Progetti attivi</p><p className="text-2xl font-bold">{stats.active}</p></div>
          <div className="bg-card border border-card-border rounded-xl p-4"><p className="text-xs text-muted-foreground">In scadenza questa settimana</p><p className="text-2xl font-bold">{stats.dueWeek}</p></div>
          <div className="bg-card border border-card-border rounded-xl p-4"><p className="text-xs text-muted-foreground">Completati questo mese</p><p className="text-2xl font-bold">{stats.completedMonth}</p></div>
          <div className="bg-card border border-card-border rounded-xl p-4"><p className="text-xs text-muted-foreground">Valore totale in corso</p><p className="text-2xl font-bold">€ {stats.valueInCourse.toLocaleString("it-IT")}</p></div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Project Management</h1>
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium inline-flex items-center gap-2"><Plus size={15} /> Nuovo Progetto</button>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input className="w-full pl-9 pr-4 py-2 text-sm border border-input rounded-lg bg-background" placeholder="Cerca progetto o cliente..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <select className="px-3 py-2 text-sm border border-input rounded-lg bg-background" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Status</option>{STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
          <select className="px-3 py-2 text-sm border border-input rounded-lg bg-background" value={client} onChange={(e) => setClient(e.target.value)}><option value="">Client</option>{clientList.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select className="px-3 py-2 text-sm border border-input rounded-lg bg-background" value={type} onChange={(e) => setType(e.target.value)}><option value="">Type</option>{TYPE_OPTIONS.map((t) => <option key={t}>{t}</option>)}</select>
          <select className="px-3 py-2 text-sm border border-input rounded-lg bg-background" value={sortBy} onChange={(e) => setSortBy(e.target.value)}><option value="dueDate">Due date</option><option value="name">Name</option><option value="budget">Budget</option><option value="progress">Progress</option><option value="lastActivity">Last activity</option><option value="client">Client</option></select>
          <button onClick={() => setView(view === "card" ? "table" : "card")} className="px-2.5 py-2 border border-input rounded-lg bg-background">{view === "card" ? <List size={16} /> : <LayoutGrid size={16} />}</button>
        </div>

        {isLoading ? <div className="text-center text-muted-foreground py-12">Caricamento...</div> : view === "card" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((p: any) => (
              <div key={p.id} className="bg-card border border-card-border rounded-xl p-4 shadow-sm group relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: p.color ?? (clientMap.get(String(p.clientId)) as any)?.brandColor ?? "#7a8f5c" }} />
                <div className="pl-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.clientName ?? "Cliente"}</p>
                    </div>
                    <span className={cn("text-[11px] px-2 py-0.5 rounded-full", healthStyle(p.healthStatus ?? "on-track"))}>{p.healthStatus ?? "on-track"}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(() => {
                      const types = (() => { try { return JSON.parse(p.typeJson ?? "[]"); } catch { return []; } })() as string[];
                      return types.length ? types.map((t) => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{t}</span>) : <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Altro</span>;
                    })()}
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{STATUS_OPTIONS.find((s) => s.value === p.status)?.label ?? p.status}</span>
                  </div>
                  <div className="mt-3">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary" style={{ width: `${p.progress ?? 0}%` }} /></div>
                    <p className="text-[11px] text-muted-foreground mt-1">{p.tasksDone ?? 0}/{p.tasksTotal ?? 0} task completate ({p.progress ?? 0}%)</p>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-xs">€ {Number(p.budget ?? 0).toLocaleString("it-IT")}</p>
                    <p className={cn("text-xs", p.dueDays != null && p.dueDays <= 7 ? "text-red-600 font-semibold" : "text-muted-foreground")}>{p.deadline ? formatDate(p.deadline) : "—"}</p>
                  </div>
                  {p.dueDays != null && p.dueDays < 0 && <div className="mt-2 text-xs text-red-600 flex items-center gap-1"><AlertTriangle size={12} /> Scaduto da {Math.abs(p.dueDays)} giorni</div>}
                  <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    <button onClick={() => navigate(`/projects/${p.id}`)} className="px-2 py-1 text-xs border border-input rounded">Open</button>
                    <button onClick={() => navigate("/tasks")} className="px-2 py-1 text-xs border border-input rounded">New Task</button>
                    <button onClick={() => navigate("/chat")} className="px-2 py-1 text-xs border border-input rounded inline-flex items-center gap-1"><MessageCircle size={12} /> Msg</button>
                    <button onClick={() => portalFetch(`/api/projects/${p.id}/archive`, { method: "POST" }).then(() => qc.invalidateQueries({ queryKey: getListProjectsQueryKey() }))} className="px-2 py-1 text-xs border border-input rounded inline-flex items-center gap-1"><Archive size={12} /> Archive</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-card border border-card-border rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/30 border-b border-card-border"><th className="px-3 py-2 text-left">Project</th><th className="px-3 py-2 text-left">Client</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-left">Progress</th><th className="px-3 py-2 text-left">Budget</th><th className="px-3 py-2 text-left">Due date</th><th className="px-3 py-2 text-left">Last activity</th><th className="px-3 py-2 text-right">Actions</th></tr></thead>
              <tbody>{filtered.map((p: any) => <tr key={p.id} className="border-b border-card-border/50"><td className="px-3 py-2 font-medium">{p.name}</td><td className="px-3 py-2">{p.clientName ?? "—"}</td><td className="px-3 py-2 text-xs">{(() => { try { return (JSON.parse(p.typeJson ?? "[]") as string[]).join(", ") || "Altro"; } catch { return "Altro"; } })()}</td><td className="px-3 py-2">{STATUS_OPTIONS.find((s) => s.value === p.status)?.label ?? p.status}</td><td className="px-3 py-2">{p.progress ?? 0}%</td><td className="px-3 py-2">€ {Number(p.budget ?? 0).toLocaleString("it-IT")}</td><td className="px-3 py-2">{p.deadline ? formatDate(p.deadline) : "—"}</td><td className="px-3 py-2">{p.lastActivityAt ? formatDate(p.lastActivityAt) : formatDate(p.updatedAt)}</td><td className="px-3 py-2 text-right"><Link href={`/projects/${p.id}`} className="text-xs px-2 py-1 rounded border border-input">Open</Link></td></tr>)}</tbody>
            </table>
          </div>
        )}

        {showCreate && (
          <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
            <div className="bg-card border border-card-border rounded-xl w-full max-w-3xl p-5">
              <div className="flex items-center justify-between mb-4"><h2 className="font-semibold">Nuovo Progetto</h2><button onClick={() => setShowCreate(false)} className="text-sm text-muted-foreground">Chiudi</button></div>
              <div className="flex items-center gap-2 mb-4">{[1, 2, 3, 4].map((n) => <button key={n} onClick={() => setStep(n)} className={cn("w-7 h-7 rounded-full text-xs", step === n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{n}</button>)}</div>
              {step === 1 && <div className="grid grid-cols-2 gap-3"><input className="px-3 py-2 border border-input rounded-lg bg-background" placeholder="Project name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><select className="px-3 py-2 border border-input rounded-lg bg-background" value={form.clientId} onChange={(e) => { const cl = clientMap.get(e.target.value) as any; setForm({ ...form, clientId: e.target.value, color: cl?.brandColor ?? cl?.color ?? form.color }); }}><option value="">Client *</option>{clientList.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><div className="col-span-2"><textarea className="w-full px-3 py-2 border border-input rounded-lg bg-background" rows={3} placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div><div className="col-span-2 flex flex-wrap gap-1.5">{TYPE_OPTIONS.map((t) => { const on = form.projectTypes.includes(t); return <button key={t} onClick={() => setForm({ ...form, projectTypes: on ? form.projectTypes.filter((x: string) => x !== t) : [...form.projectTypes, t] })} className={cn("text-xs px-2 py-1 rounded border", on ? "bg-primary/10 border-primary text-primary" : "border-input")}>{t}</button>; })}</div><div><label className="text-xs text-muted-foreground">Color</label><input type="color" className="block mt-1 h-9 w-20 border border-input rounded" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></div></div>}
              {step === 2 && <div className="grid grid-cols-2 gap-3"><div><label className="text-xs text-muted-foreground">Start</label><input type="date" className="w-full px-3 py-2 border border-input rounded-lg bg-background mt-1" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div><div><label className="text-xs text-muted-foreground">End/deadline</label><input type="date" className="w-full px-3 py-2 border border-input rounded-lg bg-background mt-1" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div><input className="px-3 py-2 border border-input rounded-lg bg-background" placeholder="Estimated hours" value={form.oreStimate} onChange={(e) => setForm({ ...form, oreStimate: e.target.value })} /><input className="px-3 py-2 border border-input rounded-lg bg-background" placeholder="Budget (€)" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /><select className="px-3 py-2 border border-input rounded-lg bg-background" value={form.paymentStructure} onChange={(e) => setForm({ ...form, paymentStructure: e.target.value })}><option>Una tantum</option><option>Mensile ricorrente</option><option>A milestone</option><option>A ore</option></select><input className="px-3 py-2 border border-input rounded-lg bg-background" placeholder="Billing rate €/h" value={form.billingRate} onChange={(e) => setForm({ ...form, billingRate: e.target.value })} /></div>}
              {step === 3 && <div className="grid grid-cols-2 gap-3"><input className="px-3 py-2 border border-input rounded-lg bg-background" placeholder="Project manager ID" value={form.projectManagerId} onChange={(e) => setForm({ ...form, projectManagerId: e.target.value })} /><textarea className="px-3 py-2 border border-input rounded-lg bg-background col-span-2" rows={3} placeholder='Team members JSON es: [{"userId":1,"role":"Media Buyer"}]' value={JSON.stringify(form.members)} onChange={(e) => { try { setForm({ ...form, members: JSON.parse(e.target.value) }); } catch {} }} /></div>}
              {step === 4 && <div className="space-y-2">{[
                ["autoCreateChannel", "Auto-create project channel"],
                ["autoCreateOnboardingTask", "Auto-create onboarding task checklist"],
                ["notifyTeam", "Notify team members"],
              ].map(([k, l]) => <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(form[k])} onChange={(e) => setForm({ ...form, [k]: e.target.checked })} /> {l}</label>)}</div>}
              <div className="mt-4 flex justify-between"><button onClick={() => setStep(Math.max(1, step - 1))} className="px-3 py-2 text-sm border border-input rounded-lg">Indietro</button><div className="flex gap-2">{step < 4 ? <button onClick={() => setStep(step + 1)} className="px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg">Avanti</button> : <button onClick={create} className="px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg">Crea progetto</button>}</div></div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
