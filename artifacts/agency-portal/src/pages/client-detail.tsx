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
import { ContentIdeasBank } from "@/components/client/ContentIdeasBank";
import { useClientDetail } from "@/hooks/useClientDetail";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft,
  ChevronRight,
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
  CalendarDays,
  BarChart3,
  Layers,
  FolderOpen,
  Lightbulb,
  Pin,
  PinOff,
  MoreHorizontal,
  ChevronDown,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BRIEF_SECTIONS } from "@/lib/briefSchema";
import { cn, STATUS_LABELS, STATUS_COLORS, TASK_STATUS_LABELS, TASK_STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS, formatDate } from "@/lib/utils";
import { apiErrorDetail } from "@/lib/apiError";
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

const SERVICE_TYPES = ["Social", "Meta Ads", "Google Ads", "Web", "Branding", "Email Marketing"];

/* ─── Tabs del cockpit cliente ─────────────────────────────────────────── */
type TabKey = "panoramica" | "progetti" | "brief" | "editoriale" | "eventi" | "report" | "file" | "idee" | "banca" | "meta";
const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: "panoramica", label: "Panoramica", icon: Layers },
  { key: "progetti", label: "Progetti & Task", icon: FolderKanban },
  { key: "brief", label: "Brief", icon: BookOpen },
  { key: "editoriale", label: "Editoriale", icon: CalendarDays },
  { key: "eventi", label: "Eventi", icon: CalendarDays },
  { key: "report", label: "Report", icon: BarChart3 },
  { key: "file", label: "File", icon: FolderOpen },
  // "idee" = note testuali libere (client_notes): rinominata "Note rapide" per
  // non confonderla con la Banca Idee (link salvati, condivisa col cliente).
  // La key resta "idee" così i deep link ?tab=idee esistenti continuano a valere.
  { key: "idee", label: "Note rapide", icon: StickyNote },
  { key: "banca", label: "Banca Idee", icon: Lightbulb },
  { key: "meta", label: "Meta", icon: Share2 },
];

// Wave BI: tab raggruppate per ridurre l'affollamento. Le 4 più usate
// sempre visibili, le altre 5 dietro un dropdown "Altro". Su mobile la
// scrollbar orizzontale resta su tutte (il dropdown non aggiunge valore
// quando lo schermo è già stretto).
const PRIMARY_TAB_KEYS: TabKey[] = ["panoramica", "progetti", "brief", "editoriale"];

function CockpitTabs({ active, onChange }: { active: TabKey; onChange: (k: TabKey) => void }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const primaryTabs = TABS.filter((t) => PRIMARY_TAB_KEYS.includes(t.key));
  const secondaryTabs = TABS.filter((t) => !PRIMARY_TAB_KEYS.includes(t.key));
  const activeInSecondary = secondaryTabs.find((t) => t.key === active);

  return (
    <div className="sticky top-0 z-30 -mx-4 px-4 md:-mx-8 md:px-8 pt-1 pb-0 bg-background/95 backdrop-blur border-b border-card-border mb-6">
      {/* Mobile: scroll orizzontale di TUTTE le tab (più diretto su schermo stretto) */}
      <div className="md:hidden flex gap-1 overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = active === t.key;
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                on ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Desktop (md+): 4 tab principali + dropdown "Altro" per le rimanenti */}
      <div className="hidden md:flex gap-1 items-center">
        {primaryTabs.map((t) => {
          const Icon = t.icon;
          const on = active === t.key;
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                on ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
        <div ref={moreRef} className="relative ml-auto">
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              activeInSecondary
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            title="Altre tab"
          >
            {activeInSecondary ? (
              <>
                <activeInSecondary.icon size={15} />
                {activeInSecondary.label}
              </>
            ) : (
              <>
                <MoreHorizontal size={15} />
                Altro
              </>
            )}
            <ChevronDown size={13} className={cn("transition-transform", moreOpen && "rotate-180")} />
          </button>
          {moreOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-card-border bg-card shadow-lg z-40 p-1">
              {secondaryTabs.map((t) => {
                const Icon = t.icon;
                const on = active === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => {
                      onChange(t.key);
                      setMoreOpen(false);
                    }}
                    className={cn(
                      "w-full inline-flex items-center gap-2 px-2.5 py-2 text-sm rounded-md transition-colors text-left",
                      on ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted",
                    )}
                  >
                    <Icon size={14} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Tab Brief (riassunto + preview sezioni + apertura) ───────────────── */
function BriefTab({ clientId, onOpen }: { clientId: number; onOpen: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["client-brief", clientId],
    queryFn: async () => {
      const r = await portalFetch(`/api/clients/${clientId}/brief`, { credentials: "include" });
      if (!r.ok) return null;
      return r.json();
    },
    staleTime: 30_000,
  });

  // Parse il parsedJson salvato
  let parsed: Record<string, Record<string, unknown>> = {};
  if (data?.parsedJson) {
    try {
      const p = JSON.parse(data.parsedJson);
      if (p && typeof p === "object") parsed = p;
    } catch { /* ignore */ }
  }

  // Totale = solo i campi noti dello schema (non i campi orfani nel DB)
  const total = BRIEF_SECTIONS.reduce((acc, s) => acc + s.fields.length, 0);
  const sectionStats = BRIEF_SECTIONS.map((s) => {
    const sec = parsed[s.key] ?? {};
    const sectionFilled = s.fields.reduce((acc, f) => {
      const v = sec[f.key];
      return acc + (typeof v === "string" && v.trim() ? 1 : 0);
    }, 0);
    return { key: s.key, label: s.label, icon: s.icon, filled: sectionFilled, totalSection: s.fields.length };
  });
  const filled = sectionStats.reduce((acc, s) => acc + s.filled, 0);
  const pct = total ? Math.round((filled / total) * 100) : 0;
  const isEmpty = filled === 0;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-card-border bg-card p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="font-semibold text-sm flex items-center gap-2"><BookOpen size={15} className="text-primary" /> Brief cliente</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Compilazione e PDF nella pagina Brief.</p>
          </div>
          <button onClick={onOpen} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 shrink-0">
            Apri Brief <ExternalLink size={12} />
          </button>
        </div>
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Caricamento…</p>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Completamento</span>
              <span className="font-semibold text-foreground">{pct}% · {filled}/{total} campi</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
          </>
        )}
      </div>

      {!isLoading && (
        isEmpty ? (
          <div className="rounded-xl border border-dashed border-card-border bg-card p-8 text-center">
            <BookOpen size={28} className="mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm font-medium">Brief ancora vuoto</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">Apri il Brief per iniziare a compilare le sezioni.</p>
            <button onClick={onOpen} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90">
              <BookOpen size={13} /> Compila il brief
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-card-border bg-card p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Stato sezioni</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {sectionStats.map((s) => {
                const Icon = s.icon;
                const done = s.filled === s.totalSection;
                const some = s.filled > 0 && !done;
                return (
                  <div key={s.key} className="flex items-center gap-2.5 rounded-lg border border-card-border/60 p-2.5">
                    <span className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                      done ? "bg-emerald-100 text-emerald-700" : some ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"
                    )}>
                      <Icon size={13} />
                    </span>
                    <span className="text-sm flex-1 truncate">{s.label}</span>
                    <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">{s.filled}/{s.totalSection}</span>
                    {done && <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}
    </div>
  );
}

/* ─── Tab Eventi (lista compatta) ──────────────────────────────────────── */
function EventsTab({ clientId, onOpen }: { clientId: number; onOpen: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["client-events", clientId],
    queryFn: async () => {
      const r = await portalFetch(`/api/clients/${clientId}/events`, { credentials: "include" });
      if (!r.ok) return [] as any[];
      return r.json();
    },
    staleTime: 30_000,
  });
  const events = Array.isArray(data) ? data : [];
  const upcoming = events
    .filter((e) => new Date(e.date).getTime() >= Date.now() - 24 * 3600 * 1000)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 8);
  return (
    <div className="rounded-xl border border-card-border bg-card p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <h2 className="font-semibold text-sm flex items-center gap-2"><CalendarDays size={15} className="text-primary" /> Eventi cliente</h2>
        <button onClick={onOpen} className="inline-flex items-center gap-1.5 rounded-lg border border-input px-2.5 py-1.5 text-xs font-medium hover:bg-muted">
          Gestisci eventi <ExternalLink size={12} />
        </button>
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Caricamento…</p>
      ) : upcoming.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Nessun evento in programma.</p>
      ) : (
        <div className="space-y-2">
          {upcoming.map((e: any) => (
            <div key={e.id} className="flex items-start gap-3 rounded-lg border border-card-border/60 p-2.5">
              <CalendarDays size={14} className="text-primary mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{e.title}</p>
                <p className="text-xs text-muted-foreground">{formatDate(e.date)}{e.endDate ? ` → ${formatDate(e.endDate)}` : ""}</p>
              </div>
              <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 shrink-0">{e.type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Tab Editoriale: piani del cliente + accesso al costruttore ────────── */
const EDIT_PLAN_MESI = ["", "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
const EDIT_PLAN_STATUS: Record<string, { label: string; color: string }> = {
  bozza: { label: "Bozza", color: "bg-muted text-muted-foreground" },
  in_revisione: { label: "In revisione", color: "bg-amber-100 text-amber-700" },
  approvato: { label: "Approvato", color: "bg-emerald-100 text-emerald-700" },
  inviato: { label: "Inviato al cliente", color: "bg-blue-100 text-blue-700" },
  confermato_cliente: { label: "Confermato", color: "bg-teal-100 text-teal-700" },
};

function EditorialTab({ clientId, onOpenCalendar }: { clientId: number; onOpenCalendar: () => void }) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ["editorial-plans", clientId],
    staleTime: 30_000,
    queryFn: async () => {
      // La lista non ha filtro ?clientId lato API: prendo tutti i piani accessibili
      // e filtro sul cliente corrente.
      const r = await portalFetch("/api/editorial-plans");
      if (!r.ok) throw new Error(await apiErrorDetail(r));
      const all = await r.json();
      return Array.isArray(all) ? all.filter((p) => Number(p.clientId) === clientId) : [];
    },
  });
  const plans = data ?? [];

  const handleCreate = async () => {
    if (creating) return;
    const now = new Date();
    setCreating(true);
    try {
      const r = await portalFetch("/api/editorial-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, month: now.getMonth() + 1, year: now.getFullYear() }),
      });
      if (!r.ok) { toast({ variant: "destructive", title: "Creazione piano non riuscita", description: await apiErrorDetail(r) }); return; }
      const created = await r.json();
      navigate(`/tools/piano-editoriale/${created.id}`);
    } catch {
      toast({ variant: "destructive", title: "Errore di rete" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-card-border bg-card p-4 md:p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-semibold text-sm flex items-center gap-2"><CalendarDays size={15} className="text-primary" /> Piano editoriale</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Crea e apri i piani mensili dei contenuti di questo cliente.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onOpenCalendar} className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-xs font-medium hover:bg-muted">
              Calendario <ExternalLink size={12} />
            </button>
            <button onClick={() => void handleCreate()} disabled={creating} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
              <Plus size={13} /> {creating ? "Creo…" : "Nuovo piano"}
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Caricamento…</p>
      ) : plans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-card-border p-8 text-center">
          <CalendarDays size={20} className="mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nessun piano editoriale per questo cliente. Crea il primo con "Nuovo piano".</p>
        </div>
      ) : (
        <div className="space-y-2">
          {plans.map((p) => {
            const st = EDIT_PLAN_STATUS[p.status] ?? { label: p.status, color: "bg-muted text-muted-foreground" };
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => navigate(`/tools/piano-editoriale/${p.id}`)}
                className="w-full text-left rounded-xl border border-card-border bg-card p-3 hover:shadow-sm transition-shadow flex items-center gap-3"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CalendarDays size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{EDIT_PLAN_MESI[p.month] ?? p.month} {p.year}</p>
                  <p className="text-xs text-muted-foreground">{p.totalSlots ?? 0} {(p.totalSlots ?? 0) === 1 ? "contenuto" : "contenuti"}</p>
                </div>
                <span className={cn("text-[11px] rounded-full px-2 py-0.5 shrink-0", st.color)}>{st.label}</span>
                <ChevronRight size={15} className="text-muted-foreground shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Drive panel: collegamento OAuth + create folder + list + email cliente ── */
function DrivePanel({ clientId, clientName, driveUrl, clientEmail, onRefresh }: {
  clientId: number;
  clientName: string;
  driveUrl: string | null;
  clientEmail: string | null;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const { data: status } = useQuery<any>({
    queryKey: ["google-drive-status"],
    queryFn: async () => {
      const r = await portalFetch("/api/google/status");
      return r.ok ? r.json() : { connected: false };
    },
    staleTime: 60_000,
  });
  const { data: listData, isLoading: listLoading, refetch: refetchList } = useQuery<any>({
    queryKey: ["client-drive-list", clientId, driveUrl],
    enabled: Boolean(driveUrl && status?.connected),
    queryFn: async () => {
      const r = await portalFetch(`/api/clients/${clientId}/drive/list`, { credentials: "include" });
      return r.ok ? r.json() : { files: [] };
    },
    staleTime: 30_000,
  });

  const [creating, setCreating] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState(clientEmail ?? "");
  const [emailNote, setEmailNote] = useState("");
  const [emailSending, setEmailSending] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const r = await portalFetch(`/api/clients/${clientId}/drive/create-folder`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!r.ok) {
        toast({ variant: "destructive", title: "Errore creazione cartella", description: await apiErrorDetail(r) });
        return;
      }
      const data = await r.json().catch(() => ({}));
      toast({ title: "Cartella Drive creata", description: data.folderName });
      onRefresh();
      void refetchList();
    } catch {
      // Prima un errore di rete lasciava solo lo spinner che si spegneva.
      toast({ variant: "destructive", title: "Errore di rete", description: "Cartella non creata. Riprova." });
    } finally {
      setCreating(false);
    }
  };

  const handleSendEmail = async () => {
    setEmailSending(true);
    try {
      const r = await portalFetch(`/api/clients/${clientId}/drive/email-invite`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: emailTo.trim(), message: emailNote.trim() }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast({
          variant: "destructive",
          title: "Email non inviata",
          description: data?.message ?? data?.error ?? "Verifica SMTP e indirizzo",
        });
        return;
      }
      toast({ title: "Email inviata", description: emailTo });
      setEmailOpen(false);
      setEmailNote("");
    } finally {
      setEmailSending(false);
    }
  };

  const files = Array.isArray(listData?.files) ? listData.files : [];

  return (
    <div className="space-y-3">
      {!status?.connected && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-center gap-2">
          <HardDrive size={14} />
          <span>Google Drive agenzia non collegato. Vai in <a href="/settings" className="font-semibold underline">Impostazioni</a> per attivarlo.</span>
        </div>
      )}

      {driveUrl ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-3">
            <HardDrive size={18} className="text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">Cartella Drive collegata</p>
              <p className="text-xs text-muted-foreground truncate">{driveUrl}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <a href={driveUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-primary text-primary-foreground px-2.5 py-1.5 text-xs font-semibold hover:opacity-90">
                <ExternalLink size={12} /> Apri
              </a>
              <button
                onClick={() => setEmailOpen(true)}
                disabled={!driveUrl}
                className="inline-flex items-center gap-1 rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs hover:bg-muted"
                title="Manda email al cliente con il link"
              >
                <FileText size={12} /> Manda al cliente
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-card-border p-4">
          <div className="flex items-center gap-3">
            <HardDrive size={18} className="text-muted-foreground shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">Nessuna cartella Drive per questo cliente</p>
              <p className="text-xs text-muted-foreground">
                {status?.connected
                  ? `Creiamo "${clientName} — ${new Date().getFullYear()}" sotto la radice agenzia.`
                  : "Collega Google Drive in Impostazioni per poter creare la cartella in un click."}
              </p>
            </div>
            <button
              onClick={handleCreate}
              disabled={!status?.connected || creating}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 shrink-0"
            >
              {creating ? "Creo…" : "Crea cartella"}
            </button>
          </div>
        </div>
      )}

      {emailOpen && (
        <div className="rounded-xl border border-card-border bg-card p-4 space-y-2">
          <p className="text-xs font-semibold">Manda link Drive al cliente</p>
          <input
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
            placeholder="email destinatario"
            className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background"
          />
          <textarea
            value={emailNote}
            onChange={(e) => setEmailNote(e.target.value)}
            placeholder="Messaggio (opzionale)"
            rows={2}
            className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background resize-none"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleSendEmail}
              disabled={emailSending || !emailTo.trim()}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {emailSending ? "Invio…" : "Manda email"}
            </button>
            <button onClick={() => setEmailOpen(false)} className="text-xs text-muted-foreground hover:underline">Annulla</button>
          </div>
        </div>
      )}

      {driveUrl && status?.connected && (
        <div className="rounded-xl border border-card-border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold flex items-center gap-1.5"><FolderOpen size={13} /> File nella cartella Drive</p>
            <button onClick={() => void refetchList()} className="text-[11px] text-muted-foreground hover:text-primary">Aggiorna</button>
          </div>
          {listLoading ? (
            <p className="text-xs text-muted-foreground py-2">Caricamento…</p>
          ) : files.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3 text-center">Nessun file ancora. Carica direttamente da Drive.</p>
          ) : (
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {files.map((f: any) => (
                <a key={f.id} href={f.webViewLink} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-muted/50 text-xs">
                  {f.iconLink ? <img src={f.iconLink} alt="" className="w-4 h-4" /> : <FileText size={13} />}
                  <span className="truncate flex-1">{f.name}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString("it-IT") : ""}
                  </span>
                </a>
              ))}
            </div>
          )}
          {listData?.warning && (
            <p className="mt-2 text-[10px] text-amber-700">
              Nota: lo scope <code>drive.file</code> mostra solo file creati dall'app o caricati con accesso esplicito. Se la cartella è stata creata altrove, dovrai ricrearla dal portale per vederne il contenuto.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Tab Idee/Note: card libere per cliente ────────────────────────── */
type ClientNoteRow = {
  id: number;
  clientId: number;
  content: string;
  color: string;
  pinned: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

const NOTE_COLORS = [
  { value: "#fef3c7", label: "Giallo" },
  { value: "#dbeafe", label: "Blu" },
  { value: "#dcfce7", label: "Verde" },
  { value: "#fce7f3", label: "Rosa" },
  { value: "#f3e8ff", label: "Viola" },
  { value: "#fed7aa", label: "Arancio" },
  { value: "#e0e7ff", label: "Indaco" },
];

function ClientNotesTab({ clientId }: { clientId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: notes, isLoading } = useQuery<ClientNoteRow[]>({
    queryKey: ["client-notes", clientId],
    queryFn: async () => {
      const r = await portalFetch(`/api/clients/${clientId}/notes`);
      if (!r.ok) throw new Error("notes load failed");
      const j = await r.json();
      return Array.isArray(j) ? j : [];
    },
    staleTime: 30_000,
  });
  const list = notes ?? [];
  const [draft, setDraft] = useState("");
  const [draftColor, setDraftColor] = useState(NOTE_COLORS[0].value);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState("");

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["client-notes", clientId] });

  const handleAdd = async () => {
    if (!draft.trim() || saving) return;
    setSaving(true);
    try {
      const r = await portalFetch(`/api/clients/${clientId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft.trim(), color: draftColor }),
      });
      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        toast({ variant: "destructive", title: "Salvataggio nota non riuscito", description: txt.slice(0, 200) });
        return;
      }
      setDraft("");
      refresh();
    } finally { setSaving(false); }
  };

  const handleTogglePin = async (n: ClientNoteRow) => {
    const r = await portalFetch(`/api/clients/${clientId}/notes/${n.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !n.pinned }),
    });
    if (r.ok) refresh();
    else toast({ variant: "destructive", title: "Operazione non riuscita", description: await apiErrorDetail(r) });
  };

  const handleDelete = async (n: ClientNoteRow) => {
    if (!confirm("Eliminare questa nota?")) return;
    const r = await portalFetch(`/api/clients/${clientId}/notes/${n.id}`, { method: "DELETE" });
    if (r.ok || r.status === 204) {
      toast({ title: "Nota eliminata" });
      refresh();
    } else {
      toast({ variant: "destructive", title: "Eliminazione non riuscita", description: await apiErrorDetail(r) });
    }
  };

  const handleSaveEdit = async (n: ClientNoteRow) => {
    if (!editingContent.trim()) return;
    const r = await portalFetch(`/api/clients/${clientId}/notes/${n.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editingContent.trim() }),
    });
    if (r.ok) {
      setEditingId(null);
      setEditingContent("");
      refresh();
    } else {
      toast({ variant: "destructive", title: "Salvataggio non riuscito", description: await apiErrorDetail(r) });
    }
  };

  return (
    <div className="space-y-4">
      {/* Form add nuova nota */}
      <div className="bg-card border border-card-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
            <Lightbulb size={17} className="text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Appunta un'idea</h3>
            <p className="text-[11px] text-muted-foreground">Note libere per il cliente: idee per contenuti, telefonate, promemoria…</p>
          </div>
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Es. Fare reel con backstage del lancio prodotto · Telefonare entro venerdì · Provare a proporre webinar a settembre…"
          rows={3}
          className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void handleAdd();
            }
          }}
        />
        <div className="mt-2 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1">
            {NOTE_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setDraftColor(c.value)}
                title={c.label}
                aria-label={`Colore ${c.label}`}
                className={cn(
                  "w-6 h-6 rounded-full border transition-all",
                  draftColor === c.value ? "border-foreground scale-110" : "border-card-border hover:scale-105"
                )}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground hidden sm:inline">⌘+Enter</span>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!draft.trim() || saving}
              className="px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg disabled:opacity-50 hover:opacity-90"
            >
              {saving ? "Salvo…" : "Aggiungi"}
            </button>
          </div>
        </div>
      </div>

      {/* Lista note */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground text-center py-6">Caricamento…</p>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-card-border p-8 text-center">
          <Lightbulb size={28} className="mx-auto text-muted-foreground/60 mb-2" />
          <p className="text-sm font-medium">Nessuna idea ancora</p>
          <p className="text-xs text-muted-foreground mt-1">Aggiungi la prima sopra ↑</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {list.map((n) => (
            <div
              key={n.id}
              className="rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-2 group"
              style={{ backgroundColor: n.color }}
            >
              {editingId === n.id ? (
                <>
                  <textarea
                    autoFocus
                    value={editingContent}
                    onChange={(e) => setEditingContent(e.target.value)}
                    rows={4}
                    className="w-full px-2 py-1 text-sm border border-foreground/20 rounded bg-white/70 resize-none"
                  />
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => { setEditingId(null); setEditingContent(""); }} className="text-[11px] px-2 py-1 rounded hover:bg-white/50">Annulla</button>
                    <button onClick={() => handleSaveEdit(n)} disabled={!editingContent.trim()} className="text-[11px] px-2 py-1 rounded bg-foreground text-background disabled:opacity-50">Salva</button>
                  </div>
                </>
              ) : (
                <>
                  <p
                    className="text-sm text-foreground/90 whitespace-pre-wrap break-words cursor-text leading-snug"
                    onClick={() => { setEditingId(n.id); setEditingContent(n.content); }}
                  >
                    {n.content}
                  </p>
                  <div className="flex items-center justify-between gap-1 mt-auto pt-1 border-t border-foreground/10">
                    <span className="text-[10px] text-foreground/60 tabular-nums">
                      {n.createdAt ? new Date(n.createdAt).toLocaleDateString("it-IT", { day: "2-digit", month: "short" }) : ""}
                    </span>
                    <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleTogglePin(n)}
                        title={n.pinned ? "Rimuovi dal top" : "Fissa in alto"}
                        aria-label={n.pinned ? "Rimuovi dal top" : "Fissa in alto"}
                        className="p-1 rounded hover:bg-white/40"
                      >
                        {n.pinned ? <Pin size={12} className="text-amber-700" /> : <PinOff size={12} className="text-foreground/60" />}
                      </button>
                      <button
                        onClick={() => handleDelete(n)}
                        title="Elimina"
                        aria-label="Elimina nota"
                        className="p-1 rounded hover:bg-white/40 text-foreground/60 hover:text-destructive"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Tab File (drive + lista upload portale) ──────────────────────────── */
function FilesTab({ clientId, clientName, driveUrl, clientEmail, onRefresh }: {
  clientId: number;
  clientName: string;
  driveUrl: string | null;
  clientEmail: string | null;
  onRefresh: () => void;
}) {
  const { data: projData } = useQuery({
    queryKey: ["client-projects-light", clientId],
    queryFn: async () => {
      const r = await portalFetch(`/api/projects?clientId=${clientId}`, { credentials: "include" });
      if (!r.ok) return [] as any[];
      return r.json();
    },
    staleTime: 60_000,
  });
  const projectIds = (Array.isArray(projData) ? projData : []).map((p: any) => p.id);
  const { data: filesData, isLoading } = useQuery({
    queryKey: ["client-files", clientId, projectIds.length],
    enabled: projectIds.length > 0,
    queryFn: async () => {
      const all: any[] = [];
      for (const pid of projectIds) {
        const r = await portalFetch(`/api/files?projectId=${pid}`, { credentials: "include" });
        if (r.ok) {
          const arr = await r.json();
          if (Array.isArray(arr)) all.push(...arr);
        }
      }
      return all;
    },
    staleTime: 30_000,
  });
  const files = Array.isArray(filesData) ? filesData : [];
  return (
    <div className="space-y-4">
      <DrivePanel
        clientId={clientId}
        clientName={clientName}
        driveUrl={driveUrl}
        clientEmail={clientEmail}
        onRefresh={onRefresh}
      />
      <div className="rounded-xl border border-card-border bg-card p-5">
        <h2 className="font-semibold text-sm mb-3 flex items-center gap-2"><FileText size={15} className="text-primary" /> File caricati</h2>
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Caricamento…</p>
        ) : files.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nessun file caricato.</p>
        ) : (
          <div className="space-y-1.5">
            {files.slice(0, 30).map((f: any) => (
              <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50 transition-colors">
                <FileText size={14} className="text-primary shrink-0" />
                <span className="text-sm truncate flex-1">{f.name}</span>
                <ExternalLink size={12} className="text-muted-foreground shrink-0" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Sincronizza il cliente attivo nella barra in alto (ClientSelector) col
  // cliente che stai guardando: aprendo /clients/:id — anche via click su una
  // task da /today — la barra cambia automaticamente su questo cliente, così
  // pagina e selettore in alto restano sempre allineati.
  useEffect(() => {
    const match = contextClients.find((item) => String(item.id) === String(clientId));
    if (match) setActiveClient(match);
  }, [clientId, contextClients, setActiveClient]);

  const [editing, setEditing] = useState(false);
  // Deep-link dall'/today: ?tab=<key> apre il tab giusto (es. "progetti" per le
  // task del cliente), ?task=<id> evidenzia e scrolla sulla riga della task.
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    try {
      const t = new URLSearchParams(window.location.search).get("tab");
      const valid: TabKey[] = ["panoramica", "progetti", "brief", "editoriale", "eventi", "report", "file", "idee", "banca", "meta"];
      if (t && (valid as string[]).includes(t)) return t as TabKey;
    } catch { /* ignore */ }
    return "panoramica";
  });
  const highlightTaskId = (() => {
    try { const v = new URLSearchParams(window.location.search).get("task"); return v ? Number(v) : null; }
    catch { return null; }
  })();
  const [form, setForm] = useState<Record<string, string>>({});
  const [editContacts, setEditContacts] = useState<Array<Record<string, string>>>([]);
  const [editServices, setEditServices] = useState<string[]>([]);
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
      const r = await portalFetch(`/api/meta/sync/${clientId}`, { method: "POST" });
      if (!r.ok) { toast({ variant: "destructive", title: "Sincronizzazione Meta non riuscita", description: await apiErrorDetail(r) }); return; }
      await fetchMetaStatus();
      toast({ title: "Dati Meta sincronizzati" });
    } catch { toast({ variant: "destructive", title: "Errore di rete" }); }
    finally { setMetaSyncing(false); }
  };

  const handleMetaAssignSave = async () => {
    setMetaSaving(true);
    try {
      const r = await portalFetch(`/api/meta/assign/${clientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metaPageId: metaAssign.pageId || null,
          metaIgAccountId: metaAssign.igId || null,
          metaAdAccountId: metaAssign.adId || null,
        }),
      });
      // Prima falliva in silenzio: sembrava salvato ma non lo era.
      if (!r.ok) { toast({ variant: "destructive", title: "Salvataggio assegnazioni non riuscito", description: await apiErrorDetail(r) }); return; }
      await fetchMetaStatus();
      toast({ title: "Assegnazioni Meta salvate" });
    } catch { toast({ variant: "destructive", title: "Errore di rete" }); }
    finally { setMetaSaving(false); }
  };

  const handleMetaDisconnect = async () => {
    if (!confirm("Rimuovere le assegnazioni Meta per questo cliente?")) return;
    try {
      const r = await portalFetch(`/api/meta/disconnect/${clientId}`, { method: "POST" });
      if (!r.ok) { toast({ variant: "destructive", title: "Rimozione non riuscita", description: await apiErrorDetail(r) }); return; }
      setMetaAssign({ pageId: "", igId: "", adId: "" });
      await fetchMetaStatus();
      toast({ title: "Assegnazioni Meta rimosse" });
    } catch { toast({ variant: "destructive", title: "Errore di rete" }); }
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
    // B11: clearInterval già presente. Aggiunto guard "cancelled" per evitare
    // setState dopo unmount se la fetch è ancora in volo quando l'utente
    // naviga via (warning React in strict mode).
    let cancelled = false;
    const interval = setInterval(() => {
      if (!clientId || cancelled) return;
      portalFetch(`/api/reports/client/${clientId}`)
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled && Array.isArray(data)) setReports(data);
        })
        .catch(() => {});
    }, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [clientId]);

  const handleApproveReport = async (id: number) => {
    const res = await portalFetch(`/api/reports/${id}/approve`, { method: "POST" });
    if (!res.ok) {
      toast({ variant: "destructive", title: "Approvazione non riuscita", description: await apiErrorDetail(res) });
      return;
    }
    toast({ title: "Report approvato" });
    fetchReports();
  };

  const handleRejectReport = async (id: number) => {
    const res = await portalFetch(`/api/reports/${id}/reject`, { method: "POST" });
    if (!res.ok) {
      toast({ variant: "destructive", title: "Rifiuto non riuscito", description: await apiErrorDetail(res) });
      return;
    }
    toast({ title: "Report rifiutato" });
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
        toast({ title: "Report inviato", description: report.recipientEmail });
        fetchReports();
      } else {
        toast({ variant: "destructive", title: "Invio non riuscito", description: data.error ?? "Verifica SMTP e destinatario." });
      }
    } finally {
      setSendingReportId(null);
    }
  };

  const handleDeleteReport = async (id: number) => {
    if (!confirm("Eliminare questo report?")) return;
    const res = await portalFetch(`/api/reports/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast({ variant: "destructive", title: "Eliminazione non riuscita", description: "Riprova tra qualche secondo." });
      return;
    }
    toast({ title: "Report eliminato" });
    fetchReports();
  };

  const REPORT_STATUS_LABELS: Record<string, string> = {
    bozza: "Bozza",
    in_revisione: "In revisione",
    approvato: "Approvato",
    confermato_cliente: "Confermato dal cliente",
    inviato: "Inviato",
  };
  const REPORT_STATUS_COLORS: Record<string, string> = {
    bozza: "bg-muted text-muted-foreground",
    in_revisione: "bg-amber-100 text-amber-700",
    approvato: "bg-emerald-100 text-emerald-700",
    confermato_cliente: "bg-teal-100 text-teal-700",
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
      pec: (editableClient as any).pec ?? "",
      sdi: (editableClient as any).sdi ?? "",
      iban: (editableClient as any).iban ?? "",
      metodoPagamento: (editableClient as any).metodoPagamento ?? "",
      terminiPagamento: (editableClient as any).terminiPagamento ?? "",
      notes: editableClient.notes ?? "",
      instagramHandle: editableClient.instagramHandle ?? "",
      metaPageId: editableClient.metaPageId ?? "",
      googleAdsId: editableClient.googleAdsId ?? "",
      driveUrl: editableClient.driveUrl ?? "",
      reportRecipientEmail: editableClient.reportRecipientEmail ?? "",
    });
    setEditContacts(Array.isArray(editableClient.contacts) ? editableClient.contacts : []);
    setEditServices(Array.isArray(editableClient.services) ? editableClient.services : []);
    setLogoPreview(editableClient.logoUrl ?? null);
    setEditing(true);
  };

  // Riduce il logo a max 256px e lo comprime prima di salvarlo: evita di
  // memorizzare data-URI enormi nel DB (es. un PNG 1254px ~1,3MB) che
  // appesantiscono ogni caricamento della lista clienti.
  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target?.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  const downscaleLogo = (dataUrl: string, max = 256) =>
    new Promise<string>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        if (scale >= 1) { resolve(dataUrl); return; } // già piccolo: lascialo com'è
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(dataUrl); return; }
        ctx.drawImage(img, 0, 0, w, h);
        // PNG preserva la trasparenza dei loghi.
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });

  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File troppo grande", description: "Massimo 5 MB." });
      return;
    }
    try {
      const original = await readFileAsDataUrl(file);
      const dataUrl = await downscaleLogo(original, 256);
      setLogoPreview(dataUrl);
      setForm((prev) => ({ ...prev, logoUrl: dataUrl }));
    } catch {
      toast({ variant: "destructive", title: "Immagine non leggibile", description: "Riprova con un altro file." });
    }
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
          // brandColor è il campo letto per primo da card/selector/badge:
          // aggiornalo insieme a color per evitare colori incoerenti.
          brandColor: form.color || undefined,
          ragioneSociale: form.ragioneSociale || null,
          piva: form.piva || null,
          codiceFiscale: form.codiceFiscale || null,
          pec: form.pec || null,
          sdi: form.sdi || null,
          iban: form.iban || null,
          metodoPagamento: form.metodoPagamento || null,
          terminiPagamento: form.terminiPagamento || null,
          contacts: editContacts,
          services: editServices,
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
          toast({ title: "Cliente aggiornato" });
        },
        onError: (err: any) => {
          // Il middleware backend validate() ritorna { error: "VALIDATION_ERROR",
          // issues: [{field, message}, ...] }. Estraiamo issues per dire all'utente
          // QUALE campo ha fallito invece del generico "VALIDATION_ERROR".
          const data = err?.data;
          const issues = Array.isArray(data?.issues) ? data.issues : [];
          let detail: string;
          if (issues.length > 0) {
            detail = issues
              .slice(0, 5)
              .map((i: any) => `${i.field || "?"}: ${i.message || "invalid"}`)
              .join(" · ");
          } else {
            detail = data?.error
              || data?.message
              || err?.message
              || "Errore sconosciuto. Apri la console (F12) per i dettagli.";
          }
          console.error("Save client error:", err, "issues:", issues);
          toast({
            variant: "destructive",
            title: "Errore nel salvataggio",
            description: String(detail).slice(0, 400),
          });
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
      <div className="p-4 md:p-8 max-w-5xl mx-auto">
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

        {/* Hero focalizzato del cockpit (Wave BS): apre sul "cosa serve adesso"
            per QUESTO cliente invece che sul muro di dati anagrafici. Cliccabile
            → tab Progetti & Task. */}
        {(() => {
          const startToday = new Date();
          startToday.setHours(0, 0, 0, 0);
          const openTasks = clientTasks.filter((t: any) => t.status !== "done");
          const overdue = openTasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < startToday);
          const activeProjects = clientProjects.filter((p: any) => p.status === "active");
          return (
            <div
              role="button"
              tabIndex={0}
              onClick={() => setActiveTab("progetti")}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveTab("progetti"); } }}
              className="w-full text-left rounded-xl border border-card-border bg-card/40 px-4 py-3 mb-4 cursor-pointer transition-colors hover:bg-muted/40"
            >
              <p className="text-lg md:text-xl font-bold tracking-tight leading-tight">
                {openTasks.length === 0 ? (
                  <>Nessuna task aperta <span className="text-emerald-600">✓</span></>
                ) : (
                  <>
                    <span className="text-primary tabular-nums">{openTasks.length}</span>{" "}
                    {openTasks.length === 1 ? "task aperta" : "task aperte"}
                    {overdue.length > 0 && (
                      <span className="text-amber-600">, {overdue.length} in ritardo</span>
                    )}
                  </>
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {activeProjects.length} {activeProjects.length === 1 ? "progetto attivo" : "progetti attivi"} · apri Progetti &amp; Task →
              </p>
            </div>
          );
        })()}

        <CockpitTabs active={activeTab} onChange={setActiveTab} />

        {/* ─── TAB: Panoramica (form/view dati cliente) ─── */}
        {activeTab === "panoramica" && (editing ? (
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
                <Field label="PEC" value={f("pec")} onChange={set("pec")} placeholder="pec@esempio.it" />
                <Field label="Codice SDI" value={f("sdi")} onChange={set("sdi")} placeholder="0000000" />
                <Field label="IBAN" value={f("iban")} onChange={set("iban")} placeholder="IT00 X000..." />
                <Field label="Metodo di pagamento" value={f("metodoPagamento")} onChange={set("metodoPagamento")} placeholder="Bonifico" />
                <Field label="Termini di pagamento" value={f("terminiPagamento")} onChange={set("terminiPagamento")} placeholder="30gg" />
              </div>
            </Section>

            <Section title="Referenti & Servizi" icon={<Building2 size={15} className="text-primary" />}>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Referenti</p>
                  <div className="space-y-2">
                    {editContacts.map((c, i) => (
                      <div key={i} className="grid grid-cols-[1fr_1fr_auto] sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                        <input placeholder="Nome" className="px-2 py-1.5 text-sm border border-input rounded bg-background" value={c.nome ?? ""} onChange={(e) => { const next = [...editContacts]; next[i] = { ...next[i], nome: e.target.value }; setEditContacts(next); }} />
                        <input placeholder="Ruolo" className="px-2 py-1.5 text-sm border border-input rounded bg-background" value={c.ruolo ?? ""} onChange={(e) => { const next = [...editContacts]; next[i] = { ...next[i], ruolo: e.target.value }; setEditContacts(next); }} />
                        <input placeholder="Email" className="px-2 py-1.5 text-sm border border-input rounded bg-background" value={c.email ?? ""} onChange={(e) => { const next = [...editContacts]; next[i] = { ...next[i], email: e.target.value }; setEditContacts(next); }} />
                        <button type="button" onClick={() => setEditContacts(editContacts.filter((_, j) => j !== i))} className="p-1.5 text-muted-foreground hover:text-destructive" title="Rimuovi referente"><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="text-xs text-primary hover:underline mt-2" onClick={() => setEditContacts([...editContacts, { nome: "", cognome: "", ruolo: "", email: "", telefono: "" }])}>+ aggiungi referente</button>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Servizi</p>
                  <div className="flex flex-wrap gap-2">
                    {SERVICE_TYPES.map((s) => {
                      const active = editServices.includes(s);
                      return <button type="button" key={s} onClick={() => setEditServices(active ? editServices.filter((x) => x !== s) : [...editServices, s])} className={cn("px-3 py-1.5 text-sm rounded-lg border", active ? "bg-primary/10 border-primary text-primary" : "bg-background border-input")}>{s}</button>;
                    })}
                  </div>
                </div>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {FIELD("Email", viewClient.email)}
                {FIELD("Telefono", viewClient.phone)}
                {FIELD("Azienda", viewClient.company)}
                {FIELD("Sito Web", viewClient.website)}
              </div>
              {!viewClient.email && !viewClient.phone && !viewClient.company && !viewClient.website && (
                <p className="text-sm text-muted-foreground">Nessuna informazione inserita. <button onClick={startEditing} className="text-primary hover:underline">Aggiungi</button></p>
              )}
            </Section>

            {((viewClient as any).ragioneSociale || (viewClient as any).piva || (viewClient as any).codiceFiscale || (viewClient as any).indirizzo || (viewClient as any).pec || (viewClient as any).sdi || (viewClient as any).iban || (viewClient as any).metodoPagamento || (viewClient as any).terminiPagamento) && (
              <Section title="Dati di Fatturazione" icon={<Receipt size={15} className="text-primary" />}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {FIELD("Ragione Sociale", (viewClient as any).ragioneSociale)}
                  {FIELD("Partita IVA", (viewClient as any).piva)}
                  {FIELD("Codice Fiscale", (viewClient as any).codiceFiscale)}
                  {FIELD("Indirizzo", (viewClient as any).indirizzo)}
                  {FIELD("CAP", (viewClient as any).cap)}
                  {FIELD("Città", (viewClient as any).citta)}
                  {FIELD("Provincia", (viewClient as any).provincia)}
                  {FIELD("Paese", (viewClient as any).paese)}
                  {FIELD("PEC", (viewClient as any).pec)}
                  {FIELD("Codice SDI", (viewClient as any).sdi)}
                  {FIELD("IBAN", (viewClient as any).iban)}
                  {FIELD("Metodo di pagamento", (viewClient as any).metodoPagamento)}
                  {FIELD("Termini di pagamento", (viewClient as any).terminiPagamento)}
                </div>
              </Section>
            )}

            {((((viewClient as any).contacts?.length ?? 0) > 0) || (((viewClient as any).services?.length ?? 0) > 0)) && (
              <Section title="Referenti & Servizi" icon={<Building2 size={15} className="text-primary" />}>
                <div className="space-y-4">
                  {(((viewClient as any).contacts?.length ?? 0) > 0) && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Referenti</p>
                      <div className="space-y-1.5">
                        {((viewClient as any).contacts as any[]).map((c, i) => (
                          <div key={i} className="text-sm flex flex-wrap gap-x-2 items-center">
                            <span className="font-medium">{[c.nome, c.cognome].filter(Boolean).join(" ") || "—"}</span>
                            {c.ruolo && <span className="text-xs text-muted-foreground">· {c.ruolo}</span>}
                            {c.email && <span className="text-xs text-primary">· {c.email}</span>}
                            {c.telefono && <span className="text-xs text-muted-foreground">· {c.telefono}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {(((viewClient as any).services?.length ?? 0) > 0) && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Servizi</p>
                      <div className="flex flex-wrap gap-1.5">
                        {((viewClient as any).services as string[]).map((s) => <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{s}</span>)}
                      </div>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {((viewClient as any).instagramHandle || (viewClient as any).metaPageId || (viewClient as any).googleAdsId) && (
              <Section title="Social & Integrazioni" icon={<Share2 size={15} className="text-primary" />}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

            {(viewClient as any).notes && (
              <Section title="Note" icon={<StickyNote size={15} className="text-primary" />}>
                <p className="text-sm whitespace-pre-wrap">{(viewClient as any).notes}</p>
              </Section>
            )}
          </div>
        ))}

        {/* ─── TAB: Brief ─── */}
        {activeTab === "brief" && (
          <BriefTab
            clientId={clientId}
            onOpen={() => {
              const match = contextClients.find((item) => String(item.id) === String(viewClient.id));
              if (match) setActiveClient(match);
              navigate("/tools/brief");
            }}
          />
        )}

        {/* ─── TAB: Editoriale ─── */}
        {activeTab === "editoriale" && (
          <EditorialTab
            clientId={clientId}
            onOpenCalendar={() => {
              const match = contextClients.find((item) => String(item.id) === String(viewClient.id));
              if (match) setActiveClient(match);
              navigate("/tools/calendar");
            }}
          />
        )}

        {/* ─── TAB: Eventi ─── */}
        {activeTab === "eventi" && (
          <EventsTab
            clientId={clientId}
            onOpen={() => {
              const match = contextClients.find((item) => String(item.id) === String(viewClient.id));
              if (match) setActiveClient(match);
              navigate("/tools/events");
            }}
          />
        )}

        {/* ─── TAB: Report ─── */}
        {activeTab === "report" && (
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
        )}

        {/* ─── TAB: File + Drive ─── */}
        {activeTab === "file" && (
          <FilesTab
            clientId={clientId}
            clientName={(viewClient as any).name ?? ""}
            clientEmail={(viewClient as any).email ?? null}
            driveUrl={(viewClient as any).driveUrl ?? null}
            onRefresh={() => { invalidateClient(); }}
          />
        )}

        {/* ─── TAB: Note rapide ─── */}
        {activeTab === "idee" && (
          <ClientNotesTab clientId={clientId} />
        )}

        {/* ─── TAB: Banca Idee ─── */}
        {activeTab === "banca" && (
          <ContentIdeasBank clientId={clientId} />
        )}

        {/* ─── TAB: Meta ─── */}
        {activeTab === "meta" && (
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

        {/* ─── TAB: Progetti & Task ─── */}
        {activeTab === "progetti" && (
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
            highlightTaskId={highlightTaskId}
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
        )}
      </div>
    </Layout>
  );
}
