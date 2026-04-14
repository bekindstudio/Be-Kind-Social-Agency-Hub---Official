import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import {
  useGetClient,
  useUpdateClient,
  useListProjects,
  useCreateProject,
  useListTasks,
  useCreateTask,
  useListTeamMembers,
  getGetClientQueryKey,
  getListProjectsQueryKey,
  getListTasksQueryKey,
  portalFetch,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import {
  ChevronLeft,
  Pencil,
  Save,
  X,
  FolderKanban,
  CheckSquare,
  Plus,
  Globe,
  Building2,
  Receipt,
  StickyNote,
  Upload,
  ImageIcon,
  Share2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Link2Off,
  Wifi,
  WifiOff,
  HardDrive,
  FileText,
  Send,
  Clock,
  AlertTriangle,
  ThumbsUp,
  Trash2,
  Zap,
  Mail,
  Eye,
  Settings as SettingsIcon,
  Sparkles,
  BookOpen,
} from "lucide-react";
import { cn, STATUS_LABELS, STATUS_COLORS, TASK_STATUS_LABELS, TASK_STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS, formatDate } from "@/lib/utils";
import { useAiChat } from "@/components/ai-chat/AiChatContext";
import { useClientContext } from "@/context/ClientContext";

interface Props { id: string; }

const FIELD = (label: string, value?: string | null) =>
  value ? (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm mt-0.5">{value}</p>
    </div>
  ) : null;

function Field({ label, value, onChange, placeholder, textarea }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; textarea?: boolean;
}) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</label>
      {textarea ? (
        <textarea
          className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          rows={3}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function Section({ title, icon, action, children }: {
  title: string; icon: React.ReactNode; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">{icon}{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

const PROJECT_STATUS_OPTIONS = [
  { value: "planning", label: "Pianificazione" },
  { value: "active", label: "Attivo" },
  { value: "review", label: "In revisione" },
  { value: "completed", label: "Completato" },
  { value: "on-hold", label: "In pausa" },
];

const TASK_STATUS_OPTIONS = [
  { value: "todo", label: "Da fare" },
  { value: "in-progress", label: "In corso" },
  { value: "review", label: "In revisione" },
  { value: "done", label: "Completato" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Bassa" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];


export default function ClientDetail({ id }: Props) {
  const LOCAL_CLIENTS_KEY = "agency-local-clients";
  const [, navigate] = useLocation();
  const clientId = parseInt(id, 10);
  const isLocalClient = clientId < 0;
  const localClient = (() => {
    if (!isLocalClient) return null;
    try {
      const parsed = JSON.parse(localStorage.getItem(LOCAL_CLIENTS_KEY) ?? "[]");
      const list = Array.isArray(parsed) ? parsed : [];
      return list.find((c: any) => Number(c.id) === clientId) ?? null;
    } catch {
      return null;
    }
  })();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: client, isLoading } = useGetClient(clientId, {
    query: { queryKey: getGetClientQueryKey(clientId), enabled: !!clientId && !isLocalClient },
  });
  const { data: projects } = useListProjects(
    { clientId },
    { query: { queryKey: getListProjectsQueryKey({ clientId }) } }
  );
  const { data: tasks } = useListTasks(
    {},
    { query: { queryKey: getListTasksQueryKey({}) } }
  );
  const { data: teamMembers } = useListTeamMembers();
  const updateClient = useUpdateClient();
  const createProject = useCreateProject();
  const createTask = useCreateTask();

  const { openDrawer: openAiDrawer } = useAiChat();
  const { clients: contextClients, setActiveClient } = useClientContext();
  const [syncingLocal, setSyncingLocal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [showProjectForm, setShowProjectForm] = useState(false);
  const [projectForm, setProjectForm] = useState({
    name: "", description: "", status: "planning", budget: "",
  });

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: "", description: "", projectId: "", assigneeId: "",
    status: "todo", priority: "medium", dueDate: "",
  });

  const clientProjects = Array.isArray(projects)
    ? projects
    : Array.isArray((projects as any)?.items)
      ? (projects as any).items
      : projects
        ? [projects as any]
        : [];
  const taskList = Array.isArray(tasks)
    ? tasks
    : Array.isArray((tasks as any)?.items)
      ? (tasks as any).items
      : tasks
        ? [tasks as any]
        : [];
  const clientProjectIds = new Set(clientProjects.map((p: any) => p.id));
  const clientTasks = taskList.filter((t: any) => t.projectId != null && clientProjectIds.has(t.projectId));

  // ── Meta assignment (centralized) ──────────────────────────────────────
  type MetaClientStatus = {
    connected: boolean;
    reason?: string;
    tokenExpired?: boolean;
    metaUserName?: string;
    lastSyncedAt?: string | null;
    assignedPage?: any;
    assignedIg?: any;
    assignedAd?: any;
    allPages?: any[];
    allIgAccounts?: any[];
    allAdAccounts?: any[];
  };
  const [metaStatus, setMetaStatus] = useState<MetaClientStatus | null>(null);
  const [metaSyncing, setMetaSyncing] = useState(false);
  const [metaSaving, setMetaSaving] = useState(false);
  const [metaAssign, setMetaAssign] = useState({ pageId: "", igId: "", adId: "" });

  const fetchMetaStatus = useCallback(async () => {
    if (!clientId) return;
    try {
      const d = await portalFetch(`/api/meta/status/${clientId}`).then((r) => r.json());
      setMetaStatus(d);
      setMetaAssign({
        pageId: d.assignedPage?.id ?? "",
        igId: d.assignedIg?.id ?? "",
        adId: d.assignedAd?.id ?? "",
      });
    } catch { setMetaStatus({ connected: false }); }
  }, [clientId]);

  useEffect(() => { fetchMetaStatus(); }, [fetchMetaStatus]);

  const handleMetaSync = async () => {
    setMetaSyncing(true);
    try {
      await portalFetch(`/api/meta/sync/${clientId}`, { method: "POST" });
      await fetchMetaStatus();
    } finally { setMetaSyncing(false); }
  };

  const handleMetaAssignSave = async () => {
    setMetaSaving(true);
    try {
      await portalFetch(`/api/meta/assign/${clientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metaPageId: metaAssign.pageId || null,
          metaIgAccountId: metaAssign.igId || null,
          metaAdAccountId: metaAssign.adId || null,
        }),
      });
      await fetchMetaStatus();
    } finally { setMetaSaving(false); }
  };

  const handleMetaDisconnect = async () => {
    if (!confirm("Rimuovere le assegnazioni Meta per questo cliente?")) return;
    await portalFetch(`/api/meta/disconnect/${clientId}`, { method: "POST" });
    setMetaAssign({ pageId: "", igId: "", adId: "" });
    await fetchMetaStatus();
  };

  // ── Client Reports ─────────────────────────────────────────────────────────
  const [reports, setReports] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [sendingReportId, setSendingReportId] = useState<number | null>(null);
  const [sendModal, setSendModal] = useState<{ report: any; previewHtml?: string } | null>(null);

  const fetchReports = useCallback(async () => {
    if (!clientId) return;
    setReportsLoading(true);
    try {
      const data = await portalFetch(`/api/reports/client/${clientId}`).then((r) => r.json());
      setReports(Array.isArray(data) ? data : []);
    } finally {
      setReportsLoading(false);
    }
  }, [clientId]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!clientId) return;
      portalFetch(`/api/reports/client/${clientId}`).then((r) => r.json()).then((data) => {
        if (Array.isArray(data)) setReports(data);
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [clientId]);

  const handleApproveReport = async (id: number) => {
    const res = await portalFetch(`/api/reports/${id}/approve`, { method: "POST" });
    if (!res.ok) { alert("Errore nell'approvazione"); return; }
    fetchReports();
  };

  const handleRejectReport = async (id: number) => {
    const res = await portalFetch(`/api/reports/${id}/reject`, { method: "POST" });
    if (!res.ok) { alert("Errore nel rifiuto"); return; }
    fetchReports();
  };

  const handleSendReport = async (report: any) => {
    setSendingReportId(report.id);
    try {
      const res = await portalFetch(`/api/reports/${report.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientEmail: report.recipientEmail }),
      });
      const data = await res.json();
      if (data.previewHtml) {
        setSendModal({ report, previewHtml: data.previewHtml });
      } else if (data.sent) {
        fetchReports();
      } else {
        alert(data.error ?? "Errore durante l'invio");
      }
    } finally {
      setSendingReportId(null);
    }
  };

  const handleDeleteReport = async (id: number) => {
    if (!confirm("Eliminare questo report?")) return;
    const res = await portalFetch(`/api/reports/${id}`, { method: "DELETE" });
    if (!res.ok) { alert("Errore nell'eliminazione"); return; }
    fetchReports();
  };

  const syncLocalClientToServer = useCallback(async () => {
    if (!isLocalClient || !localClient) return;
    setSyncingLocal(true);
    try {
      let tags: string[] = [];
      try {
        const parsed = JSON.parse(localClient.tagsJson ?? "[]");
        tags = Array.isArray(parsed) ? parsed : [];
      } catch {
        tags = [];
      }
      const res = await portalFetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: localClient.name,
          nomeCommerciale: localClient.company ?? localClient.name,
          ragioneSociale: localClient.ragioneSociale ?? localClient.name,
          settore: localClient.settore ?? null,
          color: localClient.color ?? "#7a8f5c",
          brandColor: localClient.brandColor ?? localClient.color ?? "#7a8f5c",
          logoUrl: localClient.logoUrl ?? null,
          tags,
        }),
      });
      const rawText = await res.text();
      let created: Record<string, unknown> = {};
      try {
        created = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
      } catch {
        created = { raw: rawText };
      }
      if (!res.ok) {
        alert(
          typeof created.error === "string"
            ? created.error
            : `Sincronizzazione non riuscita (HTTP ${res.status})`,
        );
        return;
      }
      const newId = created.id;
      if (typeof newId !== "number" && typeof newId !== "string") {
        alert("Risposta API non valida.");
        return;
      }
      try {
        const parsed = JSON.parse(localStorage.getItem(LOCAL_CLIENTS_KEY) ?? "[]");
        const list = Array.isArray(parsed) ? parsed : [];
        const next = list.filter((c: { id?: unknown }) => Number(c.id) !== clientId);
        localStorage.setItem(LOCAL_CLIENTS_KEY, JSON.stringify(next));
      } catch {
        /* ignore storage errors */
      }
      navigate(`/clients/${newId}`);
    } finally {
      setSyncingLocal(false);
    }
  }, [isLocalClient, localClient, clientId, navigate, LOCAL_CLIENTS_KEY]);

  const REPORT_STATUS_LABELS: Record<string, string> = {
    bozza: "Bozza",
    in_revisione: "In revisione",
    approvato: "Approvato",
    inviato: "Inviato",
  };
  const REPORT_STATUS_COLORS: Record<string, string> = {
    bozza: "bg-muted text-muted-foreground",
    in_revisione: "bg-amber-100 text-amber-700",
    approvato: "bg-emerald-100 text-emerald-700",
    inviato: "bg-blue-100 text-blue-700",
  };

  const editableClient: any = isLocalClient ? localClient : client;

  const startEditing = () => {
    if (!editableClient) return;
    setForm({
      name: editableClient.name ?? "",
      email: editableClient.email ?? "",
      phone: editableClient.phone ?? "",
      company: editableClient.company ?? "",
      website: editableClient.website ?? "",
      logoUrl: editableClient.logoUrl ?? "",
      color: editableClient.color ?? "#7a8f5c",
      ragioneSociale: editableClient.ragioneSociale ?? "",
      piva: editableClient.piva ?? "",
      codiceFiscale: editableClient.codiceFiscale ?? "",
      indirizzo: editableClient.indirizzo ?? "",
      cap: editableClient.cap ?? "",
      citta: editableClient.citta ?? "",
      provincia: editableClient.provincia ?? "",
      paese: editableClient.paese ?? "Italia",
      notes: editableClient.notes ?? "",
      instagramHandle: editableClient.instagramHandle ?? "",
      metaPageId: editableClient.metaPageId ?? "",
      googleAdsId: editableClient.googleAdsId ?? "",
      driveUrl: editableClient.driveUrl ?? "",
      reportRecipientEmail: editableClient.reportRecipientEmail ?? "",
    });
    setLogoPreview(editableClient.logoUrl ?? null);
    setEditing(true);
  };

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Il file è troppo grande. Massimo 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setLogoPreview(dataUrl);
      setForm((prev) => ({ ...prev, logoUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const saveEditing = () => {
    updateClient.mutate(
      {
        id: clientId,
        data: {
          name: form.name || undefined,
          email: form.email || null,
          phone: form.phone || null,
          company: form.company || null,
          website: form.website || null,
          logoUrl: form.logoUrl || null,
          color: form.color || undefined,
          ragioneSociale: form.ragioneSociale || null,
          piva: form.piva || null,
          codiceFiscale: form.codiceFiscale || null,
          indirizzo: form.indirizzo || null,
          cap: form.cap || null,
          citta: form.citta || null,
          provincia: form.provincia || null,
          paese: form.paese || null,
          notes: form.notes || null,
          instagramHandle: form.instagramHandle || null,
          metaPageId: form.metaPageId || null,
          googleAdsId: form.googleAdsId || null,
          driveUrl: form.driveUrl || null,
          reportRecipientEmail: form.reportRecipientEmail || null,
        } as any,
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetClientQueryKey(clientId) });
          setEditing(false);
          setLogoPreview(null);
        },
      }
    );
  };

  const handleAddProject = () => {
    if (!projectForm.name.trim()) return;
    createProject.mutate(
      {
        data: {
          name: projectForm.name,
          description: projectForm.description || null,
          clientId,
          status: projectForm.status as never,
          budget: projectForm.budget ? Number(projectForm.budget) : null,
          progress: 0,
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListProjectsQueryKey({ clientId }) });
          setProjectForm({ name: "", description: "", status: "planning", budget: "" });
          setShowProjectForm(false);
        },
      }
    );
  };

  const handleAddTask = () => {
    if (!taskForm.title.trim()) return;
    createTask.mutate(
      {
        data: {
          title: taskForm.title,
          description: taskForm.description || null,
          projectId: taskForm.projectId ? Number(taskForm.projectId) : null,
          assigneeId: taskForm.assigneeId ? Number(taskForm.assigneeId) : null,
          status: taskForm.status as never,
          priority: taskForm.priority as never,
          dueDate: taskForm.dueDate || null,
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListTasksQueryKey({}) });
          setTaskForm({ title: "", description: "", projectId: "", assigneeId: "", status: "todo", priority: "medium", dueDate: "" });
          setShowTaskForm(false);
        },
      }
    );
  };

  if (!isLocalClient && isLoading) return <Layout><div className="p-8 text-muted-foreground">Caricamento...</div></Layout>;
  const viewClient: any = isLocalClient ? localClient : client;
  if (!viewClient) return <Layout><div className="p-8 text-muted-foreground">Cliente non trovato</div></Layout>;

  const f = (key: string) => form[key] ?? "";
  const set = (key: string) => (v: string) => setForm((prev) => ({ ...prev, [key]: v }));

  const displayLogo = logoPreview ?? viewClient.logoUrl;

  return (
    <Layout>
      <div className="p-8 max-w-5xl">
        <Link href="/clients">
          <div className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground cursor-pointer mb-6 transition-colors">
            <ChevronLeft size={16} /> Clienti
          </div>
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-5">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center text-white font-bold text-3xl overflow-hidden shrink-0"
              style={{ backgroundColor: displayLogo ? "#f0f2ed" : viewClient.color }}
            >
              {displayLogo ? (
                <img src={displayLogo} alt={viewClient.name} className="w-full h-full object-contain p-1" />
              ) : (
                String(viewClient.name ?? "C").charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{viewClient.name}</h1>
              {viewClient.company && <p className="text-muted-foreground">{viewClient.company}</p>}
              {viewClient.website && (
                <a href={viewClient.website} target="_blank" rel="noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1 mt-0.5">
                  <Globe size={13} /> {viewClient.website}
                </a>
              )}
              <p className="text-xs text-muted-foreground mt-1">Cliente dal {formatDate(viewClient.createdAt)}</p>
              <button
                onClick={() => openAiDrawer({ type: "client", data: { id: clientId, name: viewClient.name, sector: (viewClient as any).sector, activeProjects: clientProjects.length } })}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-violet-50 text-violet-700 rounded-lg hover:bg-violet-100 transition-colors border border-violet-200 mt-2"
              >
                <Sparkles size={12} /> Chiedi all'AI su questo cliente
              </button>
              {isLocalClient && (
                <div className="mt-2 space-y-2 max-w-md">
                  <p className="text-[11px] text-amber-700">
                    Questo record è solo nel browser (salvato senza connessione o da una versione precedente che trattava errori API come offline). Non è sul database finché non lo sincronizzi.
                  </p>
                  <button
                    type="button"
                    onClick={() => void syncLocalClientToServer()}
                    disabled={syncingLocal}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    {syncingLocal ? "Sincronizzazione…" : "Sincronizza sul database"}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            {editing ? (
              <>
                <button
                  onClick={saveEditing}
                  disabled={updateClient.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  <Save size={15} /> {updateClient.isPending ? "Salvataggio..." : "Salva"}
                </button>
                <button
                  onClick={() => { setEditing(false); setLogoPreview(null); }}
                  className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:opacity-80"
                >
                  <X size={15} /> Annulla
                </button>
              </>
            ) : (
              <button
                onClick={startEditing}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
              >
                <Pencil size={15} /> Modifica
              </button>
            )}
          </div>
        </div>

        {/* Edit / View mode */}
        {editing ? (
          <div className="space-y-6 mb-10">
            <Section title="Informazioni Generali" icon={<Building2 size={15} className="text-primary" />}>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Nome *" value={f("name")} onChange={set("name")} placeholder="Nome cliente" />
                <Field label="Azienda" value={f("company")} onChange={set("company")} placeholder="Nome azienda" />
                <Field label="Email" value={f("email")} onChange={set("email")} placeholder="email@example.com" />
                <Field label="Telefono" value={f("phone")} onChange={set("phone")} placeholder="+39 02 ..." />
                <Field label="Sito Web" value={f("website")} onChange={set("website")} placeholder="https://..." />

                {/* Logo upload */}
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Logo Cliente</label>
                  <div className="mt-1 flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-border flex items-center justify-center"
                      style={{ backgroundColor: f("logoUrl") ? "#f0f2ed" : f("color") || "#7a8f5c" }}
                    >
                      {f("logoUrl") ? (
                        <img src={f("logoUrl")} alt="logo" className="w-full h-full object-contain p-1" />
                      ) : (
                        <ImageIcon size={18} className="text-white/70" />
                      )}
                    </div>
                    <div className="flex-1 flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-3 py-1.5 border border-dashed border-primary/40 rounded-lg text-xs text-primary hover:bg-primary/5 transition-colors"
                      >
                        <Upload size={13} /> Carica immagine
                      </button>
                      {f("logoUrl") && (
                        <button
                          type="button"
                          onClick={() => { setLogoPreview(null); setForm((p) => ({ ...p, logoUrl: "" })); }}
                          className="text-xs text-muted-foreground hover:text-destructive text-left"
                        >
                          Rimuovi logo
                        </button>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={handleLogoFile}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">PNG, JPG, SVG — max 2 MB</p>
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Colore Avatar</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="color" value={f("color")} onChange={(e) => set("color")(e.target.value)}
                      className="h-9 w-16 border border-input rounded-lg bg-background cursor-pointer" />
                    <span className="text-xs text-muted-foreground">{f("color")}</span>
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Dati di Fatturazione" icon={<Receipt size={15} className="text-primary" />}>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Ragione Sociale" value={f("ragioneSociale")} onChange={set("ragioneSociale")} placeholder="Ragione sociale" />
                <Field label="Partita IVA" value={f("piva")} onChange={set("piva")} placeholder="IT00000000000" />
                <Field label="Codice Fiscale" value={f("codiceFiscale")} onChange={set("codiceFiscale")} placeholder="Codice fiscale" />
                <Field label="Indirizzo" value={f("indirizzo")} onChange={set("indirizzo")} placeholder="Via Roma 1" />
                <Field label="CAP" value={f("cap")} onChange={set("cap")} placeholder="20121" />
                <Field label="Città" value={f("citta")} onChange={set("citta")} placeholder="Milano" />
                <Field label="Provincia" value={f("provincia")} onChange={set("provincia")} placeholder="MI" />
                <Field label="Paese" value={f("paese")} onChange={set("paese")} placeholder="Italia" />
              </div>
            </Section>

            <Section title="Social & Integrazioni" icon={<Share2 size={15} className="text-primary" />}>
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Instagram Handle"
                  value={f("instagramHandle")}
                  onChange={set("instagramHandle")}
                  placeholder="@nomeaccount"
                />
                <Field
                  label="Meta Page ID"
                  value={f("metaPageId")}
                  onChange={set("metaPageId")}
                  placeholder="ID numerico della pagina Facebook/Meta"
                />
                <Field
                  label="Google Ads Customer ID"
                  value={f("googleAdsId")}
                  onChange={set("googleAdsId")}
                  placeholder="000-000-0000"
                />
                <Field
                  label="Cartella Google Drive (URL)"
                  value={f("driveUrl")}
                  onChange={set("driveUrl")}
                  placeholder="https://drive.google.com/drive/folders/..."
                />
                <Field
                  label="Email per report mensili"
                  value={f("reportRecipientEmail")}
                  onChange={set("reportRecipientEmail")}
                  placeholder="cliente@esempio.com"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">
                Questi dati collegano il cliente ai report mensili e alle integrazioni automatiche.
              </p>
            </Section>

            <Section title="Note" icon={<StickyNote size={15} className="text-primary" />}>
              <Field label="Note interne" value={f("notes")} onChange={set("notes")} placeholder="Annotazioni sul cliente..." textarea />
            </Section>
          </div>
        ) : (
          <div className="space-y-6 mb-10">
            <Section title="Informazioni Generali" icon={<Building2 size={15} className="text-primary" />}>
              <div className="grid grid-cols-3 gap-4">
                {FIELD("Email", viewClient.email)}
                {FIELD("Telefono", viewClient.phone)}
                {FIELD("Azienda", viewClient.company)}
                {FIELD("Sito Web", viewClient.website)}
              </div>
              {!viewClient.email && !viewClient.phone && !viewClient.company && !viewClient.website && (
                <p className="text-sm text-muted-foreground">Nessuna informazione inserita. <button onClick={startEditing} className="text-primary hover:underline">Aggiungi</button></p>
              )}
            </Section>

            {((viewClient as any).ragioneSociale || (viewClient as any).piva || (viewClient as any).codiceFiscale || (viewClient as any).indirizzo) && (
              <Section title="Dati di Fatturazione" icon={<Receipt size={15} className="text-primary" />}>
                <div className="grid grid-cols-3 gap-4">
                  {FIELD("Ragione Sociale", (viewClient as any).ragioneSociale)}
                  {FIELD("Partita IVA", (viewClient as any).piva)}
                  {FIELD("Codice Fiscale", (viewClient as any).codiceFiscale)}
                  {FIELD("Indirizzo", (viewClient as any).indirizzo)}
                  {FIELD("CAP", (viewClient as any).cap)}
                  {FIELD("Città", (viewClient as any).citta)}
                  {FIELD("Provincia", (viewClient as any).provincia)}
                  {FIELD("Paese", (viewClient as any).paese)}
                </div>
              </Section>
            )}

            {((viewClient as any).instagramHandle || (viewClient as any).metaPageId || (viewClient as any).googleAdsId) && (
              <Section title="Social & Integrazioni" icon={<Share2 size={15} className="text-primary" />}>
                <div className="grid grid-cols-3 gap-4">
                  {(viewClient as any).instagramHandle && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Instagram</p>
                      <a
                        href={`https://instagram.com/${(viewClient as any).instagramHandle.replace("@", "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
                      >
                        <ExternalLink size={12} />
                        {(viewClient as any).instagramHandle.startsWith("@") ? (viewClient as any).instagramHandle : `@${(viewClient as any).instagramHandle}`}
                      </a>
                    </div>
                  )}
                  {(viewClient as any).metaPageId && FIELD("Meta Page ID", (viewClient as any).metaPageId)}
                  {(viewClient as any).googleAdsId && FIELD("Google Ads ID", (viewClient as any).googleAdsId)}
                </div>
              </Section>
            )}

            {/* ── Meta — Assegnazione Account ── */}
            <Section
              title="Meta (Facebook & Instagram)"
              icon={<Share2 size={15} className="text-primary" />}
              action={
                metaStatus?.connected && (metaStatus.assignedPage || metaStatus.assignedIg || metaStatus.assignedAd) ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleMetaSync}
                      disabled={metaSyncing}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50"
                    >
                      <RefreshCw size={11} className={metaSyncing ? "animate-spin" : ""} />
                      {metaSyncing ? "Sincronizzazione..." : "Sincronizza dati"}
                    </button>
                    <button
                      onClick={handleMetaDisconnect}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 text-destructive rounded-lg text-xs font-medium hover:opacity-90"
                    >
                      <Link2Off size={11} /> Rimuovi
                    </button>
                  </div>
                ) : null
              }
            >
              {!metaStatus?.connected ? (
                <div className="text-center py-6">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
                    <WifiOff size={20} className="text-blue-400" />
                  </div>
                  <p className="text-sm font-semibold mb-1">Account Meta dell'agenzia non collegato</p>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto mb-3">
                    {metaStatus?.reason === "agency_not_connected"
                      ? "Vai in Impostazioni per collegare l'account Meta dell'agenzia prima di assegnare pagine e account a questo cliente."
                      : "Connessione Meta non disponibile."}
                  </p>
                  <a href="/settings" className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1877F2] text-white rounded-xl text-sm font-semibold hover:opacity-90">
                    <SettingsIcon size={14} /> Vai a Impostazioni
                  </a>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-emerald-600 font-medium">
                      <Wifi size={13} /> Collegato come {metaStatus.metaUserName}
                    </div>
                    {metaStatus.tokenExpired && (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full font-medium">Token scaduto</span>
                    )}
                    {metaStatus.lastSyncedAt && (
                      <span className="text-muted-foreground ml-auto">
                        Ultimo sync: {new Date(metaStatus.lastSyncedAt).toLocaleString("it-IT")}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {/* Pagina Facebook */}
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">Pagina Facebook</label>
                      <select
                        value={metaAssign.pageId}
                        onChange={(e) => setMetaAssign((prev) => ({ ...prev, pageId: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">-- Nessuna pagina assegnata --</option>
                        {(metaStatus.allPages ?? []).map((p: any) => (
                          <option key={p.id} value={p.id}>{p.name} (ID: {p.id})</option>
                        ))}
                      </select>
                    </div>

                    {/* Account Instagram */}
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">Account Instagram Business</label>
                      <select
                        value={metaAssign.igId}
                        onChange={(e) => setMetaAssign((prev) => ({ ...prev, igId: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">-- Nessun account IG assegnato --</option>
                        {(metaStatus.allIgAccounts ?? []).map((ig: any) => (
                          <option key={ig.id} value={ig.id}>@{ig.username} — {ig.followers_count?.toLocaleString("it-IT")} follower</option>
                        ))}
                      </select>
                    </div>

                    {/* Account Ads */}
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">Account Pubblicitario Meta Ads</label>
                      <select
                        value={metaAssign.adId}
                        onChange={(e) => setMetaAssign((prev) => ({ ...prev, adId: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">-- Nessun account Ads assegnato --</option>
                        {(metaStatus.allAdAccounts ?? []).map((ad: any) => (
                          <option key={ad.id} value={ad.id}>{ad.name} ({ad.id} · {ad.currency})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={handleMetaAssignSave}
                      disabled={metaSaving}
                      className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
                    >
                      {metaSaving ? <><RefreshCw size={13} className="animate-spin" /> Salvataggio...</> : <><Save size={13} /> Salva assegnazioni</>}
                    </button>
                    {(metaStatus.allPages?.length === 0 && metaStatus.allIgAccounts?.length === 0 && metaStatus.allAdAccounts?.length === 0) && (
                      <p className="text-xs text-amber-600">Nessuna pagina o account trovato. Vai in Impostazioni per aggiornare.</p>
                    )}
                  </div>

                  {/* Summary of assigned */}
                  {(metaStatus.assignedPage || metaStatus.assignedIg || metaStatus.assignedAd) && (
                    <div className="pt-3 border-t border-card-border space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Account assegnati</p>
                      {metaStatus.assignedPage && (
                        <div className="flex items-center gap-2 p-2.5 bg-blue-50/50 rounded-xl">
                          <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                            <Share2 size={12} className="text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{metaStatus.assignedPage.name}</p>
                            <p className="text-[11px] text-muted-foreground font-mono">Pagina FB · {metaStatus.assignedPage.id}</p>
                          </div>
                        </div>
                      )}
                      {metaStatus.assignedIg && (
                        <div className="flex items-center gap-2 p-2.5 bg-pink-50/50 rounded-xl">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center shrink-0">
                            {metaStatus.assignedIg.profile_picture_url
                              ? <img src={metaStatus.assignedIg.profile_picture_url} alt="" className="w-full h-full rounded-full object-cover" />
                              : <span className="text-white text-[10px] font-bold">{metaStatus.assignedIg.username?.[0]?.toUpperCase()}</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">@{metaStatus.assignedIg.username}</p>
                            <p className="text-[11px] text-muted-foreground">{metaStatus.assignedIg.followers_count?.toLocaleString("it-IT")} follower</p>
                          </div>
                          <a href={`https://instagram.com/${metaStatus.assignedIg.username}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary">
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      )}
                      {metaStatus.assignedAd && (
                        <div className="flex items-center gap-2 p-2.5 bg-amber-50/50 rounded-xl">
                          <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                            <span className="text-amber-700 font-bold text-[10px]">Ads</span>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{metaStatus.assignedAd.name}</p>
                            <p className="text-[11px] text-muted-foreground font-mono">{metaStatus.assignedAd.id} · {metaStatus.assignedAd.currency}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </Section>

            {(viewClient as any).notes && (
              <Section title="Note" icon={<StickyNote size={15} className="text-primary" />}>
                <p className="text-sm whitespace-pre-wrap">{(viewClient as any).notes}</p>
              </Section>
            )}

            <Section title="Brief & Strategia" icon={<BookOpen size={15} className="text-primary" />}>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Il brief operativo e centralizzato in <strong>Strumenti → Brief</strong>, cosi tutta la squadra lavora su un'unica versione sempre aggiornata.
                </p>
                <p className="text-xs text-muted-foreground">
                  Da li puoi incollare il questionario compilato dal cliente, farlo organizzare all'AI e ottenere suggerimenti/strategia migliorata.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const match = contextClients.find((item) => String(item.id) === String(viewClient.id));
                    if (match) setActiveClient(match);
                    navigate("/tools/brief");
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
                >
                  <BookOpen size={13} />
                  Apri Brief in Strumenti
                </button>
              </div>
            </Section>

            {/* ── Google Drive ── */}
            <Section
              title="Google Drive"
              icon={<HardDrive size={15} className="text-primary" />}
              action={
                (viewClient as any).driveUrl ? (
                  <a
                    href={(viewClient as any).driveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90"
                  >
                    <ExternalLink size={11} /> Apri cartella
                  </a>
                ) : null
              }
            >
              {(viewClient as any).driveUrl ? (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <HardDrive size={18} className="text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Cartella Drive collegata</p>
                    <p className="text-xs text-muted-foreground truncate">{(viewClient as any).driveUrl}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <HardDrive size={28} className="mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">Nessuna cartella Drive collegata</p>
                  <button
                    onClick={startEditing}
                    className="text-xs text-primary hover:underline"
                  >
                    Aggiungi URL cartella Drive
                  </button>
                </div>
              )}
            </Section>

            {/* ── Report mensili ── */}
            <Section
              title={`Report Mensili (${reports.length})`}
              icon={<FileText size={15} className="text-primary" />}
              action={
                <button
                  onClick={() => window.location.href = `/reports?client=${clientId}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90"
                >
                  <Zap size={11} /> Genera Report AI
                </button>
              }
            >
              {reportsLoading ? (
                <div className="py-4 text-center text-sm text-muted-foreground">Caricamento...</div>
              ) : reports.length === 0 ? (
                <div className="text-center py-5">
                  <FileText size={28} className="mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground mb-1">Nessun report generato</p>
                  <p className="text-xs text-muted-foreground">Vai alla sezione Report per generare il primo report AI mensile.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {reports.map((report: any) => (
                    <div key={report.id} className="flex items-start gap-3 p-3 bg-muted/40 rounded-xl border border-border/50">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                        report.status === "inviato" ? "bg-blue-100" :
                        report.status === "approvato" ? "bg-emerald-100" :
                        report.status === "in_revisione" ? "bg-amber-100" : "bg-muted"
                      )}>
                        {report.status === "inviato" ? <Send size={14} className="text-blue-600" /> :
                         report.status === "approvato" ? <ThumbsUp size={14} className="text-emerald-600" /> :
                         report.status === "in_revisione" ? <AlertTriangle size={14} className="text-amber-600" /> :
                         <FileText size={14} className="text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-semibold">{report.periodLabel}</p>
                          <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-medium", REPORT_STATUS_COLORS[report.status] ?? "bg-muted text-muted-foreground")}>
                            {REPORT_STATUS_LABELS[report.status] ?? report.status}
                          </span>
                          {report.aiFlag && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-medium flex items-center gap-1">
                              <AlertTriangle size={9} /> Performance basse
                            </span>
                          )}
                        </div>
                        {report.aiSummary && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{report.aiSummary}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {new Date(report.createdAt).toLocaleDateString("it-IT")}
                          {report.recipientEmail && ` · ${report.recipientEmail}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {report.status === "in_revisione" && (
                          <>
                            <button
                              onClick={() => handleApproveReport(report.id)}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-100 text-emerald-700 rounded-lg hover:opacity-90 font-medium"
                            >
                              <ThumbsUp size={11} /> Approva
                            </button>
                            <button
                              onClick={() => handleRejectReport(report.id)}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-muted text-muted-foreground rounded-lg hover:opacity-90"
                            >
                              Rimanda
                            </button>
                          </>
                        )}
                        {(report.status === "approvato" || report.status === "bozza") && (
                          <button
                            onClick={() => handleSendReport(report)}
                            disabled={sendingReportId === report.id}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium disabled:opacity-50"
                          >
                            {sendingReportId === report.id ? <RefreshCw size={11} className="animate-spin" /> : <Send size={11} />}
                            Invia
                          </button>
                        )}
                        {report.status === "inviato" && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <CheckCircle2 size={12} className="text-emerald-500" />
                            {report.sentAt ? new Date(report.sentAt).toLocaleDateString("it-IT") : "Inviato"}
                          </span>
                        )}
                        <button
                          onClick={() => handleDeleteReport(report.id)}
                          className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        )}

        {/* Email preview modal */}
        {sendModal && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setSendModal(null)}>
            <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div>
                  <p className="font-semibold text-sm">Anteprima email</p>
                  <p className="text-xs text-muted-foreground">{sendModal.report.subject}</p>
                </div>
                <button onClick={() => setSendModal(null)} className="p-2 hover:bg-muted rounded-lg"><X size={16} /></button>
              </div>
              <div className="p-4 border-b border-border flex items-center gap-2 text-sm">
                <Mail size={14} className="text-muted-foreground" />
                <span className="text-muted-foreground">A:</span>
                <span className="font-medium">{sendModal.report.recipientEmail}</span>
              </div>
              <div className="flex-1 overflow-auto">
                <div className="p-4 bg-amber-50 border-b border-amber-200">
                  <div className="flex items-center gap-2 text-sm text-amber-700">
                    <AlertTriangle size={14} />
                    <span className="font-medium">Email non configurata</span> — configura SMTP nelle impostazioni per l'invio reale.
                  </div>
                </div>
                <iframe
                  srcDoc={sendModal.previewHtml}
                  className="w-full h-96 border-0"
                  title="Anteprima email"
                />
              </div>
              <div className="flex items-center justify-end gap-3 p-4 border-t border-border">
                <button onClick={() => setSendModal(null)} className="px-4 py-2 text-sm rounded-lg border border-input hover:bg-muted">Chiudi</button>
              </div>
            </div>
          </div>
        )}

        {/* PROGETTI */}
        <Section
          title={`Progetti (${clientProjects.length})`}
          icon={<FolderKanban size={15} className="text-primary" />}
          action={
            <button
              onClick={() => setShowProjectForm(!showProjectForm)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90"
            >
              <Plus size={13} /> Nuovo Progetto
            </button>
          }
        >
          {showProjectForm && (
            <div className="bg-muted/50 border border-border rounded-xl p-4 mb-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nome *" value={projectForm.name} onChange={(v) => setProjectForm((p) => ({ ...p, name: v }))} placeholder="Nome progetto" />
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Stato</label>
                  <select
                    className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    value={projectForm.status}
                    onChange={(e) => setProjectForm((p) => ({ ...p, status: e.target.value }))}
                  >
                    {PROJECT_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <Field label="Descrizione" value={projectForm.description} onChange={(v) => setProjectForm((p) => ({ ...p, description: v }))} placeholder="Descrizione breve" />
                <Field label="Budget (€)" value={projectForm.budget} onChange={(v) => setProjectForm((p) => ({ ...p, budget: v }))} placeholder="0" />
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={handleAddProject} disabled={createProject.isPending}
                  className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                  {createProject.isPending ? "Salvataggio..." : "Crea Progetto"}
                </button>
                <button onClick={() => setShowProjectForm(false)}
                  className="px-4 py-1.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:opacity-80">
                  Annulla
                </button>
              </div>
            </div>
          )}

          {clientProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun progetto associato.</p>
          ) : (
            <div className="grid gap-3">
              {clientProjects.map((p: any) => (
                <Link key={p.id} href={`/projects/${p.id}`}>
                  <div className="bg-background border border-border rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-sm">{p.name}</p>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_COLORS[p.status])}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </span>
                    </div>
                    {p.description && <p className="text-xs text-muted-foreground mb-3">{p.description}</p>}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${p.progress}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{p.progress}%</span>
                    </div>
                    {p.budget != null && (
                      <p className="text-xs text-muted-foreground mt-2">Budget: €{p.budget.toLocaleString("it-IT")}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Section>

        {/* TASK */}
        <div className="mt-6">
          <Section
            title={`Task (${clientTasks.length})`}
            icon={<CheckSquare size={15} className="text-primary" />}
            action={
              <button
                onClick={() => setShowTaskForm(!showTaskForm)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90"
              >
                <Plus size={13} /> Nuovo Task
              </button>
            }
          >
            {showTaskForm && (
              <div className="bg-muted/50 border border-border rounded-xl p-4 mb-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Titolo *" value={taskForm.title} onChange={(v) => setTaskForm((t) => ({ ...t, title: v }))} placeholder="Titolo task" />
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Progetto</label>
                    <select
                      className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none"
                      value={taskForm.projectId}
                      onChange={(e) => setTaskForm((t) => ({ ...t, projectId: e.target.value }))}
                    >
                      <option value="">Nessun progetto</option>
                      {clientProjects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Stato</label>
                    <select
                      className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none"
                      value={taskForm.status}
                      onChange={(e) => setTaskForm((t) => ({ ...t, status: e.target.value }))}
                    >
                      {TASK_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Priorità</label>
                    <select
                      className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none"
                      value={taskForm.priority}
                      onChange={(e) => setTaskForm((t) => ({ ...t, priority: e.target.value }))}
                    >
                      {PRIORITY_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Assegna a</label>
                    <select
                      className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none"
                      value={taskForm.assigneeId}
                      onChange={(e) => setTaskForm((t) => ({ ...t, assigneeId: e.target.value }))}
                    >
                      <option value="">Nessuno</option>
                      {(teamMembers ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Scadenza</label>
                    <input type="date" className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none"
                      value={taskForm.dueDate}
                      onChange={(e) => setTaskForm((t) => ({ ...t, dueDate: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={handleAddTask} disabled={createTask.isPending}
                    className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                    {createTask.isPending ? "Salvataggio..." : "Crea Task"}
                  </button>
                  <button onClick={() => setShowTaskForm(false)}
                    className="px-4 py-1.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:opacity-80">
                    Annulla
                  </button>
                </div>
              </div>
            )}

            {clientTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun task per questo cliente.</p>
            ) : (
              <div className="space-y-2">
                {clientTasks.map((t: any) => (
                  <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background">
                    <div className={cn(
                      "w-4 h-4 rounded-full border-2 shrink-0",
                      t.status === "done" ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground"
                    )} />
                    <p className={cn("flex-1 text-sm", t.status === "done" && "line-through text-muted-foreground")}>{t.title}</p>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", PRIORITY_COLORS[t.priority])}>{PRIORITY_LABELS[t.priority]}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", TASK_STATUS_COLORS[t.status])}>{TASK_STATUS_LABELS[t.status]}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </Layout>
  );
}
