import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  portalFetch,
} from "@workspace/api-client-react";
import { useTaskComments, useAddTaskComment } from "@/hooks/useTaskComments";
import { useTaskActivity } from "@/hooks/useTaskActivity";
import { Layout } from "@/components/layout/Layout";
import {
  Plus, Trash2, ChevronDown, ChevronRight, X, Pencil,
  CheckSquare, Square, ListChecks, BarChart2, ToggleLeft, ToggleRight,
  Columns3, List, MessageSquare, Activity, GripVertical,
} from "lucide-react";
import { cn, TASK_STATUS_LABELS, TASK_STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS, formatDate } from "@/lib/utils";
import { playTaskComplete } from "@/lib/sounds";
import { useToast } from "@/hooks/use-toast";
import { useTasks, type TaskRow } from "@/hooks/useTasks";
import { TaskFilters } from "@/components/tasks/TaskFilters";
import { TaskList } from "@/components/tasks/TaskList";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskDetail } from "@/components/tasks/TaskDetail";

// ─── Types ─────────────────────────────────────────────────────────────────
type ChecklistItem = {
  id: string;
  testo: string;
  completato: boolean;
  gruppo: string;
};

// ─── Categories ─────────────────────────────────────────────────────────────
const CATEGORIE = [
  "Onboarding Nuovo Cliente",
  "Piano Editoriale Mensile",
  "Setup Business Manager Meta",
  "Campagna ADV Meta",
  "Campagna ADV Google",
  "Report Cliente",
  "Personalizzata",
] as const;

const MESI = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const PACCHETTI = [
  { value: "4", label: "Base – 4 contenuti/mese" },
  { value: "8", label: "Standard – 8 contenuti/mese" },
  { value: "12", label: "Premium – 12 contenuti/mese" },
];
const TIPI_REPORT = ["Mensile", "Trimestrale", "Semestrale"];

const CATEGORIA_COLORS: Record<string, string> = {
  "Onboarding Nuovo Cliente": "bg-violet-100 text-violet-700",
  "Piano Editoriale Mensile": "bg-blue-100 text-blue-700",
  "Setup Business Manager Meta": "bg-orange-100 text-orange-700",
  "Campagna ADV Meta": "bg-blue-100 text-blue-800",
  "Campagna ADV Google": "bg-green-100 text-green-700",
  "Report Cliente": "bg-amber-100 text-amber-700",
  "Personalizzata": "bg-gray-100 text-gray-600",
};

// ─── Checklist Generators ───────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 9); }

function checklistOnboarding(): ChecklistItem[] {
  return [
    { id: uid(), testo: "Analisi gratuita", completato: false, gruppo: "" },
    { id: uid(), testo: "Meeting conoscitivo", completato: false, gruppo: "" },
    { id: uid(), testo: "Preventivo con portfolio", completato: false, gruppo: "" },
    { id: uid(), testo: "Contratto firmato", completato: false, gruppo: "" },
    { id: uid(), testo: "Drive condiviso creato (template)", completato: false, gruppo: "" },
    { id: uid(), testo: "Briefing con domande e obiettivi (Excel)", completato: false, gruppo: "" },
    { id: uid(), testo: "Facebook", completato: false, gruppo: "Credenziali ricevute o pagine create" },
    { id: uid(), testo: "Instagram", completato: false, gruppo: "Credenziali ricevute o pagine create" },
    { id: uid(), testo: "LinkedIn", completato: false, gruppo: "Credenziali ricevute o pagine create" },
    { id: uid(), testo: "TikTok", completato: false, gruppo: "Credenziali ricevute o pagine create" },
    { id: uid(), testo: "YouTube", completato: false, gruppo: "Credenziali ricevute o pagine create" },
    { id: uid(), testo: "Sito Web", completato: false, gruppo: "Credenziali ricevute o pagine create" },
    { id: uid(), testo: "Brand Kit Canva creato", completato: false, gruppo: "" },
    { id: uid(), testo: "Ricerca competitors completata", completato: false, gruppo: "" },
  ];
}

function checklistPianoEditoriale(mese: string, pacchetto: string): ChecklistItem[] {
  const n = pacchetto === "4" ? 4 : pacchetto === "12" ? 12 : 8;
  const stories = n * 2;
  const reel = Math.round(n / 2);
  return [
    { id: uid(), testo: `PED ${mese} - Piano editoriale creato`, completato: false, gruppo: "" },
    { id: uid(), testo: "Template Carosello", completato: false, gruppo: "Template grafici creati" },
    { id: uid(), testo: "Template Storia", completato: false, gruppo: "Template grafici creati" },
    { id: uid(), testo: "Template Post IG", completato: false, gruppo: "Template grafici creati" },
    { id: uid(), testo: `Contenuti Foto/Video creati (0 su ${n} post + ${stories} stories + ${reel} reel)`, completato: false, gruppo: "" },
    { id: uid(), testo: `Contenuti grafici creati (0 su ${n})`, completato: false, gruppo: "" },
    { id: uid(), testo: "Programmazione completata", completato: false, gruppo: "" },
    { id: uid(), testo: "Pubblicazioni verificate", completato: false, gruppo: "" },
    { id: uid(), testo: "Approvazione cliente ricevuta", completato: false, gruppo: "" },
  ];
}

function checklistSetupBM(): ChecklistItem[] {
  return [
    { id: uid(), testo: "Business Manager configurato", completato: false, gruppo: "" },
    { id: uid(), testo: "Check collegamento pagine Facebook/Instagram", completato: false, gruppo: "" },
    { id: uid(), testo: "Impostazioni di pagamento configurate", completato: false, gruppo: "" },
    { id: uid(), testo: "Pixel di Meta installato e verificato", completato: false, gruppo: "" },
    { id: uid(), testo: "Google Tag Manager installato", completato: false, gruppo: "" },
    { id: uid(), testo: "Google Analytics collegato e verificato", completato: false, gruppo: "" },
  ];
}

function checklistCampagnaMeta(): ChecklistItem[] {
  return [
    { id: uid(), testo: "Strategia campagna definita", completato: false, gruppo: "" },
    { id: uid(), testo: "Pubblici target creati (Tofu)", completato: false, gruppo: "" },
    { id: uid(), testo: "Pubblici retargeting creati (Bofu)", completato: false, gruppo: "" },
    { id: uid(), testo: "Creatività ads realizzate", completato: false, gruppo: "" },
    { id: uid(), testo: "Copy ads scritto e approvato", completato: false, gruppo: "" },
    { id: uid(), testo: "Campagna configurata su Meta Ads Manager", completato: false, gruppo: "" },
    { id: uid(), testo: "Pixel eventi verificati", completato: false, gruppo: "" },
    { id: uid(), testo: "Campagna attivata", completato: false, gruppo: "" },
    { id: uid(), testo: "Primo check performance (dopo 48h)", completato: false, gruppo: "" },
    { id: uid(), testo: "Ottimizzazione in corso", completato: false, gruppo: "" },
    { id: uid(), testo: "Report risultati", completato: false, gruppo: "" },
  ];
}

function checklistCampagnaGoogle(): ChecklistItem[] {
  return [
    { id: uid(), testo: "Ricerca e analisi parole chiave completata", completato: false, gruppo: "" },
    { id: uid(), testo: "Struttura campagna definita", completato: false, gruppo: "" },
    { id: uid(), testo: "Campagna principale creata", completato: false, gruppo: "" },
    { id: uid(), testo: "Campagna brand creata", completato: false, gruppo: "" },
    { id: uid(), testo: "Campagna competitors creata", completato: false, gruppo: "" },
    { id: uid(), testo: "Annunci scritti e approvati", completato: false, gruppo: "" },
    { id: uid(), testo: "Estensioni annunci configurate", completato: false, gruppo: "" },
    { id: uid(), testo: "Conversioni tracciate con GTM", completato: false, gruppo: "" },
    { id: uid(), testo: "Campagna attivata", completato: false, gruppo: "" },
    { id: uid(), testo: "Check performance iniziale", completato: false, gruppo: "" },
    { id: uid(), testo: "Report risultati", completato: false, gruppo: "" },
  ];
}

function checklistReport(): ChecklistItem[] {
  return [
    { id: uid(), testo: "Dati social raccolti (follower, reach, engagement)", completato: false, gruppo: "" },
    { id: uid(), testo: "Dati Meta Ads raccolti (spesa, risultati, ROAS)", completato: false, gruppo: "" },
    { id: uid(), testo: "Dati Google Ads raccolti (click, conversioni, CPC)", completato: false, gruppo: "" },
    { id: uid(), testo: "Grafici e tabelle preparati", completato: false, gruppo: "" },
    { id: uid(), testo: "Analisi risultati scritta", completato: false, gruppo: "" },
    { id: uid(), testo: "Confronto periodo precedente fatto", completato: false, gruppo: "" },
    { id: uid(), testo: "Raccomandazioni strategiche aggiunte", completato: false, gruppo: "" },
    { id: uid(), testo: "Report formattato e revisionato", completato: false, gruppo: "" },
    { id: uid(), testo: "Report inviato al cliente", completato: false, gruppo: "" },
    { id: uid(), testo: "Meeting di presentazione risultati fatto", completato: false, gruppo: "" },
  ];
}

function generateChecklist(categoria: string, mese = "", pacchetto = "8"): ChecklistItem[] {
  switch (categoria) {
    case "Onboarding Nuovo Cliente": return checklistOnboarding();
    case "Piano Editoriale Mensile": return checklistPianoEditoriale(mese || "Gennaio", pacchetto || "8");
    case "Setup Business Manager Meta": return checklistSetupBM();
    case "Campagna ADV Meta": return checklistCampagnaMeta();
    case "Campagna ADV Google": return checklistCampagnaGoogle();
    case "Report Cliente": return checklistReport();
    default: return [];
  }
}

// ─── Progress helpers ────────────────────────────────────────────────────────
function parseChecklist(json: string): ChecklistItem[] {
  try { return JSON.parse(json) as ChecklistItem[]; } catch { return []; }
}

function calcProgress(items: ChecklistItem[]) {
  if (items.length === 0) return { done: 0, total: 0, pct: 0 };
  const done = items.filter((i) => i.completato).length;
  return { done, total: items.length, pct: Math.round((done / items.length) * 100) };
}

function isOverdue(dueDate?: string | null, status?: string): boolean {
  if (!dueDate || status === "done") return false;
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

// ─── Progress Bar ────────────────────────────────────────────────────────────
function ProgressBar({ pct, className }: { pct: number; className?: string }) {
  const color = pct === 100 ? "bg-emerald-500" : pct >= 50 ? "bg-primary" : "bg-amber-400";
  return (
    <div className={cn("w-full h-1.5 rounded-full bg-muted overflow-hidden", className)}>
      <div className={cn("h-full rounded-full transition-all duration-300", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Checklist Modal ─────────────────────────────────────────────────────────
function ChecklistModal({ task, onClose, onToggle }: {
  task: TaskRow;
  onClose: () => void;
  onToggle: (itemId: string) => void;
}) {
  const items = parseChecklist(task.checklistJson);
  const { done, total, pct } = calcProgress(items);

  const groups: Record<string, ChecklistItem[]> = {};
  const ungrouped: ChecklistItem[] = [];
  items.forEach((item) => {
    if (item.gruppo) {
      if (!groups[item.gruppo]) groups[item.gruppo] = [];
      groups[item.gruppo].push(item);
    } else {
      ungrouped.push(item);
    }
  });

  const renderItem = (item: ChecklistItem) => (
    <label key={item.id} className="flex items-start gap-2.5 cursor-pointer group py-1.5 hover:bg-muted/30 rounded px-2 -mx-2">
      <button
        onClick={() => onToggle(item.id)}
        className={cn(
          "mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all",
          item.completato ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground/50 hover:border-primary"
        )}
      >
        {item.completato && <span className="text-white text-[9px] font-bold">✓</span>}
      </button>
      <span className={cn("text-sm leading-tight", item.completato && "line-through text-muted-foreground")}>
        {item.testo}
      </span>
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-card-border">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", CATEGORIA_COLORS[task.categoria ?? ""] ?? "bg-gray-100 text-gray-600")}>
                {task.categoria}
              </span>
              {task.meseRiferimento && (
                <span className="text-xs text-muted-foreground">{task.meseRiferimento}</span>
              )}
            </div>
            <h3 className="font-semibold text-base">{task.title}</h3>
            <div className="mt-2 flex items-center gap-3">
              <ProgressBar pct={pct} className="flex-1" />
              <span className="text-xs font-medium tabular-nums text-muted-foreground whitespace-nowrap">{done}/{total}</span>
              <span className="text-xs font-bold text-primary">{pct}%</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {ungrouped.map(renderItem)}
          {Object.entries(groups).map(([group, groupItems]) => (
            <div key={group}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 mt-3">{group}</p>
              <div className="pl-1">{groupItems.map(renderItem)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Editable Checklist Preview (in create form) ─────────────────────────────
function ChecklistEditor({ items, onChange }: {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
}) {
  const [newItemText, setNewItemText] = useState("");
  const dragIndexRef = useRef<number | null>(null);
  const groups: Record<string, ChecklistItem[]> = {};
  const ungrouped: ChecklistItem[] = [];
  items.forEach((item) => {
    if (item.gruppo) {
      if (!groups[item.gruppo]) groups[item.gruppo] = [];
      groups[item.gruppo].push(item);
    } else {
      ungrouped.push(item);
    }
  });

  const addItem = () => {
    const text = newItemText.trim();
    if (!text) return;
    onChange([...items, { id: uid(), testo: text, completato: false, gruppo: "" }]);
    setNewItemText("");
  };

  const removeItem = (id: string) => {
    onChange(items.filter((i) => i.id !== id));
  };

  const updateItem = (id: string, testo: string) => {
    onChange(items.map((i) => i.id === id ? { ...i, testo } : i));
  };

  const moveItem = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return;
    const next = [...items];
    const [picked] = next.splice(from, 1);
    next.splice(to, 0, picked);
    onChange(next);
  };

  const renderEditable = (item: ChecklistItem) => {
    const idx = items.findIndex((i) => i.id === item.id);
    return (
    <div
      key={item.id}
      className="flex items-center gap-2 py-1"
      draggable
      onDragStart={() => { dragIndexRef.current = idx; }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => {
        if (dragIndexRef.current != null) moveItem(dragIndexRef.current, idx);
        dragIndexRef.current = null;
      }}
    >
      <GripVertical size={13} className="text-muted-foreground/40 shrink-0" />
      <Square size={14} className="text-muted-foreground/40 shrink-0" />
      <input
        className="flex-1 text-sm border-0 border-b border-transparent focus:border-primary bg-transparent outline-none py-0.5"
        value={item.testo}
        onChange={(e) => updateItem(item.id, e.target.value)}
        placeholder="Voce checklist..."
      />
      <button onClick={() => removeItem(item.id)} className="text-muted-foreground/40 hover:text-destructive shrink-0">
        <X size={12} />
      </button>
    </div>
    );
  };

  return (
    <div className="mt-3 bg-muted/30 rounded-xl p-4 space-y-0.5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Checklist ({items.length} voci)</p>
        <span className="text-[11px] text-muted-foreground">drag & drop per riordinare</span>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <input
          className="flex-1 px-2.5 py-1.5 text-xs border border-input rounded-lg bg-background"
          placeholder="Nuova voce checklist..."
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
        />
        <button onClick={addItem} className="text-xs text-primary hover:underline flex items-center gap-1">
          <Plus size={11} /> Add item
        </button>
      </div>
      {ungrouped.map(renderEditable)}
      {Object.entries(groups).map(([group, groupItems]) => (
        <div key={group}>
          <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wide mt-3 mb-1">{group}</p>
          {groupItems.map(renderEditable)}
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
const EMPTY_FORM = {
  title: "",
  description: "",
  projectId: "" as string,
  assigneeId: "" as string,
  status: "todo",
  priority: "medium",
  dueDate: "",
  taskType: "semplice" as "semplice" | "avanzata",
  categoria: "Onboarding Nuovo Cliente",
  meseRiferimento: MESI[new Date().getMonth()],
  pacchettoContenuti: "8",
  tipoReport: "Mensile",
};

export default function Tasks() {
  const { toast } = useToast();
  const {
    activeClient,
    activeTemplate,
    isLoading,
    taskList,
    memberList,
    scopedProjectList,
    scopedProjectIds,
    hasScopedProjects,
    createTask,
    updateTask,
    deleteTask,
    listTasksKey,
    applyTaskCacheUpdate,
    addActivity,
    queryClient: qc,
  } = useTasks();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [detailTask, setDetailTask] = useState<TaskRow | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "kanban">(() => (localStorage.getItem("tasks-view") as any) || "list");
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const draggedTaskRef = useRef<number | null>(null);
  const detailTaskId = detailTask?.id ?? null;
  const {
    data: taskComments = [],
    isLoading: isCommentsLoading,
    error: commentsError,
  } = useTaskComments(detailTaskId);
  const addTaskComment = useAddTaskComment(detailTaskId);
  const {
    data: taskActivity = [],
    isLoading: isActivityLoading,
    error: activityError,
  } = useTaskActivity(detailTaskId);

  const handleCategoriaChange = useCallback((cat: string) => {
    setForm((f) => ({ ...f, categoria: cat }));
    const items =
      cat === "Report Cliente" && activeTemplate
        ? activeTemplate.reportChecklist.map((text) => ({ id: uid(), testo: text, completato: false, gruppo: "" }))
        : generateChecklist(cat, form.meseRiferimento, form.pacchettoContenuti);
    setChecklist(items);
  }, [form.meseRiferimento, form.pacchettoContenuti, activeTemplate]);

  const handleMeseChange = (mese: string) => {
    setForm((f) => ({ ...f, meseRiferimento: mese }));
    if (form.categoria === "Piano Editoriale Mensile") {
      setChecklist(generateChecklist("Piano Editoriale Mensile", mese, form.pacchettoContenuti));
    }
  };

  const handlePacchettoChange = (p: string) => {
    setForm((f) => ({ ...f, pacchettoContenuti: p }));
    if (form.categoria === "Piano Editoriale Mensile") {
      setChecklist(generateChecklist("Piano Editoriale Mensile", form.meseRiferimento, p));
    }
  };

  const handleTaskTypeToggle = (type: "semplice" | "avanzata") => {
    setForm((f) => ({ ...f, taskType: type }));
    if (type === "avanzata") {
      setChecklist(generateChecklist(form.categoria, form.meseRiferimento, form.pacchettoContenuti));
    }
  };

  const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  const STATUS_ORDER: Record<string, number> = { todo: 0, "in-progress": 1, review: 2, done: 3 };

  const filtered = useMemo(() => {
    const list = taskList.filter((t) => {
      const matchActiveClient = !hasScopedProjects || (t.projectId != null && scopedProjectIds.has(Number(t.projectId)));
      const matchSearch = String(t?.title ?? "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = !filterStatus || t.status === filterStatus;
      const matchPriority = !filterPriority || t.priority === filterPriority;
      const matchTipo = !filterTipo || t.tipo === filterTipo;
      const matchCategory = !filterCategory || (t.categoria ?? "") === filterCategory;
      const matchProject = !filterProject || String(t.projectId) === filterProject;
      const matchAssignee = !filterAssignee || String(t.assigneeId) === filterAssignee;
      const matchDateFrom = !filterDateFrom || (t.dueDate && t.dueDate >= filterDateFrom);
      const matchDateTo = !filterDateTo || (t.dueDate && t.dueDate <= filterDateTo);
      return matchActiveClient && matchSearch && matchStatus && matchPriority && matchTipo && matchCategory && matchProject && matchAssignee && matchDateFrom && matchDateTo;
    }) ?? [];
    return list.sort((a, b) => {
      const statusA = STATUS_ORDER[a.status] ?? 1;
      const statusB = STATUS_ORDER[b.status] ?? 1;
      if (statusA !== statusB) return statusA - statusB;
      const prioA = PRIORITY_ORDER[a.priority] ?? 2;
      const prioB = PRIORITY_ORDER[b.priority] ?? 2;
      return prioA - prioB;
    });
  }, [taskList, hasScopedProjects, scopedProjectIds, search, filterStatus, filterPriority, filterTipo, filterCategory, filterProject, filterAssignee, filterDateFrom, filterDateTo]);
  const hasActiveFilters =
    !!(
      filterProject ||
      filterAssignee ||
      filterDateFrom ||
      filterDateTo ||
      filterStatus ||
      filterPriority ||
      filterTipo ||
      filterCategory ||
      search
    );

  useEffect(() => {
    if (!filterProject) return;
    const stillVisible = scopedProjectList.some((p: any) => String(p?.id) === filterProject);
    if (!stillVisible) setFilterProject("");
  }, [filterProject, scopedProjectList]);

  useEffect(() => {
    const validIds = new Set(taskList.map((t) => t.id));
    setSelectedTaskIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [taskList]);

  const handleOpenEdit = (task: TaskRow) => {
    setEditId(task.id);
    setForm({
      title: task.title,
      description: task.description ?? "",
      projectId: task.projectId ? String(task.projectId) : "",
      assigneeId: task.assigneeId ? String(task.assigneeId) : "",
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ?? "",
      taskType: task.tipo === "avanzata" ? "avanzata" : "semplice",
      categoria: task.categoria ?? "Onboarding Nuovo Cliente",
      meseRiferimento: task.meseRiferimento ?? MESI[new Date().getMonth()],
      pacchettoContenuti: task.pacchettoContenuti ?? "8",
      tipoReport: "Mensile",
    });
    setChecklist(task.tipo === "avanzata" ? parseChecklist(task.checklistJson) : []);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.title.trim()) return;
    const isAvanzata = form.taskType === "avanzata";
    const payload = {
      title: form.title,
      description: form.description || null,
      projectId: form.projectId ? Number(form.projectId) : null,
      assigneeId: form.assigneeId ? Number(form.assigneeId) : null,
      status: form.status,
      priority: form.priority,
      dueDate: form.dueDate || null,
      tipo: isAvanzata ? "avanzata" : "semplice",
      categoria: isAvanzata ? form.categoria : null,
      checklistJson: isAvanzata ? JSON.stringify(checklist) : "[]",
      pacchettoContenuti: isAvanzata && form.categoria === "Piano Editoriale Mensile" ? form.pacchettoContenuti : null,
      meseRiferimento: isAvanzata && form.categoria === "Piano Editoriale Mensile" ? form.meseRiferimento : null,
    };

    const onDone = () => {
      if (editId) void addActivity(editId, "Task aggiornata", form.title.trim());
      setShowForm(false);
      setEditId(null);
      setForm(EMPTY_FORM);
      setChecklist([]);
    };

    if (editId) {
      updateTask.mutate(
        { id: editId, data: payload },
        {
          onSuccess: (updated: any) => {
            if (updated?.id != null) {
              applyTaskCacheUpdate((list) => list.map((t) => (t.id === updated.id ? { ...(t as any), ...updated } : t)));
            }
            qc.invalidateQueries({ queryKey: listTasksKey });
            toast({ title: "Task aggiornata" });
            onDone();
          },
          onError: (err: any) => {
            toast({
              variant: "destructive",
              title: "Salvataggio task non riuscito",
              description: err?.data?.error || "Controlla i dati inseriti e riprova.",
            });
          },
        },
      );
    } else {
      createTask.mutate({
        data: payload,
      }, {
        onSuccess: (created: any) => {
          if (created?.id != null) {
            applyTaskCacheUpdate((list) => [created as TaskRow, ...list]);
          }
          if (created?.id) void addActivity(created.id, "Task creata", created?.title ?? form.title.trim());
          qc.invalidateQueries({ queryKey: listTasksKey });
          toast({ title: "Task creata con successo" });
          onDone();
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Creazione task non riuscita",
            description: err?.data?.error || "Controlla i dati inseriti e riprova.",
          });
        },
      });
    }
  };

  const handleStatusChange = (id: number, newStatus: string) => {
    updateTask.mutate(
      { id, data: { status: newStatus } },
      {
        onSuccess: () => {
          applyTaskCacheUpdate((list) => list.map((t) => (t.id === id ? { ...t, status: newStatus } : t)));
          qc.invalidateQueries({ queryKey: listTasksKey });
          void addActivity(id, `Stato cambiato in ${TASK_STATUS_LABELS[newStatus] ?? newStatus}`);
          if (newStatus === "done") playTaskComplete();
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Aggiornamento stato non riuscito",
          });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    if (!confirm("Eliminare questo task?")) return;
    deleteTask.mutate(
      { id },
      {
        onSuccess: async () => {
          applyTaskCacheUpdate((list) => list.filter((t) => t.id !== id));
          await qc.invalidateQueries({ queryKey: listTasksKey });
          setSelectedTaskIds((prev) => prev.filter((x) => x !== id));
          toast({ title: "Task spostato nel cestino" });
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Eliminazione task non riuscita",
          });
        },
      },
    );
  };

  const allFilteredTaskIds = filtered.map((t) => Number(t.id)).filter((id) => Number.isFinite(id));
  const allTasksSelected = allFilteredTaskIds.length > 0 && allFilteredTaskIds.every((id) => selectedTaskIds.includes(id));

  const toggleTaskSelection = (id: number, checked: boolean) => {
    setSelectedTaskIds((prev) => checked ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id));
  };

  const toggleSelectAllTasks = (checked: boolean) => {
    if (!checked) {
      setSelectedTaskIds((prev) => prev.filter((id) => !allFilteredTaskIds.includes(id)));
      return;
    }
    setSelectedTaskIds((prev) => Array.from(new Set([...prev, ...allFilteredTaskIds])));
  };

  const handleBulkDeleteTasks = async () => {
    if (selectedTaskIds.length === 0) return;
    const ok = confirm(`Eliminare ${selectedTaskIds.length} task selezionati?`);
    if (!ok) return;

    const idsToDelete = [...selectedTaskIds];
    const results = await Promise.allSettled(
      idsToDelete.map((id) => portalFetch(`/api/tasks/${id}`, { method: "DELETE", credentials: "include" }))
    );
    const failedIds: number[] = [];
    let success = 0;
    results.forEach((r, idx) => {
      if (r.status === "fulfilled" && r.value.ok) {
        success += 1;
      } else {
        failedIds.push(idsToDelete[idx]);
      }
    });
    const failed = failedIds.length;

    if (success > 0) {
      await qc.invalidateQueries({ queryKey: listTasksKey });
    }

    if (failed > 0) {
      setSelectedTaskIds(failedIds);
      toast({
        variant: "destructive",
        title: "Eliminazione parziale task",
        description: `${success} eliminati, ${failed} non eliminati. Ho lasciato selezionati quelli falliti.`,
      });
      return;
    }
    setSelectedTaskIds([]);
    toast({ title: `${success} task eliminati` });
  };

  const handleToggleChecklistItem = (task: TaskRow, itemId: string) => {
    const items = parseChecklist(task.checklistJson).map((i) =>
      i.id === itemId ? { ...i, completato: !i.completato } : i
    );
    const newJson = JSON.stringify(items);
    // Optimistic update detail task
    setDetailTask((prev) => prev ? { ...prev, checklistJson: newJson } : null);
    updateTask.mutate(
      { id: task.id, data: { checklistJson: newJson } as any },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: listTasksKey });
          void addActivity(task.id, "Checklist aggiornata", task.title);
        },
      }
    );
  };

  const handleAddComment = () => {
    if (!detailTask || !commentDraft.trim()) return;
    addTaskComment.mutate(
      {
        authorName: "Team",
        content: commentDraft.trim(),
      },
      {
        onSuccess: async () => {
          void addActivity(detailTask.id, "Commento aggiunto", detailTask.title);
          setCommentDraft("");
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Commento non inviato",
            description: "Riprova tra qualche secondo.",
          });
        },
      },
    );
  };

  const handleOpenDetail = (task: TaskRow) => {
    if (task.tipo !== "avanzata") return;
    setDetailTask(task);
  };

  return (
    <Layout>
      <div className="p-4 md:p-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Task</h1>
            <p className="text-muted-foreground text-sm mt-1">{taskList.length} task totali</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <button
                onClick={() => { setViewMode("list"); localStorage.setItem("tasks-view", "list"); }}
                className={cn("p-1.5 rounded-md transition-all", viewMode === "list" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
                title="Vista lista"
              >
                <List size={15} />
              </button>
              <button
                onClick={() => { setViewMode("kanban"); localStorage.setItem("tasks-view", "kanban"); }}
                className={cn("p-1.5 rounded-md transition-all", viewMode === "kanban" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
                title="Vista kanban"
              >
                <Columns3 size={15} />
              </button>
            </div>
            <button
              onClick={() => { setEditId(null); setShowForm(!showForm); setForm(EMPTY_FORM); setChecklist([]); }}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity w-full sm:w-auto"
            >
              <Plus size={16} />
              Nuovo Task
            </button>
          </div>
        </div>

        {/* Create Form */}
        {showForm && (
          <div className="bg-card border border-card-border rounded-xl p-6 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">{editId ? "Modifica Task" : "Nuovo Task"}</h2>
              {/* Task type toggle */}
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                <button
                  onClick={() => handleTaskTypeToggle("semplice")}
                  className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all", form.taskType === "semplice" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  Semplice
                </button>
                <button
                  onClick={() => handleTaskTypeToggle("avanzata")}
                  className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5", form.taskType === "avanzata" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  <ListChecks size={12} />
                  Avanzata con checklist
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Titolo *</label>
                <input
                  className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Titolo task"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>

              {form.taskType === "avanzata" && (
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Categoria *</label>
                  <select
                    className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none"
                    value={form.categoria}
                    onChange={(e) => handleCategoriaChange(e.target.value)}
                  >
                    {CATEGORIE.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}

              {form.taskType === "avanzata" && form.categoria === "Piano Editoriale Mensile" && (
                <>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Mese di riferimento</label>
                    <select className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" value={form.meseRiferimento} onChange={(e) => handleMeseChange(e.target.value)}>
                      {MESI.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Pacchetto contenuti</label>
                    <select className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" value={form.pacchettoContenuti} onChange={(e) => handlePacchettoChange(e.target.value)}>
                      {PACCHETTI.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                </>
              )}

              {form.taskType === "avanzata" && form.categoria === "Report Cliente" && (
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Tipo report</label>
                  <select className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" value={form.tipoReport} onChange={(e) => setForm({ ...form, tipoReport: e.target.value })}>
                    {TIPI_REPORT.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {activeTemplate && (
                    <p className="mt-1 text-[11px] text-violet-700">
                      Checklist report template {activeTemplate.label} applicata automaticamente.
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-muted-foreground">Progetto</label>
                <select className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
                  <option value="">Nessun progetto</option>
                  {scopedProjectList.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Assegnato a</label>
                <select className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}>
                  <option value="">Nessuno</option>
                  {memberList.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Stato</label>
                <select className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {Object.entries(TASK_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Priorita</label>
                <select className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Scadenza</label>
                <input type="date" className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Descrizione (opzionale)</label>
                <input className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" placeholder="Descrizione..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>

            {/* Checklist editor for advanced tasks */}
            {form.taskType === "avanzata" && (
              <ChecklistEditor items={checklist} onChange={setChecklist} />
            )}

            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <button onClick={handleSave} disabled={createTask.isPending || updateTask.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {createTask.isPending || updateTask.isPending ? "Salvataggio..." : editId ? "Aggiorna Task" : "Crea Task"}
              </button>
              <button onClick={() => { setShowForm(false); setEditId(null); setForm(EMPTY_FORM); setChecklist([]); }} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:opacity-80">Annulla</button>
            </div>
          </div>
        )}

        <TaskFilters
          filteredCount={filtered.length}
          showMobileFilters={showMobileFilters}
          onToggleMobileFilters={() => setShowMobileFilters((v) => !v)}
          search={search}
          onSearchChange={setSearch}
          filterTipo={filterTipo}
          onFilterTipoChange={setFilterTipo}
          filterCategory={filterCategory}
          onFilterCategoryChange={setFilterCategory}
          categories={CATEGORIE}
          filterStatus={filterStatus}
          onFilterStatusChange={setFilterStatus}
          filterPriority={filterPriority}
          onFilterPriorityChange={setFilterPriority}
          filterProject={filterProject}
          onFilterProjectChange={setFilterProject}
          projectOptions={scopedProjectList as Array<{ id: number | string; name: string }>}
          filterAssignee={filterAssignee}
          onFilterAssigneeChange={setFilterAssignee}
          assigneeOptions={memberList as Array<{ id: number | string; name: string; surname?: string | null }>}
          filterDateFrom={filterDateFrom}
          onFilterDateFromChange={setFilterDateFrom}
          filterDateTo={filterDateTo}
          onFilterDateToChange={setFilterDateTo}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={() => {
            setSearch("");
            setFilterStatus("");
            setFilterPriority("");
            setFilterTipo("");
            setFilterCategory("");
            setFilterProject("");
            setFilterAssignee("");
            setFilterDateFrom("");
            setFilterDateTo("");
          }}
        />

        {selectedTaskIds.length > 0 && (
          <div className="fixed bottom-4 left-4 right-4 md:static md:mb-4 md:left-auto md:right-auto z-40 md:z-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 shadow-lg md:shadow-none">
              <p className="text-sm text-amber-900">{selectedTaskIds.length} task selezionati</p>
              <button onClick={handleBulkDeleteTasks} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700">
                <Trash2 size={13} />
                Elimina selezionati
              </button>
            </div>
          </div>
        )}

        {/* Task list / Kanban */}
        {isLoading ? (
          <div className="text-center text-muted-foreground py-12">Caricamento...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">Nessun task trovato</div>
        ) : viewMode === "kanban" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {(["todo", "in-progress", "review", "done"] as const).map((status) => {
              const colTasks = filtered.filter((t) => t.status === status);
              return (
                <div
                  key={status}
                  className="bg-muted/30 rounded-xl p-3 min-h-[300px]"
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("ring-2", "ring-primary/40"); }}
                  onDragLeave={(e) => { e.currentTarget.classList.remove("ring-2", "ring-primary/40"); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove("ring-2", "ring-primary/40");
                    if (draggedTaskRef.current != null) {
                      handleStatusChange(draggedTaskRef.current, status);
                      draggedTaskRef.current = null;
                    }
                  }}
                >
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <span className={cn("w-2.5 h-2.5 rounded-full", status === "todo" ? "bg-gray-400" : status === "in-progress" ? "bg-blue-500" : status === "review" ? "bg-amber-500" : "bg-emerald-500")} />
                    <span className="text-sm font-semibold">{TASK_STATUS_LABELS[status]}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{colTasks.length}</span>
                    <button
                      className="p-1 rounded hover:bg-muted"
                      title="Aggiungi task in questa colonna"
                      onClick={() => {
                        setShowForm(true);
                        setEditId(null);
                        setChecklist([]);
                        setForm({ ...EMPTY_FORM, status });
                      }}
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {colTasks.map((t) => {
                      const task = t as TaskRow;
                      return (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onDragStart={() => { draggedTaskRef.current = task.id; }}
                          onDragEnd={() => { draggedTaskRef.current = null; }}
                          selected={selectedTaskIds.includes(task.id)}
                          onToggleSelection={(checked) => toggleTaskSelection(task.id, checked)}
                          onOpenEdit={() => handleOpenEdit(task)}
                          parseChecklist={parseChecklist}
                          calcProgress={calcProgress}
                          ProgressBar={ProgressBar}
                          isOverdue={isOverdue}
                          categoryColors={CATEGORIA_COLORS}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <TaskList
            filtered={filtered}
            selectedTaskIds={selectedTaskIds}
            toggleTaskSelection={toggleTaskSelection}
            allTasksSelected={allTasksSelected}
            toggleSelectAllTasks={toggleSelectAllTasks}
            parseChecklist={parseChecklist}
            calcProgress={calcProgress}
            isOverdue={isOverdue}
            handleOpenEdit={handleOpenEdit}
            handleOpenDetail={handleOpenDetail}
            handleDelete={handleDelete}
            ProgressBar={ProgressBar}
          />
        )}
      </div>

      <TaskDetail
        detailTask={detailTask}
        setDetailTask={setDetailTask}
        handleStatusChange={handleStatusChange}
        updateTask={updateTask}
        queryClient={qc}
        listTasksKey={listTasksKey}
        addActivity={addActivity}
        parseChecklist={parseChecklist}
        handleToggleChecklistItem={handleToggleChecklistItem}
        taskActivity={taskActivity}
        isActivityLoading={isActivityLoading}
        activityError={activityError}
        commentDraft={commentDraft}
        setCommentDraft={setCommentDraft}
        handleAddComment={handleAddComment}
        addTaskComment={addTaskComment}
        taskComments={taskComments}
        isCommentsLoading={isCommentsLoading}
        commentsError={commentsError}
      />
    </Layout>
  );
}
