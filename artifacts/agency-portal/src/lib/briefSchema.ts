import {
  FileText,
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

/* Schema condiviso del Brief cliente: usato sia dalla pagina interna
   (BriefPage) sia dall'area cliente pubblica (ClientPortalPage). */

export type BriefField = { key: string; label: string; placeholder?: string; long?: boolean };
export type BriefSection = {
  key: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  hint?: string;
  fields: BriefField[];
};
export type BriefData = Record<string, Record<string, string>>;

export const BRIEF_SECTIONS: BriefSection[] = [
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

export function emptyBriefData(): BriefData {
  const d: BriefData = {};
  for (const s of BRIEF_SECTIONS) {
    d[s.key] = {};
    for (const f of s.fields) d[s.key][f.key] = "";
  }
  return d;
}

export function normalizeBriefData(parsed: unknown): BriefData {
  const base = emptyBriefData();
  if (!parsed || typeof parsed !== "object") return base;
  for (const s of BRIEF_SECTIONS) {
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

export function briefSectionFilled(data: BriefData, s: BriefSection): number {
  return s.fields.filter((f) => (data[s.key]?.[f.key] ?? "").trim().length > 0).length;
}
