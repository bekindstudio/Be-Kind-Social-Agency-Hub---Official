import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Sparkles,
  ListTodo,
  Users,
  CalendarRange,
  X,
} from "lucide-react";
import type { TaskFormState } from "./TaskForm";
import {
  ChecklistEditor,
  type ChecklistItem,
  CATEGORIE,
  MESI,
  PACCHETTI,
  TIPI_REPORT,
} from "./TaskChecklist";

/**
 * Wizard "Nuova Task" in stile Typeform. Stesso pattern di ProjectWizard /
 * OnboardingWizard: 1 macro-domanda per step, draft su localStorage, validazione
 * inline, "Crea + nuovo" per quick capture in batch.
 */

type Step = 0 | 1 | 2 | 3;
const DRAFT_KEY = "bekind:task-wizard-draft";

const STEPS: { key: Step; label: string; icon: typeof ListTodo; question: string; hint: string }[] = [
  { key: 0, label: "Essenziale", icon: ListTodo, question: "Di cosa si tratta questa task?", hint: "Titolo e progetto (opzionale). Tutto il resto puoi metterlo dopo." },
  { key: 1, label: "Chi & Priorità", icon: Users, question: "Chi la fa e quanto urge?", hint: "Assegnato, priorità, stato. Lascia 'Non assegnato' se ancora da decidere." },
  { key: 2, label: "Scadenza", icon: CalendarRange, question: "Quando va consegnata?", hint: "Data, descrizione, e — se è una task strutturata — categoria avanzata." },
  { key: 3, label: "Conferma", icon: Sparkles, question: "Tutto pronto?", hint: "Riepilogo + checklist (se avanzata). Crea, o 'Crea + nuova' per batch." },
];

const STATUS_OPTIONS = [
  { value: "todo", label: "Da fare" },
  { value: "in_progress", label: "In corso" },
  { value: "in_review", label: "In revisione" },
  { value: "done", label: "Fatto" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Bassa", color: "bg-zinc-100 text-zinc-700 border-zinc-300" },
  { value: "medium", label: "Media", color: "bg-amber-100 text-amber-700 border-amber-300" },
  { value: "high", label: "Alta", color: "bg-red-100 text-red-700 border-red-300" },
  { value: "urgent", label: "Urgente", color: "bg-rose-200 text-rose-900 border-rose-400" },
];

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: { form: TaskFormState; checklist: ChecklistItem[] }, opts?: { resetAfter?: boolean }) => Promise<void>;
  isSubmitting: boolean;
  projectOptions: Array<{ id: number | string; name: string }>;
  memberOptions: Array<{ id: number | string; name?: string | null; surname?: string | null; email?: string | null }>;
};

function initialForm(): TaskFormState {
  return {
    title: "",
    description: "",
    projectId: "",
    assigneeId: "",
    status: "todo",
    priority: "medium",
    dueDate: "",
    taskType: "semplice",
    categoria: "Onboarding Nuovo Cliente",
    meseRiferimento: MESI[new Date().getMonth()],
    pacchettoContenuti: "8",
    tipoReport: "Mensile",
  };
}

function memberLabel(m: Props["memberOptions"][number]): string {
  const full = [m.name, m.surname].filter(Boolean).join(" ").trim();
  return full || m.email || `#${m.id}`;
}

export function TaskWizard({ open, onClose, onCreate, isSubmitting, projectOptions, memberOptions }: Props) {
  const [step, setStep] = useState<Step>(0);
  const [form, setForm] = useState<TaskFormState>(initialForm());
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);

  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft?.form) setForm({ ...initialForm(), ...draft.form });
        if (Array.isArray(draft?.checklist)) setChecklist(draft.checklist);
      }
    } catch { /* ignore */ }
    setStep(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!form.title && !form.projectId) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, checklist }));
    } catch { /* ignore */ }
  }, [form, checklist, open]);

  const setField = <K extends keyof TaskFormState>(k: K, v: TaskFormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const projectName = useMemo(() => {
    const p = projectOptions.find((x) => String(x.id) === form.projectId);
    return p?.name ?? "";
  }, [projectOptions, form.projectId]);

  const assigneeName = useMemo(() => {
    const m = memberOptions.find((x) => String(x.id) === form.assigneeId);
    return m ? memberLabel(m) : "";
  }, [memberOptions, form.assigneeId]);

  const canAdvance = (): boolean => {
    if (step === 0) return form.title.trim().length >= 2;
    return true;
  };

  const reset = () => {
    setForm(initialForm());
    setChecklist([]);
    setStep(0);
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  };

  const submit = async (createMore: boolean) => {
    if (isSubmitting) return;
    await onCreate({ form, checklist }, { resetAfter: createMore });
    if (createMore) {
      reset();
    } else {
      reset();
      onClose();
    }
  };

  const next = () => {
    if (!canAdvance() || isSubmitting) return;
    if (step === 3) {
      void submit(false);
      return;
    }
    setStep((s) => (s + 1) as Step);
  };

  const back = () => {
    if (step === 0) return;
    setStep((s) => (s - 1) as Step);
  };

  if (!open) return null;
  const current = STEPS[step];
  const Icon = current.icon;
  const progress = Math.round(((step + 1) / STEPS.length) * 100);
  const isAvanzata = form.taskType === "avanzata";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-card-border overflow-hidden flex flex-col max-h-[92vh]">
        <div className="relative">
          <div className="absolute top-0 left-0 h-1 bg-primary transition-all" style={{ width: `${progress}%` }} />
          <div className="px-6 pt-6 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center">
                <Icon size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
                  Step {step + 1} di {STEPS.length} · {current.label}
                </p>
                <h2 className="font-bold text-lg leading-tight">{current.question}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{current.hint}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground" aria-label="Chiudi">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Titolo *</label>
                <input
                  autoFocus
                  value={form.title}
                  onChange={(e) => setField("title", e.target.value)}
                  placeholder="Es. Editing video Reels - Sofia Tinti"
                  className="w-full mt-1 px-4 py-3 text-base border border-input rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                  onKeyDown={(e) => { if (e.key === "Enter" && canAdvance()) next(); }}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Progetto (opzionale)</label>
                <select
                  value={form.projectId}
                  onChange={(e) => setField("projectId", e.target.value)}
                  className="w-full mt-1 px-4 py-3 text-sm border border-input rounded-xl bg-background"
                >
                  <option value="">Nessun progetto (task generale)</option>
                  {projectOptions.map((p) => (
                    <option key={p.id} value={String(p.id)}>{p.name}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Lascia "Nessun progetto" per task interne (acquisti, meeting, scadenze personali…). La trovi comunque in Tasks col badge <span className="px-1 py-0.5 rounded bg-zinc-200 text-zinc-700 text-[10px] font-semibold">Generale</span>.
                </p>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Descrizione (opzionale)</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                  placeholder="Brief, link di riferimento, contesto…"
                  className="w-full mt-1 px-4 py-3 text-sm border border-input rounded-xl bg-background resize-none"
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Assegnata a</label>
                <select
                  value={form.assigneeId}
                  onChange={(e) => setField("assigneeId", e.target.value)}
                  className="w-full mt-1 px-4 py-3 text-sm border border-input rounded-xl bg-background"
                >
                  <option value="">Non assegnata</option>
                  {memberOptions.map((m) => (
                    <option key={m.id} value={String(m.id)}>{memberLabel(m)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Priorità</label>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PRIORITY_OPTIONS.map((opt) => {
                    const active = form.priority === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setField("priority", opt.value)}
                        className={cn(
                          "px-3 py-2 text-sm rounded-xl border transition-colors",
                          active ? `${opt.color} font-semibold` : "bg-background border-input hover:bg-muted"
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Stato iniziale</label>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {STATUS_OPTIONS.map((opt) => {
                    const active = form.status === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setField("status", opt.value)}
                        className={cn(
                          "px-3 py-2 text-sm rounded-xl border transition-colors",
                          active ? "bg-primary/10 border-primary text-primary font-semibold" : "bg-background border-input hover:bg-muted"
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-xl border border-card-border p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Tipo task</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setField("taskType", "semplice")}
                    className={cn(
                      "px-3 py-2 text-sm rounded-lg border text-left",
                      form.taskType === "semplice" ? "bg-primary/10 border-primary text-primary font-semibold" : "bg-background border-input"
                    )}
                  >
                    <p className="font-semibold">Semplice</p>
                    <p className="text-[11px] text-muted-foreground">Solo titolo + scadenza</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setField("taskType", "avanzata")}
                    className={cn(
                      "px-3 py-2 text-sm rounded-lg border text-left",
                      form.taskType === "avanzata" ? "bg-primary/10 border-primary text-primary font-semibold" : "bg-background border-input"
                    )}
                  >
                    <p className="font-semibold">Avanzata</p>
                    <p className="text-[11px] text-muted-foreground">Categoria + checklist</p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Scadenza</label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setField("dueDate", e.target.value)}
                  className="w-full mt-1 px-4 py-3 text-sm border border-input rounded-xl bg-background"
                />
              </div>

              {isAvanzata && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Categoria</label>
                    <select
                      value={form.categoria}
                      onChange={(e) => setField("categoria", e.target.value)}
                      className="w-full mt-1 px-4 py-3 text-sm border border-input rounded-xl bg-background"
                    >
                      {CATEGORIE.map((c: string) => <option key={c}>{c}</option>)}
                    </select>
                  </div>

                  {form.categoria === "Piano Editoriale Mensile" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mese</label>
                        <select
                          value={form.meseRiferimento}
                          onChange={(e) => setField("meseRiferimento", e.target.value)}
                          className="w-full mt-1 px-4 py-3 text-sm border border-input rounded-xl bg-background"
                        >
                          {MESI.map((m: string) => <option key={m}>{m}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pacchetto</label>
                        <select
                          value={form.pacchettoContenuti}
                          onChange={(e) => setField("pacchettoContenuti", e.target.value)}
                          className="w-full mt-1 px-4 py-3 text-sm border border-input rounded-xl bg-background"
                        >
                          {PACCHETTI.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {form.categoria === "Report Cliente" && (
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipo report</label>
                      <select
                        value={form.tipoReport}
                        onChange={(e) => setField("tipoReport", e.target.value)}
                        className="w-full mt-1 px-4 py-3 text-sm border border-input rounded-xl bg-background"
                      >
                        {TIPI_REPORT.map((t: string) => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                  )}
                </>
              )}

              <div className="rounded-xl bg-muted/30 p-3 text-xs text-muted-foreground">
                Suggerimento: lascia vuota la scadenza se è un'idea da capire poi.
                {!isAvanzata && " Per checklist multi-step, torna allo step 2 e scegli 'Avanzata'."}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-card-border bg-muted/30 p-4 space-y-2">
                <h3 className="font-semibold text-sm">Riepilogo</h3>
                <Row label="Titolo" value={form.title || "—"} />
                {projectName && <Row label="Progetto" value={projectName} />}
                {assigneeName && <Row label="Assegnata" value={assigneeName} />}
                <Row label="Priorità" value={PRIORITY_OPTIONS.find((p) => p.value === form.priority)?.label ?? form.priority} />
                <Row label="Stato" value={STATUS_OPTIONS.find((s) => s.value === form.status)?.label ?? form.status} />
                {form.dueDate && <Row label="Scadenza" value={new Date(form.dueDate).toLocaleDateString("it-IT")} />}
                <Row label="Tipo" value={isAvanzata ? `Avanzata · ${form.categoria}` : "Semplice"} />
              </div>

              {isAvanzata && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Checklist</h4>
                  <ChecklistEditor items={checklist} onChange={setChecklist} />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-card-border bg-muted/30 flex items-center justify-between gap-2">
          <button
            onClick={back}
            disabled={step === 0 || isSubmitting}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-40"
          >
            <ArrowLeft size={14} /> Indietro
          </button>
          <button
            onClick={reset}
            disabled={isSubmitting}
            className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
            title="Azzera bozza"
          >
            Azzera bozza
          </button>
          <div className="flex items-center gap-2">
            {step === 3 && (
              <button
                onClick={() => void submit(true)}
                disabled={!canAdvance() || isSubmitting}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border border-input text-foreground hover:bg-muted disabled:opacity-40"
                title="Crea e apri un nuovo wizard per un'altra task"
              >
                Crea + nuova
              </button>
            )}
            <button
              onClick={next}
              disabled={!canAdvance() || isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? (
                <><Loader2 size={14} className="animate-spin" /> Creo…</>
              ) : step === 3 ? (
                <><Check size={14} /> Crea task</>
              ) : (
                <>Avanti <ArrowRight size={14} /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
