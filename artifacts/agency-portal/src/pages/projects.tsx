import { useState } from "react";
import { Link } from "wouter";
import {
  useListProjects,
  useListClients,
  useCreateProject,
  useDeleteProject,
  getListProjectsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Plus, Trash2, ChevronRight, Search, Lock, X, CalendarDays } from "lucide-react";
import { cn, STATUS_LABELS, STATUS_COLORS, PROJECT_CATEGORIES, formatDate } from "@/lib/utils";
import { CategoryIcon } from "@/components/CategoryIcon";

export default function Projects() {
  const qc = useQueryClient();
  const { data: projects, isLoading } = useListProjects({});
  const { data: clients } = useListClients();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterDeadlineFrom, setFilterDeadlineFrom] = useState("");
  const [filterDeadlineTo, setFilterDeadlineTo] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    clientId: "" as string | number,
    status: "planning",
    category: "",
    progress: 0,
    deadline: "",
    budget: "" as string | number,
    isPrivate: false,
  });

  const projectList = Array.isArray(projects)
    ? projects
    : // Support { items: [...] } or a single object response
      // @ts-expect-error runtime safety for unknown shape
      Array.isArray(projects?.items)
      ? // @ts-expect-error runtime safety for unknown shape
        projects.items
      : projects
        ? [projects as any]
        : [];
  const clientList = Array.isArray(clients)
    ? clients
    : // @ts-expect-error runtime safety for unknown shape
      Array.isArray(clients?.items)
      ? // @ts-expect-error runtime safety for unknown shape
        clients.items
      : clients
        ? [clients as any]
        : [];

  const filtered = projectList.filter((p: any) => {
    const matchSearch = String(p?.name ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || p.status === filterStatus;
    const matchClient = !filterClient || String(p.clientId) === filterClient;
    const matchCategory = !filterCategory || (p as any).category === filterCategory;
    const matchDeadlineFrom = !filterDeadlineFrom || (p.deadline && p.deadline >= filterDeadlineFrom);
    const matchDeadlineTo = !filterDeadlineTo || (p.deadline && p.deadline <= filterDeadlineTo);
    return matchSearch && matchStatus && matchClient && matchCategory && matchDeadlineFrom && matchDeadlineTo;
  });

  const handleCreate = () => {
    if (!form.name.trim()) return;
    createProject.mutate(
      {
        data: {
          name: form.name,
          description: form.description || null,
          clientId: form.clientId ? Number(form.clientId) : null,
          status: form.status,
          progress: Number(form.progress),
          deadline: form.deadline || null,
          budget: form.budget ? Number(form.budget) : null,
          isPrivate: form.isPrivate,
          category: form.category || null,
        } as any,
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
          setShowForm(false);
          setForm({ name: "", description: "", clientId: "", status: "planning", category: "", progress: 0, deadline: "", budget: "", isPrivate: false });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    if (!confirm("Eliminare questo progetto?")) return;
    deleteProject.mutate({ id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListProjectsQueryKey() }) });
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Progetti</h1>
            <p className="text-muted-foreground text-sm mt-1">{projectList.length} progetti totali</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={16} />
            Nuovo Progetto
          </button>
        </div>

        {showForm && (
          <div className="bg-card border border-card-border rounded-xl p-6 mb-6 shadow-sm">
            <h2 className="text-sm font-semibold mb-4">Nuovo Progetto</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Nome *</label>
                <input className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Nome progetto" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Descrizione</label>
                <textarea className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none" rows={2} placeholder="Descrizione del progetto" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Cliente</label>
                <select className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
                  <option value="">Nessun cliente</option>
                  {clientList.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Categoria</label>
                <select className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="">Seleziona categoria...</option>
                  {PROJECT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Stato</label>
                <select className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Scadenza</label>
                <input type="date" className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Budget (€)</label>
                <input type="number" className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="0" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
              </div>
            </div>
            {/* Progetto riservato toggle */}
            <div className="mt-4 pt-4 border-t border-border">
              <label className="flex items-center gap-3 cursor-pointer select-none w-fit">
                <div
                  onClick={() => setForm({ ...form, isPrivate: !form.isPrivate })}
                  className={cn(
                    "relative w-10 h-5 rounded-full transition-colors",
                    form.isPrivate ? "bg-primary" : "bg-muted"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
                    form.isPrivate ? "translate-x-5" : "translate-x-0.5"
                  )} />
                </div>
                <div className="flex items-center gap-1.5">
                  <Lock size={13} className={form.isPrivate ? "text-primary" : "text-muted-foreground"} />
                  <span className="text-sm font-medium">Progetto riservato</span>
                  <span className="text-xs text-muted-foreground ml-1">(visibile solo all'admin e al creatore)</span>
                </div>
              </label>
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={handleCreate} disabled={createProject.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {createProject.isPending ? "Salvataggio..." : "Crea Progetto"}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:opacity-80">Annulla</button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input className="w-full pl-9 pr-4 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Cerca progetti..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Tutti gli stati</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select className="px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" value={filterClient} onChange={(e) => setFilterClient(e.target.value)}>
            <option value="">Tutti i clienti</option>
            {clientList.map((c: any) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
          </select>
          <select className="px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="">Tutte le categorie</option>
            {PROJECT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <div className="flex items-center gap-1.5">
            <CalendarDays size={14} className="text-muted-foreground shrink-0" />
            <input type="date" className="px-2 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" value={filterDeadlineFrom} onChange={(e) => setFilterDeadlineFrom(e.target.value)} title="Da data" />
            <span className="text-xs text-muted-foreground">-</span>
            <input type="date" className="px-2 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" value={filterDeadlineTo} onChange={(e) => setFilterDeadlineTo(e.target.value)} title="A data" />
          </div>
          {(filterClient || filterCategory || filterDeadlineFrom || filterDeadlineTo || filterStatus || search) && (
            <button onClick={() => { setSearch(""); setFilterStatus(""); setFilterClient(""); setFilterCategory(""); setFilterDeadlineFrom(""); setFilterDeadlineTo(""); }} className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground border border-input rounded-lg bg-background flex items-center gap-1">
              <X size={12} /> Azzera filtri
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="text-center text-muted-foreground py-12">Caricamento...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">Nessun progetto trovato</div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((p: any) => (
              <div key={p.id} className="bg-card border border-card-border rounded-xl p-5 shadow-sm group hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link href={`/projects/${p.id}`}>
                        <span className="font-semibold text-sm cursor-pointer hover:text-primary transition-colors">{p.name}</span>
                      </Link>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_COLORS[p.status])}>
                        {STATUS_LABELS[p.status]}
                      </span>
                      {(p as any).isPrivate && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                          <Lock size={10} /> Riservato
                        </span>
                      )}
                    </div>
                    {(() => {
                      const cat = PROJECT_CATEGORIES.find((c) => c.value === (p as any).category);
                      return (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          {cat && <CategoryIcon icon={cat.icon} size={12} className="shrink-0" />}
                          {[p.clientName, cat?.label].filter(Boolean).join(" · ")}
                        </div>
                      );
                    })()}
                    {p.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{p.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {p.deadline && <span className="text-xs text-muted-foreground">{formatDate(p.deadline)}</span>}
                    <button onClick={() => handleDelete(p.id)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 size={14} />
                    </button>
                    <Link href={`/projects/${p.id}`}>
                      <div className="p-1.5 text-muted-foreground hover:text-foreground cursor-pointer"><ChevronRight size={16} /></div>
                    </Link>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${p.progress}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground w-8 text-right">{p.progress}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
