import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { portalFetch } from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import {
  Plus,
  Search,
  Calendar,
  Edit,
  Eye,
  Copy,
  Trash2,
  FileDown,
  Wrench,
  CalendarDays,
  FileText,
  Hash,
  MessageSquareQuote,
  ChevronRight,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type Plan = {
  id: number;
  clientId: number;
  clientName: string;
  clientColor: string;
  month: number;
  year: number;
  status: string;
  platformsJson: string[];
  packageType: string;
  totalSlots: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type Template = {
  id: number;
  name: string;
  description: string;
  packageType: string;
  isSystem: boolean;
};

type Client = {
  id: number;
  name: string;
  color: string;
};

const MONTHS = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

const STATUS_BADGES: Record<string, { label: string; class: string }> = {
  bozza: { label: "Bozza", class: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  in_revisione: { label: "In Revisione", class: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  approvato: { label: "Approvato", class: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  inviato_al_cliente: { label: "Inviato al Cliente", class: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  confermato: { label: "Confermato", class: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" },
};

const PLATFORMS: { value: string; label: string }[] = [
  { value: "instagram_feed", label: "Instagram Feed" },
  { value: "instagram_stories", label: "Instagram Stories" },
  { value: "instagram_reels", label: "Instagram Reels" },
  { value: "facebook_feed", label: "Facebook Feed" },
  { value: "facebook_stories", label: "Facebook Stories" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube_shorts", label: "YouTube Shorts" },
];

const TOOLS = [
  { id: "piano-editoriale", label: "Piano Editoriale", icon: CalendarDays, active: true },
  { id: "content-brief", label: "Content Brief", icon: FileText, active: false },
  { id: "hashtag-sets", label: "Hashtag Sets", icon: Hash, active: false },
  { id: "caption-templates", label: "Caption Templates", icon: MessageSquareQuote, active: false },
];

export default function Tools() {
  const [, setLocation] = useLocation();
  const [activeTool, setActiveTool] = useState("piano-editoriale");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const { toast } = useToast();

  const [newPlan, setNewPlan] = useState({
    clientId: "",
    month: String(new Date().getMonth() + 1),
    year: String(new Date().getFullYear()),
    platforms: ["instagram_feed"] as string[],
    packageType: "standard",
    templateId: "",
    notes: "",
  });

  const fetchPlans = useCallback(async () => {
    try {
      const res = await portalFetch("/api/editorial-plans");
      if (res.ok) setPlans(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      const res = await portalFetch("/api/clients");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setClients(data);
        // Support wrapped payloads like { items: [...] }
        else if (Array.isArray((data as any)?.items)) setClients((data as any).items);
        else setClients([]);
      }
    } catch {}
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await portalFetch("/api/editorial-templates");
      if (res.ok) setTemplates(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    portalFetch("/api/editorial-plans/seed-defaults", { method: "POST" }).catch(() => {});
    fetchPlans();
    fetchClients();
    fetchTemplates();
  }, [fetchPlans, fetchClients, fetchTemplates]);

  const handleCreate = async () => {
    if (!newPlan.clientId) {
      toast({ title: "Seleziona un cliente", variant: "destructive" });
      return;
    }
    try {
      const res = await portalFetch("/api/editorial-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: Number(newPlan.clientId),
          month: Number(newPlan.month),
          year: Number(newPlan.year),
          platformsJson: newPlan.platforms,
          packageType: newPlan.packageType,
          notesInternal: newPlan.notes || null,
          templateId: newPlan.templateId ? Number(newPlan.templateId) : null,
        }),
      });
      if (res.ok) {
        const plan = await res.json();
        setShowCreate(false);
        setLocation(`/tools/piano-editoriale/${plan.id}`);
      }
    } catch {
      toast({ title: "Errore nella creazione", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Eliminare questo piano editoriale?")) return;
    await portalFetch(`/api/editorial-plans/${id}`, { method: "DELETE" });
    fetchPlans();
  };

  const handleDuplicate = async (id: number) => {
    try {
      const res = await portalFetch(`/api/editorial-plans/${id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        toast({ title: "Piano duplicato con successo" });
        fetchPlans();
      }
    } catch {
      toast({ title: "Errore nella duplicazione", variant: "destructive" });
    }
  };

  const filteredPlans = plans.filter((p) => {
    if (search && !p.clientName?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterClient && p.clientId !== Number(filterClient)) return false;
    if (filterStatus && p.status !== filterStatus) return false;
    return true;
  });

  const togglePlatform = (val: string) => {
    setNewPlan((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(val)
        ? prev.platforms.filter((p) => p !== val)
        : [...prev.platforms, val],
    }));
  };

  return (
    <Layout>
      <div className="flex h-[calc(100vh-1rem)] gap-0">
        <div className="w-56 bg-card border-r border-border flex flex-col shrink-0">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Wrench size={15} />
              Strumenti
            </h2>
          </div>
          <nav className="flex-1 p-2 space-y-0.5">
            {TOOLS.map((tool) => (
              <button
                key={tool.id}
                onClick={() => tool.active && setActiveTool(tool.id)}
                disabled={!tool.active}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
                  activeTool === tool.id
                    ? "bg-primary/10 text-primary"
                    : tool.active
                      ? "text-foreground/70 hover:bg-muted"
                      : "text-muted-foreground/40 cursor-not-allowed"
                )}
              >
                <tool.icon size={16} />
                {tool.label}
                {!tool.active && (
                  <span className="ml-auto text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Soon</span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 overflow-auto">
          {activeTool === "piano-editoriale" && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold">Piano Editoriale</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Crea e gestisci i piani editoriali per ogni cliente
                  </p>
                </div>
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <Plus size={16} />
                  Nuovo Piano Editoriale
                </button>
              </div>

              <div className="flex items-center gap-3 mb-5">
                <div className="relative flex-1 max-w-xs">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Cerca per cliente..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <select
                  value={filterClient}
                  onChange={(e) => setFilterClient(e.target.value)}
                  className="px-3 py-2 border border-border rounded-lg text-sm bg-background"
                >
                  <option value="">Tutti i clienti</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border border-border rounded-lg text-sm bg-background"
                >
                  <option value="">Tutti gli stati</option>
                  {Object.entries(STATUS_BADGES).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>

              {loading ? (
                <div className="text-center py-20 text-muted-foreground">Caricamento...</div>
              ) : filteredPlans.length === 0 ? (
                <div className="text-center py-20">
                  <CalendarDays size={48} className="mx-auto text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">Nessun piano editoriale trovato</p>
                  <p className="text-sm text-muted-foreground/60 mt-1">Crea il primo piano per iniziare</p>
                </div>
              ) : (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cliente</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Periodo</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Stato</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Piattaforme</th>
                        <th className="text-center px-4 py-3 font-medium text-muted-foreground">Post</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Pacchetto</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPlans.map((plan) => {
                        const badge = STATUS_BADGES[plan.status] ?? STATUS_BADGES.bozza;
                        return (
                          <tr key={plan.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full shrink-0"
                                  style={{ backgroundColor: plan.clientColor ?? "#7a8f5c" }}
                                />
                                <span className="font-medium">{plan.clientName}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <Calendar size={13} className="text-muted-foreground" />
                                {MONTHS[plan.month - 1]} {plan.year}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={cn("text-xs px-2 py-1 rounded-full font-medium", badge.class)}>
                                {badge.label}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1">
                                {(plan.platformsJson ?? []).slice(0, 3).map((p: string) => (
                                  <span key={p} className="text-[10px] px-1.5 py-0.5 bg-muted rounded font-medium">
                                    {p.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).substring(0, 10)}
                                  </span>
                                ))}
                                {(plan.platformsJson?.length ?? 0) > 3 && (
                                  <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded">+{plan.platformsJson.length - 3}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center font-medium">{plan.totalSlots}</td>
                            <td className="px-4 py-3 capitalize text-muted-foreground">{plan.packageType}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => setLocation(`/tools/piano-editoriale/${plan.id}`)}
                                  className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                                  title="Modifica"
                                >
                                  <Edit size={14} />
                                </button>
                                <button
                                  onClick={() => handleDuplicate(plan.id)}
                                  className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                                  title="Duplica"
                                >
                                  <Copy size={14} />
                                </button>
                                <button
                                  onClick={() => handleDelete(plan.id)}
                                  className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 transition-colors"
                                  title="Elimina"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTool !== "piano-editoriale" && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Wrench size={48} className="mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-lg font-medium text-muted-foreground">In arrivo</p>
                <p className="text-sm text-muted-foreground/60 mt-1">Questo strumento sara disponibile a breve</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-border">
              <h2 className="text-lg font-bold">Nuovo Piano Editoriale</h2>
              <p className="text-sm text-muted-foreground mt-1">Configura il piano per il tuo cliente</p>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Cliente *</label>
                <select
                  value={newPlan.clientId}
                  onChange={(e) => setNewPlan((p) => ({ ...p, clientId: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background"
                >
                  <option value="">Seleziona cliente...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Mese</label>
                  <select
                    value={newPlan.month}
                    onChange={(e) => setNewPlan((p) => ({ ...p, month: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background"
                  >
                    {MONTHS.map((m, i) => (
                      <option key={i} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Anno</label>
                  <select
                    value={newPlan.year}
                    onChange={(e) => setNewPlan((p) => ({ ...p, year: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background"
                  >
                    {[2025, 2026, 2027].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Piattaforme</label>
                <div className="grid grid-cols-2 gap-2">
                  {PLATFORMS.map((p) => (
                    <label
                      key={p.value}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors",
                        newPlan.platforms.includes(p.value)
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:bg-muted"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={newPlan.platforms.includes(p.value)}
                        onChange={() => togglePlatform(p.value)}
                        className="sr-only"
                      />
                      <div className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                        newPlan.platforms.includes(p.value) ? "bg-primary border-primary" : "border-border"
                      )}>
                        {newPlan.platforms.includes(p.value) && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        )}
                      </div>
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Pacchetto contenuti</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: "base", label: "Base", desc: "4 post" },
                    { value: "standard", label: "Standard", desc: "8 post" },
                    { value: "premium", label: "Premium", desc: "12 post" },
                    { value: "custom", label: "Custom", desc: "Personalizzato" },
                  ].map((pkg) => (
                    <button
                      key={pkg.value}
                      onClick={() => setNewPlan((p) => ({ ...p, packageType: pkg.value }))}
                      className={cn(
                        "px-3 py-2 rounded-lg border text-center transition-colors",
                        newPlan.packageType === pkg.value
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:bg-muted"
                      )}
                    >
                      <p className="text-sm font-medium">{pkg.label}</p>
                      <p className="text-[10px] text-muted-foreground">{pkg.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {templates.length > 0 && (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Template (opzionale)</label>
                  <select
                    value={newPlan.templateId}
                    onChange={(e) => setNewPlan((p) => ({ ...p, templateId: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background"
                  >
                    <option value="">Nessun template — crea da zero</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}{t.isSystem ? " (sistema)" : ""}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-sm font-medium mb-1.5 block">Note interne</label>
                <textarea
                  value={newPlan.notes}
                  onChange={(e) => setNewPlan((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Note per il team (non visibili nel PDF)..."
                  rows={2}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background resize-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-border flex justify-end gap-3">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleCreate}
                className="px-4 py-2 text-sm font-medium rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Crea Piano
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
