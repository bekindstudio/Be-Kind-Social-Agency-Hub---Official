import { useState, useEffect, useRef, useCallback } from "react";
import { portalFetch } from "@workspace/api-client-react";
import { FileText, Sparkles, Loader2, ClipboardPaste, Trash2, ChevronDown, ChevronUp, RefreshCw, CheckCircle2, AlertTriangle, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { generateStrategyPDF } from "@/lib/strategy-pdf";
import { useClientContext } from "@/context/ClientContext";
import type { ClientBrief, SocialPlatform } from "@/types/client";

interface Brief {
  id: number;
  clientId: number;
  rawText: string;
  parsedJson: string;
  strategyHtml: string;
  strategyStatus: string;
}

const SECTION_LABELS: Record<string, string> = {
  materiale_iniziale: "Materiale Iniziale",
  target_personas: "Target Personas",
  servizi_chiave: "Servizi Chiave",
  comportamento_cliente: "Comportamento Cliente",
  posizionamento: "Posizionamento e Visione Futura",
  tone_of_voice: "Tone of Voice",
  competitor: "Competitor",
  pain_points_desideri: "Pain Points, Desideri e Offerte",
  social_preference: "Preferenze Social",
  budget_adv: "Budget Pubblicitario",
  obiettivi: "Obiettivi 2026",
};

const FIELD_LABELS: Record<string, string> = {
  nome_referenti: "Nome Referenti",
  logo: "Logo",
  instagram: "Pagina Instagram",
  business_manager: "Business Manager",
  canva_kit: "Kit Aziendale Canva",
  canva_progetti: "Progetti Canva",
  sito_web: "Sito Web",
  link_instagram: "Link Instagram",
  link_facebook: "Link Facebook",
  link_tiktok: "Link TikTok",
  descrizione_prodotto: "Descrizione Prodotto/Servizio",
  clienti_attuali: "Clienti Attuali",
  tipo_persone: "Tipo di Persone",
  fasce_eta: "Fasce di Eta",
  professione_disponibilita: "Professione e Disponibilita",
  locali_o_fuori_zona: "Locali o Fuori Zona",
  mercato: "Mercato",
  servizio_piu_richiesto: "Servizio piu Richiesto",
  servizio_da_spingere: "Servizio da Spingere",
  servizi_da_comunicare: "Servizi da Comunicare",
  plus_esclusivi: "Plus Esclusivi",
  usp_1: "USP 1",
  usp_2: "USP 2",
  usp_3: "USP 3",
  novita_progetti: "Novita e Progetti",
  cosa_cercano: "Cosa Cercano",
  perche_scelgono: "Perche Scelgono il Brand",
  feedback_comuni: "Feedback Comuni",
  come_scoprono: "Come Scoprono il Brand",
  canali_funzionanti: "Canali Funzionanti",
  primo_contatto: "Primo Contatto",
  riscontri_social: "Riscontri Social",
  ostacoli: "Ostacoli",
  richieste_confuse: "Richieste Confuse",
  visione_2_anni: "Visione a 2 Anni",
  sogno_crescita: "Sogno di Crescita",
  valori_fondamentali: "Valori Fondamentali",
  value_proposition: "Value Proposition",
  percezione_desiderata: "Percezione Desiderata",
  brand_persona: "Personalita del Brand",
  stile_comunicazione: "Stile di Comunicazione",
  tono_umano_vs_tecnico: "Tono Umano vs Tecnico",
  sensazioni: "Sensazioni da Trasmettere",
  esempi_comunicazione: "Esempi di Comunicazione",
  competitor_1: "Competitor 1 (Ispirazione)",
  competitor_2: "Competitor 2 (Ispirazione)",
  competitor_3: "Competitor 3 (Ispirazione)",
  competitor_4_negativo: "Competitor 4 (Negativo)",
  pain_points: "Pain Points e Frustrazioni",
  desideri_obiettivi: "Desideri e Obiettivi",
  benefici: "Benefici",
  offerta_principale: "Offerta Principale",
  lista_offerte: "Lista Offerte",
  garanzie: "Garanzie",
  obiezioni: "Obiezioni e Barriere",
  risposte_obiezioni: "Risposte alle Obiezioni",
  faq: "FAQ / Domande Frequenti",
  trigger_events: "Trigger Events",
  come_apparire: "Come Apparire sui Social",
  come_non_apparire: "Come NON Apparire",
  meta_2024: "Budget META 2024",
  meta_2025: "Budget META 2025",
  meta_2026: "Budget META 2026",
  google_2024: "Budget Google 2024",
  google_2025: "Budget Google 2025",
  google_2026: "Budget Google 2026",
  comunicazione_social_2026: "Obiettivo Comunicazione Social 2026",
  adv_social_2026: "Obiettivo ADV Social 2026",
};
const AUTOFILL_PASTE_STORAGE_KEY = "agency_brief_autofill_on_paste";

async function apiFetch(path: string, options?: RequestInit) {
  return portalFetch(path, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function splitList(value: string): string[] {
  if (!value.trim()) return [];
  return value
    .split(/[,\n;|]/g)
    .map((item) => item.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

function inferToneType(value: string): ClientBrief["toneOfVoiceType"] {
  const lower = value.toLowerCase();
  if (/(iron|diverten|scherz)/.test(lower)) return "Ironico";
  if (/(ispiraz|motivaz|sogno)/.test(lower)) return "Ispirazionale";
  if (/(lusso|premium|esclusiv)/.test(lower)) return "Lusso";
  if (/(educativ|didattic|spieg)/.test(lower)) return "Educativo";
  if (/(amichevol|caldo|familiare|empatic)/.test(lower)) return "Amichevole";
  return "Professionale";
}

function extractPlatforms(parsed: Record<string, any>): SocialPlatform[] {
  const materiale = parsed.materiale_iniziale ?? {};
  const links = [
    cleanText(materiale.link_instagram),
    cleanText(materiale.link_facebook),
    cleanText(materiale.link_tiktok),
    cleanText(materiale.instagram),
  ].join(" ").toLowerCase();
  const platforms: SocialPlatform[] = [];
  if (links.includes("instagram")) platforms.push("instagram");
  if (links.includes("facebook")) platforms.push("facebook");
  if (links.includes("tiktok")) platforms.push("tiktok");
  return platforms;
}

function parsedToClientBrief(parsed: Record<string, any>): Partial<ClientBrief> {
  const materiale = parsed.materiale_iniziale ?? {};
  const personas = parsed.target_personas ?? {};
  const servizi = parsed.servizi_chiave ?? {};
  const comportamento = parsed.comportamento_cliente ?? {};
  const posizionamento = parsed.posizionamento ?? {};
  const tov = parsed.tone_of_voice ?? {};
  const competitor = parsed.competitor ?? {};
  const pain = parsed.pain_points_desideri ?? {};
  const socialPreference = parsed.social_preference ?? {};
  const obiettivi = parsed.obiettivi ?? {};

  const targetAudience = [cleanText(personas.tipo_persone), cleanText(personas.fasce_eta), cleanText(personas.locali_o_fuori_zona)]
    .filter(Boolean)
    .join(" | ");
  const primaryObjective = cleanText(obiettivi.comunicazione_social_2026) || cleanText(posizionamento.sogno_crescita);
  const secondaryObjectiveParts = [cleanText(obiettivi.adv_social_2026), cleanText(personas.servizio_da_spingere)].filter(Boolean);
  const secondaryObjectives = secondaryObjectiveParts.join(" | ");
  const toneNotes = [cleanText(tov.stile_comunicazione), cleanText(tov.sensazioni), cleanText(tov.tono_umano_vs_tecnico)]
    .filter(Boolean)
    .join(" | ");
  const competitors = [
    cleanText(competitor.competitor_1),
    cleanText(competitor.competitor_2),
    cleanText(competitor.competitor_3),
    cleanText(competitor.competitor_4_negativo),
  ].filter(Boolean);
  const topicsToCover = splitList(`${cleanText(servizi.servizi_da_comunicare)}\n${cleanText(servizi.novita_progetti)}`);
  const topicsToAvoid = splitList(cleanText(socialPreference.come_non_apparire));
  const usefulLinks = [cleanText(materiale.sito_web), cleanText(materiale.link_instagram), cleanText(materiale.link_facebook), cleanText(materiale.link_tiktok)].filter(Boolean);
  const brandAdjectives = splitList(cleanText(tov.brand_persona)).slice(0, 3);
  while (brandAdjectives.length < 3) brandAdjectives.push("");

  const updates: Partial<ClientBrief> = {
    companyDescription: cleanText(materiale.descrizione_prodotto) || undefined,
    website: cleanText(materiale.sito_web) || undefined,
    targetAudience: targetAudience || undefined,
    targetAge: cleanText(personas.fasce_eta) || undefined,
    lifestyle: cleanText(personas.professione_disponibilita) || undefined,
    geolocation: cleanText(personas.locali_o_fuori_zona) || undefined,
    painPoints: cleanText(pain.pain_points) || cleanText(comportamento.ostacoli) || undefined,
    primaryObjective: primaryObjective || undefined,
    secondaryObjectives: secondaryObjectives || undefined,
    objectives: [primaryObjective, secondaryObjectives].filter(Boolean).join(" | ") || undefined,
    toneOfVoice: cleanText(tov.stile_comunicazione) || cleanText(tov.tono_umano_vs_tecnico) || undefined,
    toneOfVoiceType: inferToneType(cleanText(tov.stile_comunicazione)),
    toneOfVoiceNotes: toneNotes || undefined,
    brandVoice: cleanText(tov.value_proposition) || undefined,
    brandAdjectives,
    brandDonts: cleanText(socialPreference.come_non_apparire) || undefined,
    competitors: competitors.length ? competitors : undefined,
    activePlatforms: extractPlatforms(parsed),
    topicsToCover: topicsToCover.length ? topicsToCover : undefined,
    topicsToAvoid: topicsToAvoid.length ? topicsToAvoid : undefined,
    contactName: cleanText(materiale.nome_referenti) || undefined,
    usefulLinks: usefulLinks.length ? usefulLinks : undefined,
    notes: [cleanText(pain.desideri_obiettivi), cleanText(comportamento.feedback_comuni), cleanText(comportamento.canali_funzionanti)]
      .filter(Boolean)
      .join(" | ") || undefined,
  };

  return Object.fromEntries(Object.entries(updates).filter(([, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    return Boolean(value);
  })) as Partial<ClientBrief>;
}

export function ClientBriefSection({ clientId, clientName }: { clientId: number; clientName: string }) {
  const { clients, activeClient, setActiveClient, updateBrief } = useClientContext();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(true);
  const [rawText, setRawText] = useState("");
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [streamHtml, setStreamHtml] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const [showParsed, setShowParsed] = useState(false);
  const [showStrategy, setShowStrategy] = useState(true);
  const [error, setError] = useState("");
  const [autoFillNotice, setAutoFillNotice] = useState("");
  const [pasteTick, setPasteTick] = useState(0);
  const [autoFillOnPaste, setAutoFillOnPaste] = useState(true);
  const lastAutoFillPasteTickRef = useRef(0);
  const strategyRef = useRef<HTMLDivElement>(null!);

  useEffect(() => {
    if (String(activeClient?.id ?? "") === String(clientId)) return;
    const match = clients.find((item) => String(item.id) === String(clientId));
    if (match) setActiveClient(match);
  }, [activeClient?.id, clientId, clients, setActiveClient]);

  const loadBrief = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/clients/${clientId}/brief`);
      const data = await res.json();
      setBrief(data);
      setRawText(data?.rawText ?? "");
    } catch { /* ignore */ }
    setLoading(false);
  }, [clientId]);

  useEffect(() => { loadBrief(); }, [loadBrief]);

  useEffect(() => {
    try {
      const persisted = localStorage.getItem(AUTOFILL_PASTE_STORAGE_KEY);
      if (persisted === "0") setAutoFillOnPaste(false);
      if (persisted === "1") setAutoFillOnPaste(true);
    } catch {
      // ignore localStorage errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(AUTOFILL_PASTE_STORAGE_KEY, autoFillOnPaste ? "1" : "0");
    } catch {
      // ignore localStorage errors
    }
  }, [autoFillOnPaste]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch(`/api/clients/${clientId}/brief`, {
        method: "PUT",
        body: JSON.stringify({ rawText }),
      });
      const data = await res.json();
      setBrief(data);
    } catch { setError("Errore nel salvataggio"); }
    setSaving(false);
  };

  const parseAndFillBrief = async () => {
    setParsing(true);
    setError("");
    try {
      const normalizedRaw = rawText.trim();
      const persistedRaw = cleanText(brief?.rawText);
      if (normalizedRaw && normalizedRaw !== persistedRaw) {
        const saveRes = await apiFetch(`/api/clients/${clientId}/brief`, {
          method: "PUT",
          body: JSON.stringify({ rawText }),
        });
        if (!saveRes.ok) {
          const saveErr = await saveRes.json().catch(() => ({}));
          setError(saveErr.error || "Errore nel salvataggio del testo brief");
          setParsing(false);
          return;
        }
        setBrief(await saveRes.json());
      }

      const res = await apiFetch(`/api/clients/${clientId}/brief/parse`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Errore nella lettura AI");
        setParsing(false);
        return;
      }
      const data = await res.json();
      setBrief((prev) => prev ? { ...prev, parsedJson: JSON.stringify(data.parsed) } : prev);
      if (data?.parsed && String(activeClient?.id ?? "") === String(clientId)) {
        const mapped = parsedToClientBrief(data.parsed as Record<string, any>);
        if (Object.keys(mapped).length > 0) {
          updateBrief(mapped);
        }
      }
      setShowParsed(true);
    } catch { setError("Errore nella lettura AI"); }
    setParsing(false);
  };

  const handleParse = async () => {
    await parseAndFillBrief();
  };

  useEffect(() => {
    if (pasteTick === 0) return;
    if (!autoFillOnPaste) return;
    if (lastAutoFillPasteTickRef.current === pasteTick) return;
    const value = rawText.trim();
    if (!value || parsing) return;
    lastAutoFillPasteTickRef.current = pasteTick;
    setAutoFillNotice("Testo incollato rilevato: autocompilazione brief in corso...");
    const timer = setTimeout(async () => {
      await parseAndFillBrief();
      setAutoFillNotice("Brief compilato automaticamente da testo incollato.");
      setTimeout(() => setAutoFillNotice(""), 2500);
    }, 650);
    return () => clearTimeout(timer);
  }, [pasteTick, rawText, autoFillOnPaste, parsing]);

  const handleGenerateStrategy = async () => {
    setGenerating(true);
    setStreamHtml("");
    setShowStrategy(true);
    setError("");
    try {
      const res = await portalFetch(`/api/clients/${clientId}/brief/generate-strategy`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Errore nella generazione");
        setGenerating(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let accum = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const parsed = JSON.parse(line.slice(6));
                if (parsed.type === "delta") {
                  accum += parsed.text;
                  setStreamHtml(accum);
                } else if (parsed.type === "done") {
                  setBrief((prev) => prev ? { ...prev, strategyHtml: accum, strategyStatus: "ready" } : prev);
                } else if (parsed.type === "error") {
                  setError(parsed.message);
                }
              } catch { /* skip malformed */ }
            }
          }
        }
      }
    } catch { setError("Errore nella generazione della strategia"); }
    setGenerating(false);
  };

  const handleDelete = async () => {
    if (!confirm("Sei sicuro di voler eliminare il brief e la strategia?")) return;
    await apiFetch(`/api/clients/${clientId}/brief`, { method: "DELETE" });
    setBrief(null);
    setRawText("");
    setStreamHtml("");
  };

  let parsedData: Record<string, Record<string, string>> = {};
  try {
    if (brief?.parsedJson && brief.parsedJson !== "{}") {
      parsedData = JSON.parse(brief.parsedJson);
    }
  } catch { /* ignore */ }

  const hasParsed = Object.keys(parsedData).length > 0;
  const strategyContent = generating ? streamHtml : (brief?.strategyHtml ?? "");
  const hasStrategy = !!strategyContent.trim();

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8">
        <Loader2 className="w-4 h-4 animate-spin" /> Caricamento brief...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Brief & Strategia</h3>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              autoFillOnPaste ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground",
            )}
            title={autoFillOnPaste ? "Autocompilazione al paste attiva" : "Autocompilazione al paste disattiva"}
          >
            AUTO {autoFillOnPaste ? "ON" : "OFF"}
          </span>
        </div>
        {brief && (
          <button onClick={handleDelete} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors" title="Elimina brief">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {autoFillNotice && !error && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {autoFillNotice}
        </div>
      )}

      <div className="space-y-2">
        <button onClick={() => setShowRaw(!showRaw)} className="flex items-center gap-2 w-full text-left text-sm font-semibold text-foreground hover:text-primary transition-colors">
          {showRaw ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          <ClipboardPaste className="w-4 h-4" />
          1. Incolla il Questionario Compilato
        </button>

        {showRaw && (
          <div className="space-y-3 pl-6">
            <p className="text-xs text-muted-foreground">
              Incolla qui le domande e le risposte del questionario compilato dal cliente. L'AI le organizzeranno automaticamente.
            </p>
            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={autoFillOnPaste}
                onChange={(e) => setAutoFillOnPaste(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Autocompilazione al paste
            </label>
            <textarea
              className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none font-mono"
              rows={12}
              placeholder="Incolla qui il testo del questionario..."
              value={rawText}
              onPaste={() => {
                setAutoFillNotice("");
                if (autoFillOnPaste) {
                  setPasteTick((prev) => prev + 1);
                }
              }}
              onChange={(e) => setRawText(e.target.value)}
            />
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving || !rawText.trim()} className={cn(
                "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
                "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              )}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Salva Testo
              </button>
              <button onClick={handleParse} disabled={parsing || !rawText.trim()} className={cn(
                "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
                "bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
              )}>
                {parsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Organizza con AI + Compila Brief
              </button>
            </div>
          </div>
        )}
      </div>

      {hasParsed && (
        <div className="space-y-2">
          <button onClick={() => setShowParsed(!showParsed)} className="flex items-center gap-2 w-full text-left text-sm font-semibold text-foreground hover:text-primary transition-colors">
            {showParsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <FileText className="w-4 h-4" />
            2. Dati Organizzati del Brief
          </button>

          {showParsed && (
            <div className="pl-6 space-y-4">
              {Object.entries(parsedData).map(([sectionKey, fields]) => {
                const filledFields = Object.entries(fields as Record<string, string>).filter(([, v]) => v && v.trim());
                if (!filledFields.length) return null;
                return (
                  <div key={sectionKey} className="rounded-lg border border-border bg-card p-4 space-y-3">
                    <h4 className="text-sm font-semibold text-primary">{SECTION_LABELS[sectionKey] ?? sectionKey}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {filledFields.map(([fieldKey, value]) => (
                        <div key={fieldKey}>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{FIELD_LABELS[fieldKey] ?? fieldKey}</p>
                          <p className="text-sm mt-0.5 whitespace-pre-wrap">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <button onClick={() => setShowStrategy(!showStrategy)} className="flex items-center gap-2 w-full text-left text-sm font-semibold text-foreground hover:text-primary transition-colors">
          {showStrategy ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          <Sparkles className="w-4 h-4" />
          3. Strategia Completa
        </button>

        {showStrategy && (
          <div className="pl-6 space-y-3">
            <div className="flex gap-2 flex-wrap">
              <button onClick={handleGenerateStrategy} disabled={generating || (!brief?.rawText?.trim() && !hasParsed)} className={cn(
                "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
                "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              )}>
                {generating ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generazione in corso...</>
                ) : hasStrategy ? (
                  <><RefreshCw className="w-3.5 h-3.5" /> Rigenera Strategia</>
                ) : (
                  <><Sparkles className="w-3.5 h-3.5" /> Genera Strategia</>
                )}
              </button>
              {hasStrategy && !generating && (
                <button onClick={() => {
                  const pdf = generateStrategyPDF(clientName, strategyContent);
                  pdf.save(`Strategia_${clientName.replace(/\s+/g, "_")}_${new Date().getFullYear()}_BeKind.pdf`);
                }} className={cn(
                  "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}>
                  <Download className="w-3.5 h-3.5" /> Scarica PDF
                </button>
              )}
            </div>

            {hasStrategy && (
              <div ref={strategyRef} className={cn(
                "rounded-lg border border-border bg-card p-6 prose prose-sm max-w-none dark:prose-invert",
                "prose-h2:text-primary prose-h2:text-lg prose-h2:mt-6 prose-h2:mb-3 prose-h2:border-b prose-h2:border-border prose-h2:pb-2",
                "prose-h3:text-base prose-h3:mt-4 prose-h3:mb-2",
                "prose-p:text-foreground prose-p:leading-relaxed",
                "prose-strong:text-foreground",
                "prose-ul:pl-5 prose-li:text-foreground",
                "prose-blockquote:border-primary prose-blockquote:bg-primary/5 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-blockquote:px-4",
                generating && "animate-pulse"
              )} dangerouslySetInnerHTML={{ __html: strategyContent }} />
            )}

            {!hasStrategy && !generating && (
              <p className="text-sm text-muted-foreground">
                {brief?.rawText?.trim() || hasParsed
                  ? "Clicca \"Genera Strategia\" per creare una strategia completa basata sul brief del cliente."
                  : "Prima incolla e salva il questionario compilato dal cliente, poi potrai generare la strategia."}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
