import { useState } from "react";
import { useLocation } from "wouter";
import { portalFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useClientContext } from "@/context/ClientContext";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Sparkles,
  User,
  Briefcase,
  FolderKanban,
  Loader2,
  X,
} from "lucide-react";

/**
 * Wizard di onboarding "tutto in uno": crea cliente, brief seed,
 * (opzionale) link Drive e primo progetto + task di kickoff. Sostituisce il
 * form a tab che chiedeva subito 30 campi prima ancora di poter cominciare.
 */

type Step = 0 | 1 | 2 | 3;

const STEPS: { key: Step; label: string; icon: typeof User }[] = [
  { key: 0, label: "Cliente", icon: User },
  { key: 1, label: "Brief base", icon: Sparkles },
  { key: 2, label: "Canali", icon: Briefcase },
  { key: 3, label: "Primo progetto", icon: FolderKanban },
];

const SERVICE_TYPES = ["Social", "Meta Ads", "Google Ads", "Web", "Branding", "Email Marketing"];

const PROJECT_TYPES = [
  "Social Media Management",
  "Campagna Meta Ads",
  "Campagna Google Ads",
  "Sviluppo Sito",
  "Brand Identity",
  "Content Production",
  "Email Marketing",
  "Strategia & Consulenza",
];

type FormState = {
  // Step 0
  name: string;
  settore: string;
  brandColor: string;
  website: string;
  contactNome: string;
  contactEmail: string;
  contactRuolo: string;
  // Step 1 — seed brief
  descrizioneProdotto: string;
  tipoPersone: string;
  toneOfVoice: string;
  obiettivoPrincipale: string;
  // Step 2 — canali / drive
  instagramHandle: string;
  driveUrl: string;
  services: string[];
  // Step 3 — progetto
  projectName: string;
  projectType: string;
  projectDeadline: string;
};

const initialForm: FormState = {
  name: "",
  settore: "",
  brandColor: "#7a8f5c",
  website: "",
  contactNome: "",
  contactEmail: "",
  contactRuolo: "",
  descrizioneProdotto: "",
  tipoPersone: "",
  toneOfVoice: "",
  obiettivoPrincipale: "",
  instagramHandle: "",
  driveUrl: "",
  services: [],
  projectName: "",
  projectType: "Social Media Management",
  projectDeadline: "",
};

export function OnboardingWizard({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: (clientId: number) => void;
}) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { importClients } = useClientContext();
  const [step, setStep] = useState<Step>(0);
  const [form, setForm] = useState<FormState>(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const canAdvance = (): boolean => {
    if (step === 0) return form.name.trim().length >= 2;
    return true;
  };

  const toggleService = (s: string) =>
    setForm((p) => ({
      ...p,
      services: p.services.includes(s)
        ? p.services.filter((x) => x !== s)
        : [...p.services, s],
    }));

  const buildBriefParsed = () => {
    return {
      materiale_iniziale: {
        nome_referenti: form.contactNome.trim(),
        sito_web: form.website.trim(),
        link_instagram: form.instagramHandle.trim(),
        descrizione_prodotto: form.descrizioneProdotto.trim(),
      },
      target_personas: {
        tipo_persone: form.tipoPersone.trim(),
      },
      tone_of_voice: {
        stile_comunicazione: form.toneOfVoice.trim(),
      },
      obiettivi: {
        comunicazione_social_2026: form.obiettivoPrincipale.trim(),
      },
    };
  };

  const briefHasContent = () =>
    Boolean(
      form.descrizioneProdotto.trim() ||
        form.tipoPersone.trim() ||
        form.toneOfVoice.trim() ||
        form.obiettivoPrincipale.trim()
    );

  const handleSubmit = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      // 1. Crea cliente
      const contacts = form.contactNome.trim() || form.contactEmail.trim()
        ? [{
            nome: form.contactNome.trim(),
            cognome: "",
            ruolo: form.contactRuolo.trim(),
            email: form.contactEmail.trim(),
            telefono: "",
            isPrimary: true,
          }]
        : [];

      const clientRes = await portalFetch("/api/clients", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          nomeCommerciale: form.name.trim(),
          settore: form.settore.trim() || null,
          website: form.website.trim() || null,
          color: form.brandColor,
          brandColor: form.brandColor,
          instagramHandle: form.instagramHandle.trim() || null,
          driveUrl: form.driveUrl.trim() || null,
          email: form.contactEmail.trim() || null,
          services: form.services,
          contacts,
          tags: [],
        }),
      });
      if (!clientRes.ok) {
        const text = await clientRes.text();
        throw new Error(`Errore creazione cliente: ${text.slice(0, 200)}`);
      }
      const client = await clientRes.json();
      const clientId = Number(client.id);

      // 2. Seed brief (best effort, non blocca il flow)
      if (briefHasContent()) {
        try {
          await portalFetch(`/api/clients/${clientId}/brief`, {
            method: "PUT",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              rawText: "",
              parsedJson: buildBriefParsed(),
            }),
          });
        } catch {
          // ignora: il brief si potrà completare dal cockpit
        }
      }

      // 3. Primo progetto + task onboarding (best effort)
      if (form.projectName.trim()) {
        try {
          await portalFetch("/api/projects", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: form.projectName.trim(),
              clientId,
              status: "planning",
              category: form.projectType,
              projectTypes: [form.projectType],
              deadline: form.projectDeadline || null,
              autoCreateOnboardingTask: true,
            }),
          });
        } catch {
          // ignora
        }
      }

      // 4. Aggiorna contesto e naviga al cockpit
      importClients([
        {
          id: String(clientId),
          name: form.name.trim(),
          color: form.brandColor,
          industry: form.settore.trim() || "Generico",
          status: "active",
          createdAt: new Date().toISOString(),
        },
      ]);

      toast({
        title: "Cliente creato",
        description: `${form.name.trim()} pronto. Aperto il cockpit.`,
      });

      onCreated?.(clientId);
      onClose();
      navigate(`/clients/${clientId}`);
    } catch (e: any) {
      setError(e?.message ?? "Errore durante la creazione");
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (!canAdvance()) return;
    if (step === 3) {
      void handleSubmit();
      return;
    }
    setStep((s) => (s + 1) as Step);
  };

  const back = () => {
    if (step === 0) return;
    setStep((s) => (s - 1) as Step);
  };

  // Pre-fill suggerito del nome progetto quando si arriva allo step 3
  const goToStep = (s: Step) => {
    if (s === 3 && !form.projectName) {
      setForm((p) => ({ ...p, projectName: `Avvio collaborazione - ${p.name.trim()}` }));
    }
    setStep(s);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-3xl rounded-2xl shadow-2xl border border-card-border overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-card-border flex items-center justify-between bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Sparkles size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-base">Onboarding Nuovo Cliente</h2>
              <p className="text-xs text-muted-foreground">
                4 step rapidi · puoi completare tutto dopo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
            aria-label="Chiudi"
          >
            <X size={18} />
          </button>
        </div>

        {/* Stepper */}
        <div className="px-6 pt-4 pb-2 border-b border-card-border/50">
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = step > s.key;
              const active = step === s.key;
              return (
                <div key={s.key} className="flex items-center gap-2 flex-1">
                  <button
                    onClick={() => (done ? goToStep(s.key) : undefined)}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : done
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 cursor-pointer"
                          : "bg-muted text-muted-foreground"
                    )}
                  >
                    {done ? <Check size={13} /> : <Icon size={13} />}
                    <span className="hidden sm:inline">{s.label}</span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className={cn("flex-1 h-0.5 rounded", done ? "bg-emerald-300" : "bg-muted")} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {step === 0 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-sm mb-1">Iniziamo dal cliente</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Solo il nome è obbligatorio. Tutto il resto lo puoi aggiungere dopo.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field
                  label="Nome azienda *"
                  value={form.name}
                  onChange={(v) => setField("name", v)}
                  autoFocus
                />
                <Field
                  label="Settore"
                  value={form.settore}
                  onChange={(v) => setField("settore", v)}
                  placeholder="Es. Ristorazione, Beauty…"
                />
                <Field
                  label="Sito web"
                  value={form.website}
                  onChange={(v) => setField("website", v)}
                  placeholder="https://"
                />
                <div>
                  <label className="text-xs text-muted-foreground">Colore brand</label>
                  <input
                    type="color"
                    className="h-9 w-20 border border-input rounded-lg bg-background mt-1"
                    value={form.brandColor}
                    onChange={(e) => setField("brandColor", e.target.value)}
                  />
                </div>
              </div>
              <div className="pt-2 border-t border-card-border/50">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Referente principale (opzionale)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Field
                    label="Nome"
                    value={form.contactNome}
                    onChange={(v) => setField("contactNome", v)}
                  />
                  <Field
                    label="Email"
                    value={form.contactEmail}
                    onChange={(v) => setField("contactEmail", v)}
                    placeholder="email@example.com"
                  />
                  <Field
                    label="Ruolo"
                    value={form.contactRuolo}
                    onChange={(v) => setField("contactRuolo", v)}
                    placeholder="Owner, Marketing…"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-sm mb-1">Brief seed (opzionale)</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Bastano 4 risposte per partire. Le altre 60+ domande le completi dal cockpit cliente.
                </p>
              </div>
              <Field
                label="Cosa offre il brand?"
                value={form.descrizioneProdotto}
                onChange={(v) => setField("descrizioneProdotto", v)}
                placeholder="Descrizione prodotto/servizio in 1-2 righe"
                textarea
              />
              <Field
                label="A chi parliamo?"
                value={form.tipoPersone}
                onChange={(v) => setField("tipoPersone", v)}
                placeholder="Tipo di persone, fascia d'età, interessi…"
                textarea
              />
              <Field
                label="Tono di voce"
                value={form.toneOfVoice}
                onChange={(v) => setField("toneOfVoice", v)}
                placeholder="Diretto e ironico / istituzionale / caldo…"
              />
              <Field
                label="Obiettivo principale 2026"
                value={form.obiettivoPrincipale}
                onChange={(v) => setField("obiettivoPrincipale", v)}
                placeholder="Cosa vorremmo ottenere a fine anno?"
                textarea
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-sm mb-1">Canali e materiali</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Imposta subito ciò che hai a disposizione.
                </p>
              </div>
              <Field
                label="Handle Instagram"
                value={form.instagramHandle}
                onChange={(v) => setField("instagramHandle", v)}
                placeholder="@nome"
              />
              <Field
                label="Cartella Google Drive cliente"
                value={form.driveUrl}
                onChange={(v) => setField("driveUrl", v)}
                placeholder="https://drive.google.com/…"
              />
              <div>
                <label className="text-xs text-muted-foreground">Servizi attivi</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                  {SERVICE_TYPES.map((s) => {
                    const active = form.services.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleService(s)}
                        className={cn(
                          "px-3 py-2 text-sm rounded-lg border transition-colors text-left",
                          active
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-background border-input hover:bg-muted"
                        )}
                      >
                        {active && <Check size={13} className="inline mr-1" />}
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-sm mb-1">Primo progetto (opzionale)</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Creiamo il primo progetto + una checklist di kickoff. Puoi saltare e farlo dopo.
                </p>
              </div>
              <Field
                label="Nome progetto"
                value={form.projectName}
                onChange={(v) => setField("projectName", v)}
                placeholder="Es. Avvio collaborazione - …"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Tipo</label>
                  <select
                    className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background"
                    value={form.projectType}
                    onChange={(e) => setField("projectType", e.target.value)}
                  >
                    {PROJECT_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Deadline (opzionale)</label>
                  <input
                    type="date"
                    className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background"
                    value={form.projectDeadline}
                    onChange={(e) => setField("projectDeadline", e.target.value)}
                  />
                </div>
              </div>
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
                Al "Crea cliente" si avviano automaticamente:
                <ul className="mt-2 space-y-1 text-xs">
                  <li>· Anagrafica cliente e referente principale</li>
                  <li>· Task di onboarding ({form.name.trim() ? `"Onboarding Nuovo Cliente - ${form.name.trim()}"` : ""})</li>
                  {briefHasContent() && <li>· Brief precompilato con le risposte di questo wizard</li>}
                  {form.projectName.trim() && <li>· Progetto "{form.projectName.trim()}" + task di kickoff</li>}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-card-border bg-muted/30 flex items-center justify-between">
          <button
            onClick={back}
            disabled={step === 0 || saving}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-40"
          >
            <ArrowLeft size={14} /> Indietro
          </button>
          <div className="text-xs text-muted-foreground hidden md:block">
            Step {step + 1} di {STEPS.length}
          </div>
          <button
            onClick={next}
            disabled={!canAdvance() || saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Creo…
              </>
            ) : step === 3 ? (
              <>
                <Check size={14} /> Crea cliente
              </>
            ) : (
              <>
                Avanti <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      {textarea ? (
        <textarea
          rows={2}
          autoFocus={autoFocus}
          className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background resize-none"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          autoFocus={autoFocus}
          className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
