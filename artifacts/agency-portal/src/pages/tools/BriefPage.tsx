import { useEffect, useMemo, useRef, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { BriefSection } from "@/components/tools/brief/BriefSection";
import { EditableField } from "@/components/tools/brief/EditableField";
import { PlatformSelector } from "@/components/tools/brief/PlatformSelector";
import { ColorPaletteEditor } from "@/components/tools/brief/ColorPaletteEditor";
import { KpiList } from "@/components/tools/brief/KpiList";
import { getBriefCompletion, getBriefSectionCompletion } from "@/components/tools/brief/briefCompletion";
import { useClientContext } from "@/context/ClientContext";
import type { BriefKpi, ClientBrief, ContentFormat, SocialPlatform } from "@/types/client";

type SaveState = "saved" | "dirty" | "saving";

const CONTENT_FORMATS: ContentFormat[] = ["Post foto", "Carosello", "Reel/Video", "Stories", "Live", "Articoli"];

function createEmptyBrief(clientId: string): ClientBrief {
  return {
    clientId,
    objectives: "",
    targetAudience: "",
    toneOfVoice: "",
    brandVoice: "",
    colorPalette: [],
    fonts: [],
    competitors: [],
    notes: "",
    updatedAt: new Date().toISOString(),
    industryOverride: "",
    companyDescription: "",
    website: "",
    foundationYear: "",
    primaryObjective: "",
    secondaryObjectives: "",
    kpis: [],
    targetAge: "",
    targetGender: "Misto",
    lifestyle: "",
    interests: [],
    geolocation: "",
    painPoints: "",
    toneOfVoiceType: "Professionale",
    toneOfVoiceNotes: "",
    brandAdjectives: ["", "", ""],
    brandDonts: "",
    colorLabels: [],
    fontTitles: "",
    fontBody: "",
    activePlatforms: [],
    platformFrequencies: {},
    formatPreferences: [],
    topicsToCover: [],
    topicsToAvoid: [],
    brandHashtags: [],
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    approvalWindow: "",
    internalNotes: "",
    usefulLinks: [],
  };
}

function TagEditor({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const value = draft.trim();
    if (!value) return;
    if (values.includes(value)) return setDraft("");
    onChange([...values, value]);
    setDraft("");
  };
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {values.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => onChange(values.filter((item) => item !== tag))}
            className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
            aria-label={`Rimuovi tag ${tag}`}
          >
            {tag} ×
          </button>
        ))}
      </div>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        placeholder="Scrivi e premi invio"
        aria-label={`Aggiungi tag ${label}`}
        className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs"
      />
    </div>
  );
}

function LinkListEditor({
  values,
  onChange,
}: {
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const value = draft.trim();
    if (!value) return;
    onChange([...values, value]);
    setDraft("");
  };
  return (
    <div className="space-y-2">
      {values.map((url, index) => (
        <div key={`${url}-${index}`} className="flex items-center gap-2">
          <input
            value={url}
            onChange={(e) => onChange(values.map((item, idx) => (idx === index ? e.target.value : item)))}
            aria-label={`File utile ${index + 1}`}
            className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs"
          />
          <button
            type="button"
            onClick={() => onChange(values.filter((_, idx) => idx !== index))}
            className="rounded border border-input px-2 py-1 text-xs text-muted-foreground"
          >
            X
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Aggiungi link cartella/file"
          aria-label="Aggiungi file utile"
          className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs"
        />
        <button type="button" onClick={add} className="rounded bg-primary px-2.5 py-1.5 text-xs text-primary-foreground">
          +
        </button>
      </div>
    </div>
  );
}

export default function BriefPage() {
  const { activeClient, brief, updateBrief } = useClientContext();
  const [draft, setDraft] = useState<ClientBrief | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [hydratedClientId, setHydratedClientId] = useState<string | null>(null);
  const skipNextSaveRef = useRef(true);

  useEffect(() => {
    if (!activeClient) {
      setDraft(null);
      setHydratedClientId(null);
      return;
    }
    const next = brief ?? createEmptyBrief(activeClient.id);
    setDraft(next);
    setHydratedClientId(activeClient.id);
    skipNextSaveRef.current = true;
  }, [activeClient?.id, brief]);

  useEffect(() => {
    if (!draft || !activeClient || hydratedClientId !== activeClient.id) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    setSaveState("dirty");
    const t = setTimeout(() => {
      setSaveState("saving");
      updateBrief({ ...draft, updatedAt: new Date().toISOString() });
      setSaveState("saved");
    }, 800);
    return () => clearTimeout(t);
  }, [draft, activeClient, hydratedClientId, updateBrief]);

  const sections = useMemo(() => getBriefSectionCompletion(draft), [draft]);
  const completion = useMemo(() => getBriefCompletion(draft), [draft]);

  if (!activeClient || !draft) {
    return (
      <Layout>
        <div className="p-8 text-sm text-muted-foreground">Seleziona un cliente per compilare il brief.</div>
      </Layout>
    );
  }

  const setField = <K extends keyof ClientBrief>(key: K, value: ClientBrief[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const activePlatforms = draft.activePlatforms ?? [];
  const platformFrequencies = draft.platformFrequencies ?? {};

  return (
    <Layout>
      <div className="mx-auto max-w-5xl p-6">
        <div className="mb-4 flex items-center justify-between rounded-xl border border-border bg-card px-4 py-2.5">
          <div>
            <h1 className="text-lg font-semibold">Brief Cliente</h1>
            <p className="text-xs text-muted-foreground">Cervello strategico condiviso per tutti i tool.</p>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold text-muted-foreground">Brief {completion}% completo</span>
            <p className="text-[11px]">
              {saveState === "saved" ? "Salvato" : saveState === "saving" ? "Salvataggio..." : "Modificato"}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <BriefSection title="Sezione 1 — Panoramica cliente" description="Identità e informazioni base dell'azienda." completionPercent={sections.overview}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Nome azienda</p>
                <p className="mt-1 text-sm font-medium">{activeClient.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Settore</p>
                <EditableField ariaLabel="Settore cliente" value={draft.industryOverride ?? activeClient.industry} onChange={(v) => setField("industryOverride", v)} />
              </div>
              <div className="md:col-span-2">
                <p className="text-xs text-muted-foreground">Descrizione azienda</p>
                <EditableField ariaLabel="Descrizione azienda" value={draft.companyDescription ?? ""} onChange={(v) => setField("companyDescription", v)} multiline maxLength={500} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sito web</p>
                <EditableField ariaLabel="Sito web cliente" value={draft.website ?? ""} onChange={(v) => setField("website", v)} placeholder="https://..." />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Anno di fondazione</p>
                <EditableField ariaLabel="Anno di fondazione" value={draft.foundationYear ?? ""} onChange={(v) => setField("foundationYear", v)} />
              </div>
            </div>
          </BriefSection>

          <BriefSection title="Sezione 2 — Obiettivi e KPI" description="Direzione strategica e metriche concordate." completionPercent={sections.goals}>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Obiettivo principale</p>
                <EditableField ariaLabel="Obiettivo principale" value={draft.primaryObjective ?? ""} onChange={(v) => setField("primaryObjective", v)} multiline />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Obiettivi secondari</p>
                <EditableField ariaLabel="Obiettivi secondari" value={draft.secondaryObjectives ?? ""} onChange={(v) => setField("secondaryObjectives", v)} multiline />
              </div>
              <KpiList value={draft.kpis ?? []} onChange={(next: BriefKpi[]) => setField("kpis", next)} />
            </div>
          </BriefSection>

          <BriefSection title="Sezione 3 — Target audience" description="Persona target, interessi e pain points." completionPercent={sections.audience}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Età target</p>
                <EditableField ariaLabel="Età target" value={draft.targetAge ?? ""} onChange={(v) => setField("targetAge", v)} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Genere prevalente</p>
                <select
                  aria-label="Genere prevalente"
                  value={draft.targetGender ?? "Misto"}
                  onChange={(e) => setField("targetGender", e.target.value as ClientBrief["targetGender"])}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
                >
                  <option>Misto</option>
                  <option>Prevalentemente maschile</option>
                  <option>Prevalentemente femminile</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs text-muted-foreground">Professione / stile di vita</p>
                <EditableField ariaLabel="Professione e stile di vita" value={draft.lifestyle ?? ""} onChange={(v) => setField("lifestyle", v)} multiline />
              </div>
              <TagEditor label="Interessi principali" values={draft.interests ?? []} onChange={(next) => setField("interests", next)} />
              <div>
                <p className="text-xs text-muted-foreground">Geolocalizzazione</p>
                <EditableField ariaLabel="Geolocalizzazione target" value={draft.geolocation ?? ""} onChange={(v) => setField("geolocation", v)} />
              </div>
              <div className="md:col-span-2">
                <p className="text-xs text-muted-foreground">Pain points del target</p>
                <EditableField ariaLabel="Pain points target" value={draft.painPoints ?? ""} onChange={(v) => setField("painPoints", v)} multiline />
              </div>
            </div>
          </BriefSection>

          <BriefSection title="Sezione 4 — Brand identity" description="Voce, stile e linee guida del brand." completionPercent={sections.identity}>
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Tone of voice</p>
                  <select
                    aria-label="Tone of voice"
                    value={draft.toneOfVoiceType ?? "Professionale"}
                    onChange={(e) => setField("toneOfVoiceType", e.target.value as ClientBrief["toneOfVoiceType"])}
                    className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
                  >
                    {["Professionale", "Amichevole", "Ironico", "Ispirazionale", "Lusso", "Educativo"].map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Note tone of voice</p>
                  <EditableField ariaLabel="Note tone of voice" value={draft.toneOfVoiceNotes ?? ""} onChange={(v) => setField("toneOfVoiceNotes", v)} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                {(draft.brandAdjectives ?? ["", "", ""]).slice(0, 3).map((value, idx) => (
                  <div key={idx}>
                    <p className="text-xs text-muted-foreground">Aggettivo {idx + 1}</p>
                    <EditableField
                      ariaLabel={`Aggettivo brand ${idx + 1}`}
                      value={value}
                      onChange={(next) => {
                        const base = (draft.brandAdjectives ?? ["", "", ""]).slice(0, 3);
                        base[idx] = next;
                        setField("brandAdjectives", base);
                      }}
                    />
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cosa NON deve mai essere/dire il brand</p>
                <EditableField ariaLabel="Brand donts" value={draft.brandDonts ?? ""} onChange={(v) => setField("brandDonts", v)} multiline />
              </div>
              <ColorPaletteEditor
                colors={draft.colorPalette ?? []}
                labels={draft.colorLabels ?? []}
                onChange={(colors, labels) => {
                  setField("colorPalette", colors);
                  setField("colorLabels", labels);
                }}
              />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Font titoli</p>
                  <EditableField ariaLabel="Font titoli" value={draft.fontTitles ?? ""} onChange={(v) => setField("fontTitles", v)} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Font corpo</p>
                  <EditableField ariaLabel="Font corpo" value={draft.fontBody ?? ""} onChange={(v) => setField("fontBody", v)} />
                </div>
              </div>
            </div>
          </BriefSection>

          <BriefSection title="Sezione 5 — Contenuti e piattaforme" description="Canali attivi, frequenza e temi editoriali." completionPercent={sections.content}>
            <div className="space-y-3">
              <PlatformSelector value={activePlatforms} onChange={(next: SocialPlatform[]) => setField("activePlatforms", next)} />
              {activePlatforms.length > 0 && (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {activePlatforms.map((platform) => (
                    <div key={platform}>
                      <p className="text-xs text-muted-foreground capitalize">{platform}</p>
                      <EditableField
                        ariaLabel={`Frequenza ${platform}`}
                        value={platformFrequencies[platform] ?? ""}
                        onChange={(v) => setField("platformFrequencies", { ...platformFrequencies, [platform]: v })}
                        placeholder="es. 4 post/settimana"
                      />
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {CONTENT_FORMATS.map((format) => {
                  const selected = (draft.formatPreferences ?? []).includes(format);
                  return (
                    <button
                      key={format}
                      type="button"
                      onClick={() => {
                        const current = draft.formatPreferences ?? [];
                        const next = selected ? current.filter((item) => item !== format) : [...current, format];
                        setField("formatPreferences", next);
                      }}
                      className={`rounded-lg border px-2 py-1.5 text-xs ${selected ? "border-primary bg-primary/10 text-primary" : "border-input"}`}
                    >
                      {format}
                    </button>
                  );
                })}
              </div>
              <TagEditor label="Argomenti da trattare" values={draft.topicsToCover ?? []} onChange={(next) => setField("topicsToCover", next)} />
              <TagEditor label="Argomenti da evitare" values={draft.topicsToAvoid ?? []} onChange={(next) => setField("topicsToAvoid", next)} />
              <TagEditor label="Hashtag brand" values={draft.brandHashtags ?? []} onChange={(next) => setField("brandHashtags", next)} />
            </div>
          </BriefSection>

          <BriefSection title="Sezione 6 — Note operative" description="Informazioni di coordinamento team-cliente." completionPercent={sections.operations}>
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Referente</p>
                  <EditableField ariaLabel="Referente cliente" value={draft.contactName ?? ""} onChange={(v) => setField("contactName", v)} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <EditableField ariaLabel="Email referente cliente" value={draft.contactEmail ?? ""} onChange={(v) => setField("contactEmail", v)} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Telefono</p>
                  <EditableField ariaLabel="Telefono referente cliente" value={draft.contactPhone ?? ""} onChange={(v) => setField("contactPhone", v)} />
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Giorno/ora preferita per approvazioni</p>
                <EditableField ariaLabel="Preferenze approvazioni cliente" value={draft.approvalWindow ?? ""} onChange={(v) => setField("approvalWindow", v)} />
              </div>
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">Note interne team</p>
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Interno</span>
                </div>
                <EditableField ariaLabel="Note interne team" value={draft.internalNotes ?? ""} onChange={(v) => setField("internalNotes", v)} multiline />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">File utili</p>
                <LinkListEditor values={draft.usefulLinks ?? []} onChange={(next) => setField("usefulLinks", next)} />
              </div>
            </div>
          </BriefSection>
        </div>
      </div>
    </Layout>
  );
}
