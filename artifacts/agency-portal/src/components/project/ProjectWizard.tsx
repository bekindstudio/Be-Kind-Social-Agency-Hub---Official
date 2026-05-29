import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  FolderKanban,
  Loader2,
  Sparkles,
  Target,
  Users,
  CalendarRange,
  X,
} from "lucide-react";

/**
 * Wizard "Nuovo Progetto" in stile Typeform: una domanda principale per step,
 * niente sovraccarico, draft persistito su localStorage così se l'utente esce
 * non perde i dati. Stesso pattern UX di OnboardingWizard.
 */

type Step = 0 | 1 | 2 | 3 | 4;

const STEPS: { key: Step; label: string; icon: typeof FolderKanban; question: string; hint?: string }[] = [
  { key: 0, label: "Essenziale", icon: FolderKanban, question: "Cominciamo dalle basi", hint: "Solo nome e cliente. Tutto il resto è opzionale." },
  { key: 1, label: "Tipo", icon: Target, question: "Di che tipo di progetto si tratta?", hint: "Puoi selezionarne più d'uno." },
  { key: 2, label: "Timeline", icon: CalendarRange, question: "Quando va consegnato?", hint: "Date e budget — opzionali ma utili per le scadenze." },
  { key: 3, label: "Team", icon: Users, question: "Chi ci lavora?", hint: "Project manager + membri del team. Puoi cambiarli dopo." },
  { key: 4, label: "Conferma", icon: Sparkles, question: "Tutto pronto?", hint: "Controlla, scegli le automazioni e crea." },
];

const TYPE_OPTIONS = [
  "Social Media",
  "ADV Meta",
  "ADV Google",
  "Web",
  "Branding",
  "SEO",
  "Email Marketing",
  "Altro",
];

const PAYMENT_OPTIONS = [
  "Una tantum",
  "Mensile ricorrente",
  "A milestone",
  "A ore",
];

type FormState = {
  name: string;
  clientId: string;
  description: string;
  projectTypes: string[];
  color: string;
  startDate: string;
  endDate: string;
  budget: string;
  paymentStructure: string;
  billingRate: string;
  oreStimate: string;
  projectManagerId: string;
  memberIds: string[];
  autoCreateChannel: boolean;
  autoCreateOnboardingTask: boolean;
  notifyTeam: boolean;
};

const initialForm: FormState = {
  name: "",
  clientId: "",
  description: "",
  projectTypes: [],
  color: "#7a8f5c",
  startDate: "",
  endDate: "",
  budget: "",
  paymentStructure: "Una tantum",
  billingRate: "",
  oreStimate: "",
  projectManagerId: "",
  memberIds: [],
  autoCreateChannel: true,
  autoCreateOnboardingTask: true,
  notifyTeam: true,
};

const DRAFT_KEY = "bekind:project-wizard-draft";

type ClientOption = { id: string | number; name: string; brandColor?: string; color?: string };
type TeamOption = { id: string | number; name?: string; surname?: string; email?: string; role?: string };

export function ProjectWizard({
  open,
  onClose,
  onCreate,
  isSubmitting,
  defaultClientId,
  clients,
  teamMembers,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: any) => Promise<{ id?: number | string } | void>;
  isSubmitting: boolean;
  defaultClientId?: string;
  clients: ClientOption[];
  teamMembers: TeamOption[];
}) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>(0);
  const [form, setForm] = useState<FormState>(initialForm);

  const teamLabel = (m: TeamOption) =>
    [m.name, m.surname].filter(Boolean).join(" ").trim() || m.email || `#${m.id}`;

  // Carica draft + apply default client all'apertura
  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft && typeof draft === "object") {
          setForm({ ...initialForm, ...draft });
        }
      }
    } catch {
      /* ignore */
    }
    setForm((prev) => ({
      ...prev,
      clientId: prev.clientId || defaultClientId || "",
      color: prev.color || pickClientColor(defaultClientId, clients) || "#7a8f5c",
    }));
    setStep(0);
  }, [open, defaultClientId, clients]);

  // Persisti draft
  useEffect(() => {
    if (!open) return;
    if (!form.name && !form.clientId) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    } catch {
      /* ignore */
    }
  }, [form, open]);

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const clientName = useMemo(() => {
    const found = clients.find((c) => String(c.id) === form.clientId);
    return found?.name ?? "";
  }, [form.clientId, clients]);

  const daysBetween = useMemo(() => {
    if (!form.startDate || !form.endDate) return null;
    const ms = new Date(form.endDate).getTime() - new Date(form.startDate).getTime();
    if (Number.isNaN(ms) || ms < 0) return null;
    return Math.ceil(ms / 86_400_000);
  }, [form.startDate, form.endDate]);

  const canAdvance = (): boolean => {
    if (step === 0) return form.name.trim().length >= 2 && Boolean(form.clientId);
    if (step === 2 && form.endDate && form.startDate && daysBetween != null && daysBetween < 0) return false;
    return true;
  };

  const next = () => {
    if (!canAdvance() || isSubmitting) return;
    if (step === 4) {
      void handleSubmit();
      return;
    }
    setStep((s) => (s + 1) as Step);
  };
  const back = () => {
    if (step === 0) return;
    setStep((s) => (s - 1) as Step);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.clientId) {
      toast({ variant: "destructive", title: "Dati mancanti", description: "Nome progetto e cliente sono obbligatori." });
      setStep(0);
      return;
    }
    const members = form.memberIds.map((id) => ({ userId: Number(id), role: "Altro" }));
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
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
      members,
      autoCreateChannel: form.autoCreateChannel,
      autoCreateOnboardingTask: form.autoCreateOnboardingTask,
      notifyTeam: form.notifyTeam,
    };
    try {
      const result = await onCreate(payload);
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      setForm(initialForm);
      onClose();
      const id = (result as any)?.id;
      if (id) navigate(`/projects/${id}`);
    } catch {
      // l'errore viene già notificato dal chiamante (toast)
    }
  };

  const clearDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    setForm(initialForm);
    setStep(0);
  };

  if (!open) return null;
  const current = STEPS[step];
  const Icon = current.icon;
  const progress = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-card-border overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header con progress bar */}
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
                {current.hint && <p className="text-xs text-muted-foreground mt-0.5">{current.hint}</p>}
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground" aria-label="Chiudi">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Nome del progetto *
                </label>
                <input
                  autoFocus
                  className="w-full mt-1 px-4 py-3 text-base border border-input rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="Es. Restyling sito Sofia Tinti"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && canAdvance()) next(); }}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Per quale cliente? *
                </label>
                <select
                  className="w-full mt-1 px-4 py-3 text-base border border-input rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                  value={form.clientId}
                  onChange={(e) => {
                    const id = e.target.value;
                    const cl = clients.find((c) => String(c.id) === id);
                    setForm((p) => ({
                      ...p,
                      clientId: id,
                      color: cl?.brandColor || cl?.color || p.color,
                    }));
                  }}
                >
                  <option value="">— Seleziona cliente —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={String(c.id)}>{c.name}</option>
                  ))}
                </select>
                {clientName && (
                  <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: form.color }} />
                    Progetto per <strong>{clientName}</strong>
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Tipo (puoi selezionarne più di uno)
                </label>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {TYPE_OPTIONS.map((t) => {
                    const on = form.projectTypes.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setField("projectTypes", on
                          ? form.projectTypes.filter((x) => x !== t)
                          : [...form.projectTypes, t])}
                        className={cn(
                          "px-3 py-2.5 text-sm rounded-xl border transition-colors text-left",
                          on
                            ? "bg-primary/10 border-primary text-primary font-semibold"
                            : "bg-background border-input hover:bg-muted"
                        )}
                      >
                        {on && <Check size={13} className="inline mr-1" />}
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Obiettivo principale (opzionale)
                </label>
                <textarea
                  className="w-full mt-1 px-4 py-3 text-sm border border-input rounded-xl bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
                  rows={3}
                  placeholder="Cosa vogliamo ottenere alla fine di questo progetto?"
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Data inizio
                  </label>
                  <input
                    type="date"
                    className="w-full mt-1 px-4 py-3 text-sm border border-input rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                    value={form.startDate}
                    onChange={(e) => setField("startDate", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Deadline
                  </label>
                  <input
                    type="date"
                    className="w-full mt-1 px-4 py-3 text-sm border border-input rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                    value={form.endDate}
                    onChange={(e) => setField("endDate", e.target.value)}
                  />
                </div>
              </div>
              {daysBetween != null && (
                <p className={cn(
                  "text-xs",
                  daysBetween < 0 ? "text-red-600 font-semibold" : "text-muted-foreground"
                )}>
                  {daysBetween < 0
                    ? "⚠️ La deadline è prima della data inizio."
                    : `Durata: ${daysBetween} ${daysBetween === 1 ? "giorno" : "giorni"}`}
                </p>
              )}
              <details className="rounded-xl border border-card-border bg-muted/30 p-3">
                <summary className="text-xs font-semibold cursor-pointer flex items-center gap-1.5 text-muted-foreground">
                  <ChevronDown size={13} /> Budget e ore (opzionale)
                </summary>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-muted-foreground">Budget (€)</label>
                    <input
                      type="number"
                      className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background"
                      placeholder="0"
                      value={form.budget}
                      onChange={(e) => setField("budget", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground">Ore stimate</label>
                    <input
                      type="number"
                      className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background"
                      placeholder="0"
                      value={form.oreStimate}
                      onChange={(e) => setField("oreStimate", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground">Tipo pagamento</label>
                    <select
                      className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background"
                      value={form.paymentStructure}
                      onChange={(e) => setField("paymentStructure", e.target.value)}
                    >
                      {PAYMENT_OPTIONS.map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  {form.paymentStructure === "A ore" && (
                    <div>
                      <label className="text-[11px] text-muted-foreground">Tariffa oraria (€/h)</label>
                      <input
                        type="number"
                        className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background"
                        placeholder="0"
                        value={form.billingRate}
                        onChange={(e) => setField("billingRate", e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </details>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Project Manager
                </label>
                <select
                  className="w-full mt-1 px-4 py-3 text-sm border border-input rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                  value={form.projectManagerId}
                  onChange={(e) => setField("projectManagerId", e.target.value)}
                >
                  <option value="">Nessuno per ora</option>
                  {teamMembers.map((m) => (
                    <option key={m.id} value={String(m.id)}>{teamLabel(m)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Team coinvolto
                </label>
                {teamMembers.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground rounded-lg bg-muted/40 p-3">
                    Nessun membro del team disponibile. Aggiungili dalla sezione <strong>Team</strong>, poi torna qui.
                  </p>
                ) : (
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto rounded-xl border border-input p-2">
                    {teamMembers.map((m) => {
                      const id = String(m.id);
                      const selected = form.memberIds.includes(id);
                      return (
                        <label
                          key={id}
                          className={cn(
                            "flex items-center gap-2 text-sm cursor-pointer rounded-lg px-2 py-1.5 transition-colors",
                            selected ? "bg-primary/10 text-primary" : "hover:bg-muted/60"
                          )}
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-primary"
                            checked={selected}
                            onChange={(e) => setField("memberIds",
                              e.target.checked
                                ? Array.from(new Set([...form.memberIds, id]))
                                : form.memberIds.filter((x) => x !== id))}
                          />
                          <span className="truncate flex-1">{teamLabel(m)}</span>
                          {m.role && <span className="text-[10px] text-muted-foreground">{m.role}</span>}
                        </label>
                      );
                    })}
                  </div>
                )}
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {form.memberIds.length === 0 ? "Nessuno selezionato (puoi aggiungerli dopo)." : `${form.memberIds.length} selezionati`}
                </p>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-card-border bg-muted/30 p-4 space-y-2">
                <h3 className="font-semibold text-sm">Riepilogo</h3>
                <SummaryRow label="Nome" value={form.name || "—"} />
                <SummaryRow label="Cliente" value={clientName || "—"} dotColor={form.color} />
                {form.projectTypes.length > 0 && <SummaryRow label="Tipo" value={form.projectTypes.join(", ")} />}
                {form.endDate && <SummaryRow label="Deadline" value={new Date(form.endDate).toLocaleDateString("it-IT")} />}
                {form.budget && <SummaryRow label="Budget" value={`€ ${Number(form.budget).toLocaleString("it-IT")}`} />}
                {form.projectManagerId && (
                  <SummaryRow label="PM" value={teamLabel(teamMembers.find((m) => String(m.id) === form.projectManagerId) ?? { id: 0 })} />
                )}
                {form.memberIds.length > 0 && <SummaryRow label="Team" value={`${form.memberIds.length} ${form.memberIds.length === 1 ? "persona" : "persone"}`} />}
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Automazioni al momento della creazione
                </h4>
                <ToggleRow
                  label="Crea task di onboarding"
                  description="Aggiunge una checklist di kickoff al progetto."
                  checked={form.autoCreateOnboardingTask}
                  onChange={(v) => setField("autoCreateOnboardingTask", v)}
                />
                <ToggleRow
                  label="Crea canale chat dedicato"
                  description="Apre un thread chat per coordinare il team."
                  checked={form.autoCreateChannel}
                  onChange={(v) => setField("autoCreateChannel", v)}
                />
                <ToggleRow
                  label="Notifica il team"
                  description="Manda una notifica ai membri assegnati."
                  checked={form.notifyTeam}
                  onChange={(v) => setField("notifyTeam", v)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-card-border bg-muted/30 flex items-center justify-between gap-2">
          <button
            onClick={back}
            disabled={step === 0 || isSubmitting}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-40"
          >
            <ArrowLeft size={14} /> Indietro
          </button>
          <button
            onClick={clearDraft}
            disabled={isSubmitting}
            className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
            title="Riparti da zero"
          >
            Azzera bozza
          </button>
          <button
            onClick={next}
            disabled={!canAdvance() || isSubmitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? (
              <><Loader2 size={14} className="animate-spin" /> Creo…</>
            ) : step === 4 ? (
              <><Check size={14} /> Crea progetto</>
            ) : (
              <>Avanti <ArrowRight size={14} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function pickClientColor(clientId: string | undefined, clients: ClientOption[]): string | undefined {
  if (!clientId) return undefined;
  const cl = clients.find((c) => String(c.id) === clientId);
  return cl?.brandColor || cl?.color;
}

function SummaryRow({ label, value, dotColor }: { label: string; value: string; dotColor?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">{label}</span>
      <span className="flex items-center gap-1.5 text-right">
        {dotColor && <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dotColor }} />}
        {value}
      </span>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-card-border bg-background p-3 cursor-pointer hover:bg-muted/30 transition-colors">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 accent-primary"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </div>
    </label>
  );
}

