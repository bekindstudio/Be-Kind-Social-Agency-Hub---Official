import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { useClientContext } from "@/context/ClientContext";
import { portalFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { generateBriefPDF } from "@/lib/brief-pdf";
import {
  ChevronDown,
  CheckCircle2,
  Loader2,
  CloudOff,
  Cloud,
  FileText,
  FileDown,
  Users,
  Sparkles,
  Activity,
  Compass,
  MessageSquareQuote,
  Swords,
  HeartHandshake,
  ThumbsUp,
  Megaphone,
  Target,
} from "lucide-react";

/* ────────────────────────────────────────────────────────────────────────
   Brief cliente — form MANUALE, chiaro, con salvataggio automatico.
   I dati vengono salvati in client_briefs.parsedJson (oggetto sezione→campo).
   Nessuna dipendenza dall'AI.
   ──────────────────────────────────────────────────────────────────────── */

type Field = { key: string; label: string; placeholder?: string; long?: boolean };
type Section = {
  key: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  hint?: string;
  fields: Field[];
};

const SECTIONS: Section[] = [
  {
    key: "materiale_iniziale",
    label: "Materiale iniziale",
    icon: FileText,
    hint: "Accessi, link e materiali di partenza",
    fields: [
      { key: "nome_referenti", label: "Nome referenti" },
      { key: "descrizione_prodotto", label: "Descrizione prodotto / servizio", long: true },
      { key: "sito_web", label: "Sito web", placeholder: "https://" },
      { key: "link_instagram", label: "Link Instagram", placeholder: "https://instagram.com/" },
      { key: "link_facebook", label: "Link Facebook", placeholder: "https://facebook.com/" },
      { key: "link_tiktok", label: "Link TikTok", placeholder: "https://tiktok.com/@" },
      { key: "business_manager", label: "Business Manager Meta" },
      { key: "canva_kit", label: "Kit aziendale Canva" },
      { key: "canva_progetti", label: "Progetti Canva" },
      { key: "logo", label: "Logo (note/link)" },
    ],
  },
  {
    key: "target_personas",
    label: "Target & personas",
    icon: Users,
    hint: "A chi parliamo",
    fields: [
      { key: "clienti_attuali", label: "Clienti attuali", long: true },
      { key: "tipo_persone", label: "Tipo di persone", long: true },
      { key: "fasce_eta", label: "Fasce di età" },
      { key: "professione_disponibilita", label: "Professione e disponibilità economica" },
      { key: "locali_o_fuori_zona", label: "Locali o fuori zona" },
      { key: "mercato", label: "Mercato di riferimento" },
      { key: "servizio_piu_richiesto", label: "Servizio più richiesto" },
      { key: "servizio_da_spingere", label: "Servizio da spingere" },
    ],
  },
  {
    key: "servizi_chiave",
    label: "Servizi chiave & USP",
    icon: Sparkles,
    hint: "Cosa rende unico il brand",
    fields: [
      { key: "servizi_da_comunicare", label: "Servizi da comunicare", long: true },
      { key: "plus_esclusivi", label: "Plus esclusivi", long: true },
      { key: "usp_1", label: "USP 1" },
      { key: "usp_2", label: "USP 2" },
      { key: "usp_3", label: "USP 3" },
      { key: "novita_progetti", label: "Novità e progetti futuri", long: true },
    ],
  },
  {
    key: "comportamento_cliente",
    label: "Comportamento cliente",
    icon: Activity,
    hint: "Come si comportano e decidono",
    fields: [
      { key: "cosa_cercano", label: "Cosa cercano", long: true },
      { key: "perche_scelgono", label: "Perché scelgono il brand", long: true },
      { key: "feedback_comuni", label: "Feedback comuni", long: true },
      { key: "come_scoprono", label: "Come scoprono il brand" },
      { key: "canali_funzionanti", label: "Canali che funzionano" },
      { key: "primo_contatto", label: "Primo contatto" },
      { key: "riscontri_social", label: "Riscontri dai social" },
      { key: "ostacoli", label: "Ostacoli", long: true },
      { key: "richieste_confuse", label: "Richieste confuse / dubbi ricorrenti", long: true },
    ],
  },
  {
    key: "posizionamento",
    label: "Posizionamento & visione",
    icon: Compass,
    fields: [
      { key: "visione_2_anni", label: "Visione a 2 anni", long: true },
      { key: "sogno_crescita", label: "Sogno di crescita", long: true },
    ],
  },
  {
    key: "tone_of_voice",
    label: "Tone of voice",
    icon: MessageSquareQuote,
    hint: "Come comunichiamo",
    fields: [
      { key: "valori_fondamentali", label: "Valori fondamentali", long: true },
      { key: "value_proposition", label: "Value proposition", long: true },
      { key: "percezione_desiderata", label: "Percezione desiderata" },
      { key: "brand_persona", label: "Personalità del brand" },
      { key: "stile_comunicazione", label: "Stile di comunicazione" },
      { key: "tono_umano_vs_tecnico", label: "Tono umano vs tecnico" },
      { key: "sensazioni", label: "Sensazioni da trasmettere" },
      { key: "esempi_comunicazione", label: "Esempi di comunicazione", long: true },
    ],
  },
  {
    key: "competitor",
    label: "Competitor",
    icon: Swords,
    hint: "Riferimenti positivi e negativi",
    fields: [
      { key: "competitor_1", label: "Competitor 1 (ispirazione)" },
      { key: "competitor_2", label: "Competitor 2 (ispirazione)" },
      { key: "competitor_3", label: "Competitor 3 (ispirazione)" },
      { key: "competitor_4_negativo", label: "Competitor 4 (da NON imitare)" },
    ],
  },
  {
    key: "pain_points_desideri",
    label: "Pain points, desideri & offerte",
    icon: HeartHandshake,
    fields: [
      { key: "pain_points", label: "Pain points e frustrazioni", long: true },
      { key: "desideri_obiettivi", label: "Desideri e obiettivi", long: true },
      { key: "benefici", label: "Benefici", long: true },
      { key: "offerta_principale", label: "Offerta principale", long: true },
      { key: "lista_offerte", label: "Lista offerte", long: true },
      { key: "garanzie", label: "Garanzie" },
      { key: "obiezioni", label: "Obiezioni e barriere", long: true },
      { key: "risposte_obiezioni", label: "Risposte alle obiezioni", long: true },
      { key: "faq", label: "FAQ / domande frequenti", long: true },
      { key: "trigger_events", label: "Trigger events", long: true },
    ],
  },
  {
    key: "social_preference",
    label: "Preferenze social",
    icon: ThumbsUp,
    fields: [
      { key: "come_apparire", label: "Come apparire sui social", long: true },
      { key: "come_non_apparire", label: "Come NON apparire", long: true },
    ],
  },
  {
    key: "budget_adv",
    label: "Budget pubblicitario",
    icon: Megaphone,
    hint: "Investimenti per anno",
    fields: [
      { key: "meta_2024", label: "META 2024" },
      { key: "meta_2025", label: "META 2025" },
      { key: "meta_2026", label: "META 2026" },
      { key: "google_2024", label: "Google 2024" },
      { key: "google_2025", label: "Google 2025" },
      { key: "google_2026", label: "Google 2026" },
    ],
  },
  {
    key: "obiettivi",
    label: "Obiettivi 2026",
    icon: Target,
    fields: [
      { key: "comunicazione_social_2026", label: "Obiettivo comunicazione social 2026", long: true },
      { key: "adv_social_2026", label: "Obiettivo ADV social 2026", long: true },
    ],
  },
];

type BriefData = Record<string, Record<string, string>>;
type SaveState = "idle" | "saving" | "saved" | "error";

function emptyData(): BriefData {
  const d: BriefData = {};
  for (const s of SECTIONS) {
    d[s.key] = {};
    for (const f of s.fields) d[s.key][f.key] = "";
  }
  return d;
}

function normalize(parsed: unknown): BriefData {
  const base = emptyData();
  if (!parsed || typeof parsed !== "object") return base;
  for (const s of SECTIONS) {
    const sec = (parsed as Record<string, unknown>)[s.key];
    if (sec && typeof sec === "object") {
      for (const f of s.fields) {
        const v = (sec as Record<string, unknown>)[f.key];
        if (typeof v === "string") base[s.key][f.key] = v;
      }
    }
  }
  return base;
}

function sectionFilled(data: BriefData, s: Section): number {
  return s.fields.filter((f) => (data[s.key]?.[f.key] ?? "").trim().length > 0).length;
}

function cnChevron(open: boolean): string {
  return `shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`;
}

function SaveBadge({ state, loading }: { state: SaveState; loading: boolean }) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 size={13} className="animate-spin" /> Caricamento…
      </span>
    );
  }
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 size={13} className="animate-spin" /> Salvataggio…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600">
        <Cloud size={13} /> Salvato
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-red-600">
        <CloudOff size={13} /> Errore di salvataggio
      </span>
    );
  }
  return null;
}

export default function BriefPage() {
  const { activeClient } = useClientContext();
  const { toast } = useToast();
  const clientId =
    activeClient?.id && Number.isFinite(Number(activeClient.id)) ? Number(activeClient.id) : null;

  const [data, setData] = useState<BriefData>(emptyData);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ [SECTIONS[0].key]: true });

  const loadedRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<{ data: BriefData; notes: string }>({ data, notes });
  latest.current = { data, notes };

  // Carica il brief del cliente attivo.
  useEffect(() => {
    loadedRef.current = false;
    if (!clientId) {
      setData(emptyData());
      setNotes("");
      return;
    }
    let alive = true;
    setLoading(true);
    setSaveState("idle");
    void (async () => {
      try {
        const res = await portalFetch(`/api/clients/${clientId}/brief`, { credentials: "include" });
        if (!alive) return;
        if (res.ok) {
          const row = await res.json();
          let parsed: unknown = {};
          try {
            parsed = row?.parsedJson ? JSON.parse(row.parsedJson) : {};
          } catch {
            parsed = {};
          }
          setData(normalize(parsed));
          setNotes(typeof row?.rawText === "string" ? row.rawText : "");
        } else {
          setData(emptyData());
          setNotes("");
        }
      } catch {
        if (alive) {
          setData(emptyData());
          setNotes("");
        }
      } finally {
        if (alive) {
          setLoading(false);
          // Abilita l'autosave solo DOPO che il caricamento è terminato.
          setTimeout(() => {
            loadedRef.current = true;
          }, 0);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [clientId]);

  const persist = useCallback(async () => {
    if (!clientId) return;
    setSaveState("saving");
    try {
      const res = await portalFetch(`/api/clients/${clientId}/brief`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parsedJson: latest.current.data, rawText: latest.current.notes }),
      });
      if (!res.ok) throw new Error(`http_${res.status}`);
      setSaveState("saved");
    } catch {
      setSaveState("error");
      toast({
        variant: "destructive",
        title: "Salvataggio non riuscito",
        description: "Riprova tra poco: il testo digitato resta nei campi.",
      });
    }
  }, [clientId, toast]);

  // Autosave con debounce quando l'utente modifica qualcosa.
  const scheduleSave = useCallback(() => {
    if (!loadedRef.current) return;
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void persist();
    }, 800);
  }, [persist]);

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  const setField = (sectionKey: string, fieldKey: string, value: string) => {
    setData((prev) => ({ ...prev, [sectionKey]: { ...prev[sectionKey], [fieldKey]: value } }));
    scheduleSave();
  };

  const handleExportPdf = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      await generateBriefPDF({
        clientName: activeClient?.name ?? "Cliente",
        clientLogoUrl: activeClient?.logo ?? null,
        brandColor: activeClient?.color ?? null,
        sections: SECTIONS.map((s) => ({
          label: s.label,
          fields: s.fields.map((f) => ({ label: f.label, value: data[s.key]?.[f.key] ?? "" })),
        })),
      });
    } catch {
      toast({ variant: "destructive", title: "Esportazione PDF non riuscita", description: "Riprova tra poco." });
    } finally {
      setPdfBusy(false);
    }
  };

  const totals = useMemo(() => {
    const total = SECTIONS.reduce((acc, s) => acc + s.fields.length, 0);
    const filled = SECTIONS.reduce((acc, s) => acc + sectionFilled(data, s), 0);
    return { total, filled, pct: total ? Math.round((filled / total) * 100) : 0 };
  }, [data]);

  const allOpen = SECTIONS.every((s) => openSections[s.key]);
  const toggleAll = () => {
    const next: Record<string, boolean> = {};
    for (const s of SECTIONS) next[s.key] = !allOpen;
    setOpenSections(next);
  };

  if (!clientId) {
    return (
      <Layout>
        <div className="p-8">
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-card-border py-20 text-center">
            <FileText size={28} className="text-muted-foreground/60 mb-3" />
            <p className="font-medium">Seleziona un cliente</p>
            <p className="text-sm text-muted-foreground mt-1">
              Scegli un cliente dalla barra in alto per compilare il suo brief.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">Brief cliente</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{activeClient?.name}</p>
            </div>
            <div className="flex items-center gap-3">
              <SaveBadge state={saveState} loading={loading} />
              <button
                onClick={toggleAll}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-input hover:bg-muted transition-colors"
              >
                {allOpen ? "Comprimi tutto" : "Espandi tutto"}
              </button>
              <button
                onClick={() => void handleExportPdf()}
                disabled={pdfBusy || totals.filled === 0}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:brightness-105 transition disabled:opacity-50"
                title={totals.filled === 0 ? "Compila almeno un campo per esportare" : "Genera il PDF del brief"}
              >
                {pdfBusy ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
                {pdfBusy ? "Genero…" : "Genera PDF"}
              </button>
            </div>
          </div>
          {/* Progress */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Completamento brief</span>
              <span className="font-semibold text-foreground">
                {totals.pct}% · {totals.filled}/{totals.total} campi
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all duration-500" style={{ width: `${totals.pct}%` }} />
            </div>
          </div>
        </div>

        {/* Sezioni */}
        <div className="space-y-3">
          {SECTIONS.map((s) => {
            const open = !!openSections[s.key];
            const filled = sectionFilled(data, s);
            const Icon = s.icon;
            return (
              <section key={s.key} className="rounded-xl border border-card-border bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenSections((p) => ({ ...p, [s.key]: !p[s.key] }))}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{s.label}</span>
                      {filled === s.fields.length && filled > 0 && (
                        <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                      )}
                    </span>
                    {s.hint && <span className="block text-[11px] text-muted-foreground truncate">{s.hint}</span>}
                  </span>
                  <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                    {filled}/{s.fields.length}
                  </span>
                  <ChevronDown size={16} className={cnChevron(open)} />
                </button>
                {open && (
                  <div className="px-4 pb-4 pt-1 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                    {s.fields.map((f) => (
                      <div key={f.key} className={f.long ? "md:col-span-2" : undefined}>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">{f.label}</label>
                        <textarea
                          value={data[s.key]?.[f.key] ?? ""}
                          onChange={(e) => setField(s.key, f.key, e.target.value)}
                          placeholder={f.placeholder ?? "—"}
                          rows={f.long ? 3 : 2}
                          className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}

          {/* Note libere / brief grezzo */}
          <section className="rounded-xl border border-card-border bg-card overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenSections((p) => ({ ...p, __notes: !p.__notes }))}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-semibold text-sm">Note libere</span>
                <span className="block text-[11px] text-muted-foreground truncate">
                  Appunti, testo grezzo del questionario, qualsiasi cosa
                </span>
              </span>
              <ChevronDown size={16} className={cnChevron(!!openSections.__notes)} />
            </button>
            {openSections.__notes && (
              <div className="px-4 pb-4 pt-1">
                <textarea
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    scheduleSave();
                  }}
                  rows={8}
                  placeholder="Incolla qui il questionario compilato o qualsiasi nota libera…"
                  className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
            )}
          </section>
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Le modifiche vengono salvate automaticamente.
        </p>
      </div>
    </Layout>
  );
}
