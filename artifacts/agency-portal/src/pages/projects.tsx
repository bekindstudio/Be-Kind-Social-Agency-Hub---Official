import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useListProjects, useListClients, useCreateProject, useListTeamMembers, getListProjectsQueryKey, portalFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { useToast } from "@/hooks/use-toast";
import { useClientContext } from "@/context/ClientContext";
import { Plus, Search, LayoutGrid, List, AlertTriangle, MessageCircle, Archive, Trash2, Sparkles } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { ProjectWizard } from "@/components/project/ProjectWizard";

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
  const { activeClient } = useClientContext();
  const activeClientNumericId = activeClient?.id ? Number(activeClient.id) : NaN;
  const apiClientId = Number.isFinite(activeClientNumericId) ? activeClientNumericId : null;
  const projectsQueryParams = apiClientId != null ? { clientId: apiClientId } : {};
  const { data: projects, isLoading } = useListProjects(projectsQueryParams);
  const { data: clients } = useListClients();
  const { data: teamMembers } = useListTeamMembers();
  const createProject = useCreateProject();

  const [view, setView] = useState<"card" | "table">("card");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [client, setClient] = useState("");
  const [type, setType] = useState("");
  const [sortBy, setSortBy] = useState("dueDate");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);

  const [prefill, setPrefill] = useState<{ name?: string; clientId?: string; budget?: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "1") {
      setShowCreate(true);
      const pf: { name?: string; clientId?: string; budget?: string } = {};
      const pname = params.get("name");
      const pclient = params.get("client");
      const pbudget = params.get("budget");
      if (pname) pf.name = pname;
      if (pclient) pf.clientId = pclient;
      if (pbudget) pf.budget = pbudget;
      if (Object.keys(pf).length > 0) setPrefill(pf);
      ["new", "name", "client", "budget"].forEach((k) => params.delete(k));
      const newSearch = params.toString();
      window.history.replaceState({}, "", `/projects${newSearch ? `?${newSearch}` : ""}`);
    }
  }, []);

  const projectList = Array.isArray(projects) ? projects : Array.isArray((projects as any)?.items) ? (projects as any).items : projects ? [projects as any] : [];
  const clientList = Array.isArray(clients) ? clients : Array.isArray((clients as any)?.items) ? (clients as any).items : clients ? [clients as any] : [];
  const clientMap = new Map(clientList.map((c: any) => [String(c.id), c]));
  const teamList = Array.isArray(teamMembers) ? teamMembers : Array.isArray((teamMembers as any)?.items) ? (teamMembers as any).items : [];
  const activeBackendClientId =
    apiClientId != null
      ? String(apiClientId)
      : String(
          (
            clientList.find(
              (c: any) => String(c?.name ?? "").trim().toLowerCase() === String(activeClient?.name ?? "").trim().toLowerCase()
            ) as any
          )?.id ?? ""
        );

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

  useEffect(() => {
    if (!activeBackendClientId) return;
    setClient(activeBackendClientId);
  }, [activeBackendClientId]);

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

  const handleCreateFromWizard = (payload: any): Promise<{ id?: number | string }> => {
    return new Promise((resolve, reject) => {
      createProject.mutate({ data: payload as any }, {
        onSuccess: (data: any) => {
          qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
          toast({ title: "Progetto creato", description: payload.name });
          resolve({ id: data?.id });
        },
        onError: (err: any) => {
          const base = err?.data?.error || err?.data?.message || "Impossibile creare il progetto";
          const hint = err?.data?.hint;
          toast({
            variant: "destructive",
            title: "Creazione progetto non riuscita",
            description: hint ? `${base}. ${hint}` : base,
          });
          reject(err);
        },
      });
    });
  };

  const allFilteredProjectIds = filtered.map((p: any) => Number(p.id)).filter((id: number) => Number.isFinite(id));
  const allSelected = allFilteredProjectIds.length > 0 && allFilteredProjectIds.every((id: number) => selectedProjectIds.includes(id));

  const toggleProjectSelection = (id: number, checked: boolean) => {
    setSelectedProjectIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  };

  const toggleSelectAllFiltered = (checked: boolean) => {
    if (!checked) {
      setSelectedProjectIds((prev) => prev.filter((id) => !allFilteredProjectIds.includes(id)));
      return;
    }
    setSelectedProjectIds((prev) => Array.from(new Set([...prev, ...allFilteredProjectIds])));
  };

  const handleBulkDeleteProjects = async () => {
    if (selectedProjectIds.length === 0) return;
    const ok = confirm(`Eliminare ${selectedProjectIds.length} progetti selezionati? Verranno spostati nel cestino.`);
    if (!ok) return;

    const results = await Promise.allSettled(
      selectedProjectIds.map((id) =>
        portalFetch(`/api/projects/${id}`, { method: "DELETE", credentials: "include" })
      )
    );
    const success = results.filter((r) => r.status === "fulfilled" && r.value.ok).length;
    const failed = selectedProjectIds.length - success;

    if (success > 0) {
      await qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      setSelectedProjectIds([]);
    }

    if (failed > 0) {
      toast({
        variant: "destructive",
        title: `Eliminazione parziale`,
        description: `${success} eliminati, ${failed} non eliminati.`,
      });
      return;
    }
    toast({ title: `${success} progetti spostati nel cestino` });
  };

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-6xl mx-auto">
        {/* Hero (Wave BJ): "Hai N progetti, X in scadenza" sostituisce le
            4 stat-card uguali in fila. Il bottone "Nuovo Progetto" sta a
            destra del titolo, non più su riga separata. */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            {stats.active === 0 ? (
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                Nessun progetto attivo
              </h1>
            ) : (
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                Hai <span className="text-primary tabular-nums">{stats.active}</span> {stats.active === 1 ? "progetto" : "progetti"} attivi
                {stats.dueWeek > 0 && (
                  <span className="text-amber-600">, {stats.dueWeek} in scadenza questa settimana</span>
                )}
              </h1>
            )}
            <p className="text-sm text-muted-foreground mt-2">
              {stats.completedMonth} completati questo mese · € {stats.valueInCourse.toLocaleString("it-IT")} valore totale in corso
            </p>
          </div>
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium inline-flex items-center justify-center gap-2 shadow-sm shrink-0"><Sparkles size={15} /> Nuovo Progetto</button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
          <div className="relative flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input className="w-full pl-9 pr-4 py-2 text-sm border border-input rounded-lg bg-background" placeholder="Cerca progetto o cliente..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
            <select className="px-3 py-2 text-sm border border-input rounded-lg bg-background" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Status</option>{STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
            <select className="px-3 py-2 text-sm border border-input rounded-lg bg-background" value={client} onChange={(e) => setClient(e.target.value)}><option value="">Client</option>{clientList.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <select className="px-3 py-2 text-sm border border-input rounded-lg bg-background" value={type} onChange={(e) => setType(e.target.value)}><option value="">Type</option>{TYPE_OPTIONS.map((t) => <option key={t}>{t}</option>)}</select>
            <select className="px-3 py-2 text-sm border border-input rounded-lg bg-background" value={sortBy} onChange={(e) => setSortBy(e.target.value)}><option value="dueDate">Due date</option><option value="name">Name</option><option value="budget">Budget</option><option value="progress">Progress</option><option value="lastActivity">Last activity</option><option value="client">Client</option></select>
          </div>
          <button onClick={() => setView(view === "card" ? "table" : "card")} className="hidden sm:flex px-2.5 py-2 border border-input rounded-lg bg-background" aria-label={view === "card" ? "Vista tabella" : "Vista card"}>{view === "card" ? <List size={16} /> : <LayoutGrid size={16} />}</button>
        </div>

        {selectedProjectIds.length > 0 && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50 px-3 py-2">
            <p className="text-sm text-amber-900">{selectedProjectIds.length} progetti selezionati</p>
            <button onClick={handleBulkDeleteProjects} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700">
              <Trash2 size={13} />
              Elimina selezionati
            </button>
          </div>
        )}

        {isLoading ? <div className="text-center text-muted-foreground py-12">Caricamento...</div> : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-card-border py-16 text-center">
            <LayoutGrid size={28} className="text-muted-foreground/60 mb-3" />
            {projectList.length === 0 ? (
              <>
                <p className="font-medium">Nessun progetto ancora</p>
                <p className="text-sm text-muted-foreground mt-1 mb-4">Crea il primo progetto per iniziare a organizzare il lavoro.</p>
                <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium inline-flex items-center gap-2 shadow-sm"><Sparkles size={15} /> Nuovo Progetto</button>
              </>
            ) : (
              <>
                <p className="font-medium">Nessun progetto corrisponde ai filtri</p>
                <p className="text-sm text-muted-foreground mt-1 mb-4">Prova a modificare ricerca o filtri.</p>
                <button onClick={() => { setSearch(""); setStatus(""); setClient(""); setType(""); }} className="px-4 py-2 border border-input rounded-lg text-sm font-medium">Azzera filtri</button>
              </>
            )}
          </div>
        ) : view === "card" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((p: any) => (
              <div key={p.id} className="card-hover bg-card border border-card-border rounded-xl p-4 shadow-sm group relative overflow-hidden">
                <label className="absolute top-3 right-3 z-10 inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedProjectIds.includes(Number(p.id))}
                    onChange={(e) => toggleProjectSelection(Number(p.id), e.target.checked)}
                    className="h-4 w-4 accent-primary"
                    aria-label={`Seleziona progetto ${p.name}`}
                  />
                </label>
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
                  <div className="mt-3 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center gap-1 flex-wrap">
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
              <thead><tr className="bg-muted/30 border-b border-card-border"><th className="px-3 py-2 text-left"><input type="checkbox" checked={allSelected} onChange={(e) => toggleSelectAllFiltered(e.target.checked)} aria-label="Seleziona tutti i progetti filtrati" className="h-4 w-4 accent-primary" /></th><th className="px-3 py-2 text-left">Project</th><th className="px-3 py-2 text-left">Client</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-left">Progress</th><th className="px-3 py-2 text-left">Budget</th><th className="px-3 py-2 text-left">Due date</th><th className="px-3 py-2 text-left">Last activity</th><th className="px-3 py-2 text-right">Actions</th></tr></thead>
              <tbody>{filtered.map((p: any) => <tr key={p.id} className="border-b border-card-border/50"><td className="px-3 py-2"><input type="checkbox" checked={selectedProjectIds.includes(Number(p.id))} onChange={(e) => toggleProjectSelection(Number(p.id), e.target.checked)} aria-label={`Seleziona progetto ${p.name}`} className="h-4 w-4 accent-primary" /></td><td className="px-3 py-2 font-medium">{p.name}</td><td className="px-3 py-2">{p.clientName ?? "—"}</td><td className="px-3 py-2 text-xs">{(() => { try { return (JSON.parse(p.typeJson ?? "[]") as string[]).join(", ") || "Altro"; } catch { return "Altro"; } })()}</td><td className="px-3 py-2">{STATUS_OPTIONS.find((s) => s.value === p.status)?.label ?? p.status}</td><td className="px-3 py-2">{p.progress ?? 0}%</td><td className="px-3 py-2">€ {Number(p.budget ?? 0).toLocaleString("it-IT")}</td><td className="px-3 py-2">{p.deadline ? formatDate(p.deadline) : "—"}</td><td className="px-3 py-2">{p.lastActivityAt ? formatDate(p.lastActivityAt) : formatDate(p.updatedAt)}</td><td className="px-3 py-2 text-right"><Link href={`/projects/${p.id}`} className="text-xs px-2 py-1 rounded border border-input">Open</Link></td></tr>)}</tbody>
            </table>
          </div>
        )}

        <ProjectWizard
          open={showCreate}
          onClose={() => { setShowCreate(false); setPrefill(null); }}
          onCreate={handleCreateFromWizard}
          isSubmitting={createProject.isPending}
          defaultClientId={prefill?.clientId || activeBackendClientId || undefined}
          clients={clientList as any}
          teamMembers={teamList as any}
          prefill={prefill ?? undefined}
        />

      </div>
    </Layout>
  );
}
