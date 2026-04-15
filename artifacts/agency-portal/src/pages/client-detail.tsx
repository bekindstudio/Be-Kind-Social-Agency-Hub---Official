import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import {
  portalFetch,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { ClientDetailHeader } from "@/components/client/ClientDetailHeader";
import { ClientMetaSection } from "@/components/client/ClientMetaSection";
import { ClientReportsSection } from "@/components/client/ClientReportsSection";
import { ClientProjectsSection } from "@/components/client/ClientProjectsSection";
import { useClientDetail } from "@/hooks/useClientDetail";
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
  const [, navigate] = useLocation();
  const clientId = parseInt(id, 10);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    client,
    isLoading,
    projects,
    tasks,
    teamMembers,
    updateClient,
    createProject,
    createTask,
    invalidateClient,
    invalidateProjects,
    invalidateTasks,
  } = useClientDetail(clientId);

  const { openDrawer: openAiDrawer } = useAiChat();
  const { clients: contextClients, setActiveClient } = useClientContext();
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

  const editableClient: any = client;

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
          invalidateClient();
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
          invalidateProjects();
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
          invalidateTasks();
          setTaskForm({ title: "", description: "", projectId: "", assigneeId: "", status: "todo", priority: "medium", dueDate: "" });
          setShowTaskForm(false);
        },
      }
    );
  };

  if (isLoading) return <Layout><div className="p-8 text-muted-foreground">Caricamento...</div></Layout>;
  const viewClient: any = client;
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

        <ClientDetailHeader
          clientId={clientId}
          viewClient={{
            ...viewClient,
            sector: (viewClient as any).sector,
          }}
          displayLogo={displayLogo}
          clientProjectsCount={clientProjects.length}
          editing={editing}
          isSaving={updateClient.isPending}
          onOpenAi={(payload) => openAiDrawer({ type: "client", data: payload })}
          onSave={saveEditing}
          onCancel={() => {
            setEditing(false);
            setLogoPreview(null);
          }}
          onStartEdit={startEditing}
        />

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

            <ClientMetaSection
              Section={Section}
              metaStatus={metaStatus}
              handleMetaSync={handleMetaSync}
              metaSyncing={metaSyncing}
              handleMetaDisconnect={handleMetaDisconnect}
              metaAssign={metaAssign}
              setMetaAssign={setMetaAssign}
              handleMetaAssignSave={handleMetaAssignSave}
              metaSaving={metaSaving}
            />

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

            <ClientReportsSection
              Section={Section}
              reports={reports}
              clientId={clientId}
              reportsLoading={reportsLoading}
              REPORT_STATUS_COLORS={REPORT_STATUS_COLORS}
              REPORT_STATUS_LABELS={REPORT_STATUS_LABELS}
              handleApproveReport={handleApproveReport}
              handleRejectReport={handleRejectReport}
              handleSendReport={handleSendReport}
              sendingReportId={sendingReportId}
              handleDeleteReport={handleDeleteReport}
            />
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

        <ClientProjectsSection
          Section={Section}
          Field={Field}
          clientProjects={clientProjects}
          showProjectForm={showProjectForm}
          setShowProjectForm={setShowProjectForm}
          projectForm={projectForm}
          setProjectForm={setProjectForm}
          PROJECT_STATUS_OPTIONS={PROJECT_STATUS_OPTIONS}
          handleAddProject={handleAddProject}
          createProject={createProject}
          clientTasks={clientTasks}
          showTaskForm={showTaskForm}
          setShowTaskForm={setShowTaskForm}
          taskForm={taskForm}
          setTaskForm={setTaskForm}
          TASK_STATUS_OPTIONS={TASK_STATUS_OPTIONS}
          PRIORITY_OPTIONS={PRIORITY_OPTIONS}
          teamMembers={teamMembers}
          handleAddTask={handleAddTask}
          createTask={createTask}
        />
      </div>
    </Layout>
  );
}
