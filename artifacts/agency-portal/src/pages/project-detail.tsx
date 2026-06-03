import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { portalFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/layout/Layout";
import {
  ChevronLeft,
  CalendarDays,
  Copy,
  Archive,
  Plus,
  LayoutDashboard,
  KanbanSquare,
  Users,
  History,
  FolderOpen,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Pencil,
  CalendarRange,
  Calendar as CalendarIcon,
  X,
  Receipt,
  Trash2,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

interface Props { id: string; }

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

async function patchProject(projectId: number, body: Record<string, unknown>) {
  return portalFetch(`/api/projects/${projectId}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
}

async function patchTask(taskId: number | string, body: Record<string, unknown>) {
  return portalFetch(`/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
}

type TabKey = "panoramica" | "task" | "editoriale" | "eventi" | "team" | "file" | "spese" | "log";
const TABS: { key: TabKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "panoramica", label: "Panoramica", icon: LayoutDashboard },
  { key: "task", label: "Task", icon: KanbanSquare },
  { key: "editoriale", label: "Editoriale", icon: CalendarRange },
  { key: "eventi", label: "Eventi", icon: CalendarIcon },
  { key: "team", label: "Team", icon: Users },
  { key: "file", label: "File", icon: FolderOpen },
  { key: "spese", label: "Spese", icon: Receipt },
  { key: "log", label: "Log", icon: History },
];

type WorkspaceTask = {
  id: number | string;
  title: string;
  description?: string | null;
  status: string;
  priority?: string;
  dueDate?: string | null;
  assigneeId?: number | null;
};
type WorkspaceMember = { id: number | string; role: string; userId: number };
type WorkspaceMilestone = { id: number | string; name: string; status: string; dueDate?: string | null };
type ActivityRow = { id: number | string; action: string; createdAt: string };
type TeamMember = { id: number; name?: string; surname?: string; email?: string; role?: string; avatarColor?: string; photoUrl?: string };
type EditorialPostRow = {
  id: string;
  title: string;
  caption?: string;
  platform: string;
  status: string;
  scheduledDate?: string | null;
};
type ClientEventRow = {
  id: string;
  title: string;
  date: string;
  endDate?: string | null;
  type?: string;
  priority?: string;
  note?: string | null;
};

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

/* ─── Tab Task: Kanban con drag&drop ─────────────────────────────────────── */
const KANBAN_COLUMNS: { key: string; label: string; color: string }[] = [
  { key: "todo", label: "Da fare", color: "bg-zinc-100 border-zinc-200" },
  { key: "in_progress", label: "In corso", color: "bg-sky-50 border-sky-200" },
  { key: "in_review", label: "In revisione", color: "bg-amber-50 border-amber-200" },
  { key: "done", label: "Fatto", color: "bg-emerald-50 border-emerald-200" },
];

function priorityClass(p?: string) {
  if (p === "high" || p === "urgent") return "bg-red-100 text-red-700";
  if (p === "low") return "bg-zinc-100 text-zinc-600";
  return "bg-amber-100 text-amber-700";
}

function TaskKanban({
  tasks,
  teamById,
  onMove,
  onOpen,
  onCreate,
}: {
  tasks: WorkspaceTask[];
  teamById: Map<number, TeamMember>;
  onMove: (taskId: number | string, newStatus: string) => void;
  onOpen: (task: WorkspaceTask) => void;
  onCreate: () => void;
}) {
  const [dragOver, setDragOver] = useState<string | null>(null);

  return (
    // Mobile: flex con scroll orizzontale + snap. Desktop (md+): grid 4 colonne.
    // Le colonne hanno min-w-[260px] su mobile così entra ~1.3 colonne per swipe.
    <div className="-mx-4 px-4 md:mx-0 md:px-0 flex md:grid overflow-x-auto md:overflow-visible snap-x snap-mandatory md:snap-none md:grid-cols-2 lg:grid-cols-4 gap-3 pb-2 md:pb-0">
      {KANBAN_COLUMNS.map((col) => {
        const items = tasks.filter((t) => normalizeStatus(t.status) === col.key);
        return (
          <div
            key={col.key}
            onDragOver={(e) => { e.preventDefault(); setDragOver(col.key); }}
            onDragLeave={() => setDragOver((prev) => (prev === col.key ? null : prev))}
            onDrop={(e) => {
              const id = e.dataTransfer.getData("text/task-id");
              if (id) onMove(id, col.key);
              setDragOver(null);
            }}
            className={cn(
              "rounded-xl border p-2 min-h-[200px] flex flex-col transition-colors shrink-0 w-[80vw] sm:w-[60vw] md:w-auto snap-start",
              col.color,
              dragOver === col.key && "ring-2 ring-primary/40",
            )}
          >
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{col.label}</p>
              <span className="text-[10px] font-bold text-muted-foreground bg-white px-1.5 rounded-full">{items.length}</span>
            </div>
            <div className="space-y-1.5 flex-1">
              {items.map((task) => {
                const assignee = task.assigneeId ? teamById.get(task.assigneeId) : null;
                const overdue = col.key !== "done" && task.dueDate && new Date(task.dueDate) < new Date();
                // Coerente con TaskCard/TaskList: card barrata + bg verde tenue quando done.
                const isDone = col.key === "done";
                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/task-id", String(task.id))}
                    onClick={() => onOpen(task)}
                    className={cn(
                      "border rounded-lg p-2 text-sm shadow-sm hover:shadow-md cursor-pointer transition-shadow",
                      isDone ? "bg-emerald-50/60 border-emerald-200 opacity-75" : "bg-white border-card-border",
                    )}
                  >
                    <p className={cn("font-medium text-xs leading-snug line-clamp-2", isDone && "line-through text-muted-foreground")}>{task.title}</p>
                    <div className="mt-1.5 flex items-center justify-between gap-1">
                      {task.priority && (
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-semibold", priorityClass(task.priority))}>
                          {task.priority}
                        </span>
                      )}
                      {task.dueDate && (
                        <span className={cn("text-[10px] tabular-nums", overdue ? "text-red-600 font-semibold" : "text-muted-foreground")}>
                          {new Date(task.dueDate).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                        </span>
                      )}
                    </div>
                    {assignee && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <Avatar member={assignee} size={18} />
                        <span className="text-[10px] text-muted-foreground truncate">{teamLabel(assignee)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
              {items.length === 0 && (
                <p className="text-[10px] text-muted-foreground text-center py-3">Niente qui</p>
              )}
            </div>
            {col.key === "todo" && (
              <button
                type="button"
                onClick={onCreate}
                className="mt-2 inline-flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-primary py-1.5 rounded-lg border border-dashed border-current"
              >
                <Plus size={12} /> Aggiungi task
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function normalizeStatus(s: string): string {
  if (!s) return "todo";
  const norm = s.toLowerCase().replace(/[\s-]/g, "_");
  if (norm === "doing" || norm === "in_corso") return "in_progress";
  if (norm === "review" || norm === "revisione") return "in_review";
  if (norm === "completed" || norm === "completato" || norm === "done") return "done";
  return KANBAN_COLUMNS.some((c) => c.key === norm) ? norm : "todo";
}

function teamLabel(m: TeamMember | null | undefined): string {
  if (!m) return "—";
  return [m.name, m.surname].filter(Boolean).join(" ").trim() || m.email || `#${m.id}`;
}

function postStatusClass(status: string): string {
  if (status === "pending_approval") return "bg-amber-100 text-amber-700";
  if (status === "approved") return "bg-lime-100 text-lime-700";
  if (status === "published") return "bg-emerald-100 text-emerald-700";
  if (status === "rejected") return "bg-rose-100 text-rose-700";
  return "bg-zinc-100 text-zinc-700";
}

function postStatusLabel(status: string): string {
  if (status === "pending_approval") return "In approvazione";
  if (status === "approved") return "Approvato";
  if (status === "published") return "Pubblicato";
  if (status === "rejected") return "Rifiutato";
  if (status === "draft") return "Bozza";
  return status;
}

function platformDotClass(platform: string): string {
  if (platform === "instagram") return "bg-violet-400";
  if (platform === "facebook") return "bg-blue-500";
  if (platform === "linkedin") return "bg-sky-600";
  if (platform === "tiktok") return "bg-zinc-700";
  if (platform === "youtube") return "bg-red-500";
  return "bg-zinc-400";
}

function PostRow({ post }: { post: EditorialPostRow }) {
  return (
    <div className="flex items-center gap-3 border border-card-border rounded-lg px-3 py-2 hover:bg-muted/30 transition-colors">
      <span className={cn("w-2 h-2 rounded-full shrink-0", platformDotClass(post.platform))} title={post.platform} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{post.title}</p>
        {post.caption && <p className="text-[11px] text-muted-foreground line-clamp-1">{post.caption}</p>}
      </div>
      <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0", postStatusClass(post.status))}>
        {postStatusLabel(post.status)}
      </span>
      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 min-w-[64px] text-right">
        {post.scheduledDate ? new Date(post.scheduledDate).toLocaleDateString("it-IT", { day: "2-digit", month: "short" }) : "—"}
      </span>
    </div>
  );
}

function PostStatusLegend({ posts }: { posts: EditorialPostRow[] }) {
  if (posts.length === 0) return null;
  const counts = posts.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});
  const order = ["draft", "pending_approval", "approved", "published", "rejected"];
  return (
    <div className="mt-4 pt-3 border-t border-border/40 flex flex-wrap gap-2 text-[11px]">
      {order.filter((s) => counts[s]).map((s) => (
        <span key={s} className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold", postStatusClass(s))}>
          {postStatusLabel(s)}: {counts[s]}
        </span>
      ))}
    </div>
  );
}

function eventPriorityClass(priority?: string): string {
  if (priority === "high" || priority === "urgent") return "bg-red-100 text-red-700";
  if (priority === "low") return "bg-zinc-100 text-zinc-600";
  return "bg-amber-100 text-amber-700";
}

function EventRow({ event }: { event: ClientEventRow }) {
  const start = new Date(event.date);
  const end = event.endDate ? new Date(event.endDate) : null;
  const isPast = end ? end < new Date() : start < new Date();
  return (
    <div className="flex items-center gap-3 border border-card-border rounded-lg px-3 py-2 hover:bg-muted/30 transition-colors">
      <div className={cn(
        "w-10 h-10 rounded-lg flex flex-col items-center justify-center shrink-0",
        isPast ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
      )}>
        <span className="text-[9px] font-semibold uppercase">{start.toLocaleDateString("it-IT", { month: "short" })}</span>
        <span className="text-sm font-bold leading-none">{start.getDate()}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{event.title}</p>
        {event.note && <p className="text-[11px] text-muted-foreground line-clamp-1">{event.note}</p>}
      </div>
      {event.type && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
          {event.type}
        </span>
      )}
      {event.priority && (
        <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0", eventPriorityClass(event.priority))}>
          {event.priority}
        </span>
      )}
    </div>
  );
}

function Avatar({ member, size = 24 }: { member: TeamMember; size?: number }) {
  const initial = (member.name?.charAt(0) ?? member.email?.charAt(0) ?? "?").toUpperCase();
  if (member.photoUrl) {
    return <img src={member.photoUrl} alt="" className="rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <div
      className="rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
      style={{ width: size, height: size, backgroundColor: member.avatarColor ?? "#7a8f5c" }}
    >
      {initial}
    </div>
  );
}

/* ─── Tab File del progetto: lista reale + aggiungi link inline ──────────── */
type ProjectFileRow = {
  id: number;
  name: string;
  url: string;
  type: string;
  size: number | null;
  uploadedBy: string | null;
  createdAt: string;
};

function ProjectFilesTab({ projectId, clientDriveUrl, clientId }: {
  projectId: number;
  clientDriveUrl: string | null;
  clientId: number | null;
}) {
  const [files, setFiles] = useState<ProjectFileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftUrl, setDraftUrl] = useState("");
  const [draftType, setDraftType] = useState("Documento");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await portalFetch(`/api/files?projectId=${projectId}`);
      if (r.ok) {
        const json = await r.json();
        setFiles(Array.isArray(json) ? json : []);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const handleAdd = async () => {
    const name = draftName.trim();
    const rawUrl = draftUrl.trim();
    if (!name || !rawUrl) {
      toast({ variant: "destructive", title: "Campi obbligatori", description: "Nome e URL sono richiesti." });
      return;
    }
    let normalizedUrl = rawUrl;
    if (!/^https?:\/\//i.test(normalizedUrl)) normalizedUrl = `https://${normalizedUrl}`;
    try { new URL(normalizedUrl); } catch {
      toast({ variant: "destructive", title: "URL non valido" });
      return;
    }
    setSaving(true);
    try {
      const r = await portalFetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, url: normalizedUrl, type: draftType, size: null, projectId, uploadedBy: null }),
      });
      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        toast({ variant: "destructive", title: "Salvataggio non riuscito", description: txt.slice(0, 160) || "Riprova." });
        return;
      }
      toast({ title: "File aggiunto" });
      setDraftName(""); setDraftUrl(""); setDraftType("Documento");
      setShowForm(false);
      await load();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Eliminare "${name}"?`)) return;
    const r = await portalFetch(`/api/files/${id}`, { method: "DELETE" });
    if (r.ok || r.status === 204) {
      toast({ title: "File eliminato" });
      await load();
    } else {
      toast({ variant: "destructive", title: "Eliminazione non riuscita" });
    }
  };

  return (
    <div className="space-y-3">
      {clientDriveUrl && (
        <a href={clientDriveUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 hover:bg-primary/10 transition-colors">
          <FolderOpen size={16} className="text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Cartella Drive del cliente</p>
            <p className="text-[11px] text-muted-foreground truncate">{clientDriveUrl}</p>
          </div>
          <span className="text-xs text-primary">Apri →</span>
        </a>
      )}

      <div className="bg-card border border-card-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-sm">File del progetto</h3>
            <p className="text-[11px] text-muted-foreground">{files.length} link associati a questo progetto</p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus size={12} /> {showForm ? "Annulla" : "Aggiungi link"}
          </button>
        </div>

        {showForm && (
          <div className="rounded-lg border border-card-border bg-muted/30 p-3 mb-3 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                placeholder="Nome *"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                className="px-3 py-2 text-sm border border-input rounded-lg bg-background"
              />
              <select
                value={draftType}
                onChange={(e) => setDraftType(e.target.value)}
                className="px-3 py-2 text-sm border border-input rounded-lg bg-background"
              >
                <option>Documento</option>
                <option>Immagine</option>
                <option>Video</option>
                <option>Drive</option>
                <option>Figma</option>
                <option>Canva</option>
                <option>Notion</option>
                <option>Altro</option>
              </select>
            </div>
            <input
              placeholder="URL *  (https://...)"
              value={draftUrl}
              onChange={(e) => setDraftUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleAdd(); }}
              className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs border border-input rounded-lg">Annulla</button>
              <button onClick={handleAdd} disabled={saving} className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg disabled:opacity-50">
                {saving ? "Salvo…" : "Aggiungi"}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-xs text-muted-foreground py-3">Caricamento…</p>
        ) : files.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nessun link aggiunto. Collega Drive, Canva, Figma, Notion o qualsiasi URL utile al progetto.
          </p>
        ) : (
          <div className="space-y-1">
            {files.map((f) => (
              <div key={f.id} className="flex items-center gap-2 rounded-lg p-2 border border-card-border hover:bg-muted/30 transition-colors">
                <FolderOpen size={14} className="text-muted-foreground shrink-0" />
                <a href={f.url} target="_blank" rel="noreferrer" className="flex-1 min-w-0 hover:text-primary text-sm font-medium truncate">
                  {f.name}
                </a>
                <span className="text-[10px] text-muted-foreground hidden sm:inline">{f.type}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums hidden md:inline">
                  {f.createdAt ? new Date(f.createdAt).toLocaleDateString("it-IT") : ""}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(f.id, f.name)}
                  className="p-1 text-muted-foreground hover:text-destructive shrink-0"
                  aria-label="Elimina file"
                  title="Elimina"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {clientId && (
          <div className="mt-3 pt-3 border-t border-border/40">
            <Link href={`/clients/${clientId}`} className="text-[11px] text-muted-foreground hover:text-primary">
              ← Vedi tutti i file del cliente
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Tab Spese progetto: aggiungi/elimina spese, totale realtime ─────── */
type ExpenseRow = {
  id: number;
  description: string;
  category: string;
  amount: number;
  date: string;
  addedBy: string | null;
  createdAt: string | null;
};

const EXPENSE_CATEGORIES = ["Stock images", "ADV spend", "Tool subscription", "Freelance", "Trasferta", "Software", "Hardware", "Altro"];

function ProjectExpensesTab({ projectId, budget, onChange }: { projectId: number; budget: number; onChange?: () => void }) {
  const [items, setItems] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [draftDesc, setDraftDesc] = useState("");
  const [draftAmount, setDraftAmount] = useState("");
  const [draftCategory, setDraftCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [draftDate, setDraftDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await portalFetch(`/api/projects/${projectId}/expenses`);
      if (r.ok) {
        const json = await r.json();
        setItems(Array.isArray(json) ? json : []);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const totalSpent = useMemo(() => items.reduce((s, i) => s + Number(i.amount ?? 0), 0), [items]);

  const handleAdd = async () => {
    if (!draftDesc.trim() || !draftAmount) {
      toast({ variant: "destructive", title: "Campi obbligatori", description: "Descrizione e importo sono richiesti." });
      return;
    }
    const amountNum = Number(draftAmount);
    if (!Number.isFinite(amountNum) || amountNum < 0) {
      toast({ variant: "destructive", title: "Importo non valido" });
      return;
    }
    setSaving(true);
    try {
      const r = await portalFetch(`/api/projects/${projectId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: draftDesc.trim(), category: draftCategory, amount: amountNum, date: draftDate }),
      });
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        toast({ variant: "destructive", title: "Salvataggio non riuscito", description: text.slice(0, 160) || "Riprova" });
        return;
      }
      toast({ title: "Spesa aggiunta", description: `€ ${amountNum.toLocaleString("it-IT")} · ${draftDesc.trim()}` });
      setDraftDesc(""); setDraftAmount(""); setDraftCategory(EXPENSE_CATEGORIES[0]);
      setShowForm(false);
      await load();
      onChange?.();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Eliminare questa spesa?")) return;
    const r = await portalFetch(`/api/projects/${projectId}/expenses/${id}`, { method: "DELETE" });
    if (r.ok || r.status === 204) {
      toast({ title: "Spesa eliminata" });
      await load();
      onChange?.();
    } else {
      toast({ variant: "destructive", title: "Eliminazione non riuscita" });
    }
  };

  const budgetPct = budget > 0 ? Math.round((totalSpent / budget) * 100) : 0;
  const remaining = Math.max(0, budget - totalSpent);

  return (
    <div className="space-y-3">
      {/* Summary card */}
      <div className="bg-card border border-card-border rounded-xl p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Speso</p>
            <p className="text-xl font-bold tabular-nums">€ {totalSpent.toLocaleString("it-IT")}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Budget</p>
            <p className="text-xl font-bold tabular-nums">€ {budget.toLocaleString("it-IT")}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Rimanente</p>
            <p className={cn("text-xl font-bold tabular-nums", budget > 0 && remaining === 0 ? "text-red-600" : "")}>€ {remaining.toLocaleString("it-IT")}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Spese</p>
            <p className="text-xl font-bold tabular-nums">{items.length}</p>
          </div>
        </div>
        {budget > 0 && (
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn("h-full transition-all", budgetPct > 95 ? "bg-red-500" : budgetPct >= 80 ? "bg-amber-500" : "bg-emerald-500")}
              style={{ width: `${Math.min(100, budgetPct)}%` }}
            />
          </div>
        )}
      </div>

      {/* Form + lista */}
      <div className="bg-card border border-card-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Spese registrate</h3>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus size={12} /> {showForm ? "Annulla" : "Aggiungi spesa"}
          </button>
        </div>

        {showForm && (
          <div className="rounded-lg border border-card-border bg-muted/30 p-3 mb-3 space-y-2">
            <input
              autoFocus
              placeholder="Descrizione *"
              value={draftDesc}
              onChange={(e) => setDraftDesc(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleAdd(); }}
              className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background"
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="number"
                step="0.01"
                placeholder="Importo €  *"
                value={draftAmount}
                onChange={(e) => setDraftAmount(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleAdd(); }}
                className="px-3 py-2 text-sm border border-input rounded-lg bg-background"
              />
              <select
                value={draftCategory}
                onChange={(e) => setDraftCategory(e.target.value)}
                className="px-3 py-2 text-sm border border-input rounded-lg bg-background"
              >
                {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <input
                type="date"
                value={draftDate}
                onChange={(e) => setDraftDate(e.target.value)}
                className="px-3 py-2 text-sm border border-input rounded-lg bg-background"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs border border-input rounded-lg">Annulla</button>
              <button onClick={handleAdd} disabled={saving} className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg disabled:opacity-50">
                {saving ? "Salvo…" : "Salva spesa"}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-xs text-muted-foreground py-3">Caricamento…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nessuna spesa registrata. Aggiungi qui acquisti tool, freelance, ADV spend, ecc.
          </p>
        ) : (
          <div className="space-y-1">
            {items
              .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
              .map((it) => (
                <div key={it.id} className="flex items-center gap-2 rounded-lg p-2 border border-card-border hover:bg-muted/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{it.description}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {it.category} · {it.date ? new Date(it.date).toLocaleDateString("it-IT") : ""}
                    </p>
                  </div>
                  <p className="font-semibold tabular-nums text-sm shrink-0">€ {Number(it.amount).toLocaleString("it-IT")}</p>
                  <button
                    type="button"
                    onClick={() => handleDelete(it.id)}
                    className="p-1 text-muted-foreground hover:text-destructive shrink-0"
                    aria-label="Elimina spesa"
                    title="Elimina"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Note con autosave ─────────────────────────────────────────────────── */
function AutoSaveNotes({ initialValue, projectId }: { initialValue: string; projectId: number }) {
  const [value, setValue] = useState(initialValue);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(initialValue);

  useEffect(() => {
    setValue(initialValue);
    lastSavedRef.current = initialValue;
  }, [initialValue]);

  useEffect(() => {
    if (value === lastSavedRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setState("idle");
    timerRef.current = setTimeout(async () => {
      setState("saving");
      try {
        const res = await patchProject(projectId, { notes: value, lastActivityAt: new Date().toISOString() });
        if (!res.ok) throw new Error("save failed");
        lastSavedRef.current = value;
        setState("saved");
        setTimeout(() => setState((s) => (s === "saved" ? "idle" : s)), 1800);
      } catch {
        setState("error");
      }
    }, 1500);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [value, projectId]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="font-semibold text-sm">Quick notes</h3>
        <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
          {state === "saving" && <><Loader2 size={10} className="animate-spin" /> Salvataggio…</>}
          {state === "saved" && <><CheckCircle2 size={10} className="text-emerald-600" /> Salvato</>}
          {state === "error" && <><AlertTriangle size={10} className="text-red-600" /> Errore</>}
          {state === "idle" && value === lastSavedRef.current && value && <span>Sincronizzato</span>}
        </span>
      </div>
      <textarea
        rows={5}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Pensieri, blocchi, prossimi step…"
        className="w-full px-2.5 py-2 border border-input rounded-lg bg-background text-sm resize-none"
      />
    </div>
  );
}

/* ─── Main Component ───────────────────────────────────────────────────── */
export default function ProjectDetail({ id }: Props) {
  const projectId = Number(id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [tab, setTab] = useState<TabKey>("panoramica");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [posts, setPosts] = useState<EditorialPostRow[]>([]);
  const [events, setEvents] = useState<ClientEventRow[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", description: "", deadline: "", budget: "" });
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);
  const [tasksOverride, setTasksOverride] = useState<WorkspaceTask[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await portalFetch(`/api/projects/${projectId}/workspace`);
      const json = await res.json();
      setData(json);
      setTasksOverride(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadTeam = useCallback(async () => {
    try {
      const res = await portalFetch("/api/team");
      const json = await res.json();
      if (Array.isArray(json)) setTeamMembers(json as TeamMember[]);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadTeam(); }, [loadTeam]);

  const clientId = data?.project?.clientId ?? data?.client?.id ?? null;
  useEffect(() => {
    if (!clientId) {
      setPosts([]);
      setEvents([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [pRes, eRes] = await Promise.all([
          portalFetch(`/api/clients/${clientId}/posts`),
          portalFetch(`/api/clients/${clientId}/events`),
        ]);
        if (cancelled) return;
        if (pRes.ok) {
          const arr = await pRes.json();
          setPosts(Array.isArray(arr) ? arr : []);
        }
        if (eRes.ok) {
          const arr = await eRes.json();
          setEvents(Array.isArray(arr) ? arr : []);
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [clientId]);

  const project = data?.project;
  const rawTasks: WorkspaceTask[] = useMemo(() => Array.isArray(data?.tasks) ? data.tasks : [], [data]);
  const tasks: WorkspaceTask[] = tasksOverride ?? rawTasks;
  const activity: ActivityRow[] = Array.isArray(data?.activity) ? data.activity : [];
  const members: WorkspaceMember[] = Array.isArray(data?.members) ? data.members : [];
  const milestones: WorkspaceMilestone[] = Array.isArray(data?.milestones) ? data.milestones : [];
  const types = useMemo(() => {
    try { return JSON.parse(project?.typeJson ?? "[]") as string[]; } catch { return []; }
  }, [project?.typeJson]);

  const teamById = useMemo(() => {
    const map = new Map<number, TeamMember>();
    for (const m of teamMembers) map.set(Number(m.id), m);
    return map;
  }, [teamMembers]);

  const projectMembersWithNames = useMemo(() => {
    return members.map((m) => {
      const profile = teamById.get(Number(m.userId));
      return { ...m, profile };
    });
  }, [members, teamById]);

  const projectStart = project?.startDate ? new Date(project.startDate) : null;
  const projectEnd = project?.endDate
    ? new Date(project.endDate)
    : project?.deadline
      ? new Date(project.deadline)
      : null;

  const inProjectRange = (iso?: string | null): boolean => {
    if (!iso) return false;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;
    if (projectStart && d < projectStart) return false;
    if (projectEnd && d > projectEnd) return false;
    return true;
  };

  const projectPosts = useMemo(() => {
    if (!projectStart && !projectEnd) return posts;
    return posts.filter((p) => inProjectRange(p.scheduledDate));
  }, [posts, projectStart, projectEnd]);

  const projectEvents = useMemo(() => {
    if (!projectStart && !projectEnd) return events;
    return events.filter((e) => inProjectRange(e.date) || inProjectRange(e.endDate ?? null));
  }, [events, projectStart, projectEnd]);

  if (loading) return <Layout><div className="p-8 text-muted-foreground">Caricamento…</div></Layout>;
  if (!project) return <Layout><div className="p-8 text-muted-foreground">Progetto non trovato</div></Layout>;

  const budget = Number(data?.stats?.budget ?? project.budget ?? 0);
  const spent = Number(data?.stats?.spent ?? project.budgetSpeso ?? 0);
  const budgetPct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
  const remaining = Math.max(0, budget - spent);
  const tasksDone = data?.stats?.tasksDone ?? tasks.filter((t) => normalizeStatus(t.status) === "done").length;
  const tasksTotal = data?.stats?.tasksTotal ?? tasks.length;
  const progress = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : project.progress ?? 0;
  const overdueTasks = tasks.filter((t) => normalizeStatus(t.status) !== "done" && t.dueDate && new Date(t.dueDate) < new Date());

  const handleMoveTask = async (taskId: number | string, newStatus: string) => {
    setTasksOverride(tasks.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));
    const res = await patchTask(taskId, { status: newStatus });
    if (!res.ok) {
      toast({ variant: "destructive", title: "Spostamento non riuscito" });
      setTasksOverride(null);
      return;
    }
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim() || creatingTask) return;
    setCreatingTask(true);
    try {
      const res = await portalFetch("/api/tasks", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          projectId: project.id,
          clientId: project.clientId ?? null,
          status: "todo",
          priority: "medium",
        }),
      });
      if (!res.ok) {
        toast({ variant: "destructive", title: "Creazione task non riuscita" });
        return;
      }
      setNewTaskTitle("");
      setNewTaskOpen(false);
      toast({ title: "Task creata" });
      await load();
    } finally {
      setCreatingTask(false);
    }
  };

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-5">
        <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft size={16} /> Progetti
        </Link>

        {/* Header */}
        <div className="bg-card border border-card-border rounded-xl p-4 md:p-5">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-4">
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold truncate">{project.name}</h1>
              <p className="text-sm text-muted-foreground">{data?.client?.name ?? project.clientName ?? "Cliente"}</p>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {types.map((t) => <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{t}</span>)}
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{project.status}</span>
                <HealthBadge health={project.healthStatus ?? "on-track"} />
              </div>
            </div>
            <div className="text-left md:text-right text-sm md:shrink-0">
              <p className="inline-flex items-center gap-1 text-muted-foreground">
                <CalendarDays size={14} /> {project.deadline ? formatDate(project.deadline) : "Nessuna deadline"}
              </p>
              {budget > 0 && (
                <p className="mt-1 font-semibold tabular-nums">
                  € {spent.toLocaleString("it-IT")} / € {budget.toLocaleString("it-IT")} <span className="text-xs text-muted-foreground">({budgetPct}%)</span>
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                Progress: <strong className="text-foreground">{progress}%</strong> · {tasksDone}/{tasksTotal} task
              </p>
            </div>
          </div>
          {budget > 0 && (
            <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
              <div className={cn("h-full transition-all", budgetPct > 95 ? "bg-red-500" : budgetPct >= 80 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${Math.min(100, budgetPct)}%` }} />
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="px-3 py-1.5 text-xs border border-input rounded-lg inline-flex items-center gap-1 hover:bg-muted"
              onClick={() => {
                setEditForm({
                  name: project.name ?? "",
                  description: project.description ?? "",
                  deadline: project.deadline ? String(project.deadline).slice(0, 10) : "",
                  budget: project.budget != null ? String(project.budget) : "",
                });
                setEditOpen(true);
              }}
            >
              <Pencil size={12} /> Modifica
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!confirm("Archiviare questo progetto?")) return;
                const res = await portalFetch(`/api/projects/${project.id}/archive`, { method: "POST" });
                if (!res.ok) {
                  toast({ variant: "destructive", title: "Archiviazione non riuscita" });
                  return;
                }
                toast({ title: "Progetto archiviato" });
                navigate("/projects");
              }}
              className="px-3 py-1.5 text-xs border border-input rounded-lg inline-flex items-center gap-1 hover:bg-muted"
            >
              <Archive size={12} /> Archivia
            </button>
            <button
              type="button"
              onClick={async () => {
                const res = await portalFetch(`/api/projects/${project.id}/duplicate`, {
                  method: "POST",
                  headers: JSON_HEADERS,
                  body: JSON.stringify({ copyTasks: true }),
                });
                if (!res.ok) {
                  toast({ variant: "destructive", title: "Duplicazione non riuscita" });
                  return;
                }
                const dup = await res.json();
                toast({ title: "Progetto duplicato" });
                if (dup?.id) navigate(`/projects/${dup.id}`);
                else navigate("/projects");
              }}
              className="px-3 py-1.5 text-xs border border-input rounded-lg inline-flex items-center gap-1 hover:bg-muted"
            >
              <Copy size={12} /> Duplica
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="bg-card border border-card-border rounded-xl p-1.5 flex gap-1 overflow-x-auto sticky top-2 z-10">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-lg whitespace-nowrap inline-flex items-center gap-1.5 transition-colors",
                  active
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted/60"
                )}
              >
                <Icon size={13} />
                {t.label}
                {t.key === "task" && tasksTotal > 0 && (
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full",
                    active ? "bg-white/20" : "bg-muted"
                  )}>
                    {tasksDone}/{tasksTotal}
                  </span>
                )}
                {t.key === "editoriale" && projectPosts.length > 0 && (
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full",
                    active ? "bg-white/20" : "bg-muted"
                  )}>
                    {projectPosts.length}
                  </span>
                )}
                {t.key === "eventi" && projectEvents.length > 0 && (
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full",
                    active ? "bg-white/20" : "bg-muted"
                  )}>
                    {projectEvents.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ─── TAB: Panoramica ─── */}
        {tab === "panoramica" && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 space-y-4">
              <div className="bg-card border border-card-border rounded-xl p-4">
                <h3 className="font-semibold mb-2 text-sm">Descrizione</h3>
                <p className="text-sm text-muted-foreground">{project.description ?? "Nessuna descrizione"}</p>
                <div className="grid grid-cols-3 gap-3 mt-4 text-sm">
                  <div><p className="text-xs text-muted-foreground">Inizio</p><p>{project.startDate ? formatDate(project.startDate) : "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Fine</p><p>{project.endDate ? formatDate(project.endDate) : "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Ultimo update</p><p>{formatDate(project.updatedAt)}</p></div>
                </div>
              </div>

              <div className="bg-card border border-card-border rounded-xl p-4">
                <h3 className="font-semibold mb-3 text-sm">Budget</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-[11px] text-muted-foreground">Totale</p>
                    <p className="font-semibold tabular-nums">€ {budget.toLocaleString("it-IT")}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Speso</p>
                    <p className="font-semibold tabular-nums">€ {spent.toLocaleString("it-IT")}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Rimanente</p>
                    <p className="font-semibold tabular-nums">€ {remaining.toLocaleString("it-IT")}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Ore</p>
                    <p className="font-semibold tabular-nums">{project.oreLavorate ?? 0}/{project.oreStimate ?? 0}</p>
                  </div>
                </div>
                {budget === 0 && (
                  <p className="mt-2 text-[11px] text-muted-foreground">Imposta un budget per attivare i grafici e gli alert.</p>
                )}
              </div>

              {milestones.length > 0 && (
                <div className="bg-card border border-card-border rounded-xl p-4">
                  <h3 className="font-semibold mb-3 text-sm">Milestone</h3>
                  <div className="space-y-2">
                    {milestones.map((m) => (
                      <div key={m.id} className="flex items-center justify-between border border-card-border rounded-lg px-3 py-2 text-sm">
                        <span className="font-medium">{m.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{m.status}</span>
                          {m.dueDate && <span className="text-xs text-muted-foreground">{formatDate(m.dueDate)}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="bg-card border border-card-border rounded-xl p-4">
                <AutoSaveNotes initialValue={project.notes ?? ""} projectId={project.id} />
              </div>

              <div className="bg-card border border-card-border rounded-xl p-4">
                <h3 className="font-semibold mb-2 text-sm">Task in scadenza</h3>
                {tasks.filter((t) => t.dueDate && normalizeStatus(t.status) !== "done").length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">Nessuna scadenza imminente</p>
                ) : (
                  <div className="space-y-1.5">
                    {tasks
                      .filter((t) => t.dueDate && normalizeStatus(t.status) !== "done")
                      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
                      .slice(0, 5)
                      .map((t) => {
                        const overdue = new Date(t.dueDate!) < new Date();
                        return (
                          <div key={t.id} className="text-xs flex items-center justify-between">
                            <span className="truncate">{t.title}</span>
                            <span className={cn("tabular-nums shrink-0 ml-2", overdue ? "text-red-600 font-semibold" : "text-muted-foreground")}>
                              {formatDate(t.dueDate!)}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              <div className="bg-card border border-card-border rounded-xl p-4">
                <h3 className="font-semibold mb-2 text-sm">Activity recente</h3>
                {activity.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">Nessuna attività</p>
                ) : (
                  <div className="space-y-1.5">
                    {activity.slice(0, 5).map((a) => (
                      <div key={a.id} className="text-xs">
                        <p className="font-medium leading-tight">{a.action}</p>
                        <p className="text-muted-foreground text-[10px]">{formatDate(a.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {(overdueTasks.length > 0 || budgetPct >= 80) && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
                  <h3 className="text-xs font-semibold text-amber-800 inline-flex items-center gap-1">
                    <AlertTriangle size={12} /> Alert
                  </h3>
                  {overdueTasks.length > 0 && (
                    <p className="text-xs text-amber-700">{overdueTasks.length} task in ritardo</p>
                  )}
                  {budgetPct >= 95 && (
                    <p className="text-xs text-red-700 font-semibold">Budget oltre il 95%</p>
                  )}
                  {budgetPct >= 80 && budgetPct < 95 && (
                    <p className="text-xs text-amber-700">Budget all'{budgetPct}% — attenzione</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB: Task (Kanban) ─── */}
        {tab === "task" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">Task progetto</h3>
                <p className="text-xs text-muted-foreground">{tasksDone}/{tasksTotal} completate · trascina le card per cambiare stato</p>
              </div>
              <button
                type="button"
                onClick={() => setNewTaskOpen(true)}
                className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded inline-flex items-center gap-1"
              >
                <Plus size={12} /> Nuova task
              </button>
            </div>
            <TaskKanban
              tasks={tasks}
              teamById={teamById}
              onMove={handleMoveTask}
              onOpen={(t) => navigate(`/tasks?id=${t.id}`)}
              onCreate={() => setNewTaskOpen(true)}
            />
          </div>
        )}

        {/* ─── TAB: Editoriale (post del cliente nel periodo del progetto) ─── */}
        {tab === "editoriale" && (
          <div className="bg-card border border-card-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-sm">Piano editoriale del cliente</h3>
                <p className="text-xs text-muted-foreground">
                  Post {projectStart || projectEnd ? "nel periodo del progetto" : "del cliente"}
                  {projectStart && projectEnd && ` (${formatDate(projectStart.toISOString())} → ${formatDate(projectEnd.toISOString())})`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/tools/calendar")}
                className="text-xs text-primary hover:underline"
              >
                Apri calendario →
              </button>
            </div>
            {projectPosts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nessun post programmato {projectStart || projectEnd ? "nel periodo del progetto" : "per questo cliente"}.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-[480px] overflow-y-auto">
                {projectPosts
                  .sort((a, b) => {
                    const ta = a.scheduledDate ? new Date(a.scheduledDate).getTime() : 0;
                    const tb = b.scheduledDate ? new Date(b.scheduledDate).getTime() : 0;
                    return ta - tb;
                  })
                  .map((p) => (
                    <PostRow key={p.id} post={p} />
                  ))}
              </div>
            )}
            <PostStatusLegend posts={projectPosts} />
          </div>
        )}

        {/* ─── TAB: Eventi (eventi cliente nel periodo del progetto) ─── */}
        {tab === "eventi" && (
          <div className="bg-card border border-card-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-sm">Eventi del cliente</h3>
                <p className="text-xs text-muted-foreground">
                  Eventi {projectStart || projectEnd ? "nel periodo del progetto" : "del cliente"}
                  {projectStart && projectEnd && ` (${formatDate(projectStart.toISOString())} → ${formatDate(projectEnd.toISOString())})`}
                </p>
              </div>
              {data?.client?.id && (
                <Link href={`/clients/${data.client.id}`} className="text-xs text-primary hover:underline">
                  Apri cliente →
                </Link>
              )}
            </div>
            {projectEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nessun evento {projectStart || projectEnd ? "nel periodo del progetto" : "per questo cliente"}.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-[480px] overflow-y-auto">
                {projectEvents
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .map((e) => (
                    <EventRow key={e.id} event={e} />
                  ))}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB: Team ─── */}
        {tab === "team" && (
          <div className="bg-card border border-card-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Team del progetto</h3>
              <button
                type="button"
                onClick={() => navigate("/team")}
                className="text-xs text-primary hover:underline"
              >
                Gestisci team →
              </button>
            </div>
            {projectMembersWithNames.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Nessun membro assegnato. Aggiungili dal wizard di creazione o dalla pagina <Link href="/team" className="text-primary">Team</Link>.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {projectMembersWithNames.map((m) => {
                  const p = m.profile;
                  return (
                    <div key={m.id} className="flex items-center gap-3 border border-card-border rounded-lg p-3">
                      {p ? <Avatar member={p} size={36} /> : <div className="w-9 h-9 rounded-full bg-muted" />}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{teamLabel(p)}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {m.role}{p?.role && p.role !== m.role ? ` · ${p.role}` : ""}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB: File ─── */}
        {tab === "file" && (
          <ProjectFilesTab projectId={project.id} clientDriveUrl={data?.client?.driveUrl ?? null} clientId={data?.client?.id ?? null} />
        )}

        {/* ─── TAB: Spese ─── */}
        {tab === "spese" && (
          <ProjectExpensesTab projectId={project.id} budget={budget} onChange={load} />
        )}

        {/* ─── TAB: Log ─── */}
        {tab === "log" && (
          <div className="bg-card border border-card-border rounded-xl p-4">
            <h3 className="font-semibold text-sm mb-3">Audit log completo</h3>
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Nessuna attività registrata</p>
            ) : (
              <div className="space-y-1.5">
                {activity.map((a) => (
                  <div key={a.id} className="text-xs py-1.5 border-b border-border/40 last:border-b-0 flex items-center justify-between">
                    <span>{a.action}</span>
                    <span className="text-muted-foreground tabular-nums">{formatDate(a.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal: edit progetto */}
        {editOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-card border border-card-border rounded-xl w-full max-w-md p-5 space-y-3">
              <h3 className="font-semibold">Modifica progetto</h3>
              <label className="block text-xs text-muted-foreground">Nome</label>
              <input className="w-full px-2 py-1.5 border border-input rounded-lg bg-background text-sm" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
              <label className="block text-xs text-muted-foreground">Descrizione</label>
              <textarea rows={3} className="w-full px-2 py-1.5 border border-input rounded-lg bg-background text-sm" value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
              <label className="block text-xs text-muted-foreground">Scadenza</label>
              <input type="date" className="w-full px-2 py-1.5 border border-input rounded-lg bg-background text-sm" value={editForm.deadline} onChange={(e) => setEditForm((f) => ({ ...f, deadline: e.target.value }))} />
              <label className="block text-xs text-muted-foreground">Budget (€)</label>
              <input className="w-full px-2 py-1.5 border border-input rounded-lg bg-background text-sm" value={editForm.budget} onChange={(e) => setEditForm((f) => ({ ...f, budget: e.target.value }))} />
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" className="px-3 py-1.5 text-xs border border-input rounded-lg" onClick={() => setEditOpen(false)}>Annulla</button>
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg"
                  onClick={async () => {
                    const res = await patchProject(project.id, {
                      name: editForm.name.trim() || project.name,
                      description: editForm.description || null,
                      deadline: editForm.deadline ? new Date(editForm.deadline).toISOString() : null,
                      budget: editForm.budget.trim() ? Number(editForm.budget) : null,
                    });
                    if (!res.ok) {
                      toast({ variant: "destructive", title: "Salvataggio non riuscito" });
                      return;
                    }
                    toast({ title: "Progetto aggiornato" });
                    setEditOpen(false);
                    await load();
                  }}
                >
                  Salva
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: quick task creation */}
        {newTaskOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-card border border-card-border rounded-xl w-full max-w-md p-5 space-y-3">
              <h3 className="font-semibold">Nuova task</h3>
              <input
                autoFocus
                placeholder="Titolo task"
                className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleCreateTask(); }}
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { setNewTaskOpen(false); setNewTaskTitle(""); }} className="px-3 py-1.5 text-xs border border-input rounded-lg">Annulla</button>
                <button
                  type="button"
                  onClick={handleCreateTask}
                  disabled={!newTaskTitle.trim() || creatingTask}
                  className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {creatingTask ? <><Loader2 size={12} className="animate-spin" /> Creo…</> : "Crea"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
