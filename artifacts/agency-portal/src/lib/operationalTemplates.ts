import type { ClientBrief } from "@/types/client";

export type OperationalTemplateId = "ristorazione" | "ecommerce" | "b2b";

export interface OperationalTemplate {
  id: OperationalTemplateId;
  label: string;
  industries: string[];
  description: string;
  briefPatch: Partial<ClientBrief>;
  calendarPreset: {
    postsPerWeek: number;
    preferredDays: string[];
    preferredTime: string;
  };
  captionStyle: {
    toneHint: string;
    defaultObjective: string;
    defaultLength: "short" | "medium" | "long";
    includeEmoji: boolean;
    includeHashtags: boolean;
    keywordHints: string[];
  };
  reportChecklist: string[];
}

const STORAGE_KEY = "agency_hub_operational_template_by_client_v1";

export const OPERATIONAL_TEMPLATES: OperationalTemplate[] = [
  {
    id: "ristorazione",
    label: "Ristorazione",
    industries: ["ristorazione", "food", "restaurant", "bar", "pizzeria"],
    description: "Preset orientato a prenotazioni, UGC e contenuti visual ad alta frequenza.",
    briefPatch: {
      toneOfVoiceType: "Amichevole",
      targetGender: "Misto",
      activePlatforms: ["instagram", "facebook", "tiktok"],
      formatPreferences: ["Reel/Video", "Stories", "Post foto"],
      topicsToCover: ["Dietro le quinte", "Piatti stagionali", "Recensioni clienti", "Promo settimanali"],
      topicsToAvoid: ["Contenuti troppo istituzionali", "Copy lunghi senza CTA"],
      brandHashtags: ["#foodlovers", "#ristorante", "#instafood"],
      kpis: [
        { label: "Prenotazioni da social", target: "+20", unit: "%" },
        { label: "Engagement rate", target: "5", unit: "%" },
      ],
      approvalWindow: "Entro 24h nei giorni feriali",
    },
    calendarPreset: {
      postsPerWeek: 5,
      preferredDays: ["lunedi", "mercoledi", "venerdi", "sabato"],
      preferredTime: "11:30",
    },
    captionStyle: {
      toneHint: "Caldo, diretto, orientato all'esperienza in sala.",
      defaultObjective: "Aumentare engagement",
      defaultLength: "medium",
      includeEmoji: true,
      includeHashtags: true,
      keywordHints: ["prenota ora", "menu del giorno", "posti limitati"],
    },
    reportChecklist: [
      "Riepilogo prenotazioni generate dai social",
      "Top 5 contenuti per engagement",
      "Analisi stories (tap forward/back, uscite)",
      "Commenti e recensioni qualitative",
      "Piano promo settimana successiva",
    ],
  },
  {
    id: "ecommerce",
    label: "Ecommerce",
    industries: ["ecommerce", "fashion", "retail", "shop", "beauty"],
    description: "Preset focalizzato su conversioni, funnel e creatività prodotto.",
    briefPatch: {
      toneOfVoiceType: "Ispirazionale",
      targetGender: "Misto",
      activePlatforms: ["instagram", "facebook", "tiktok"],
      formatPreferences: ["Reel/Video", "Carosello", "Post foto", "Stories"],
      topicsToCover: ["Benefit prodotto", "UGC e recensioni", "FAQ acquisto", "Offerte limited"],
      topicsToAvoid: ["Comunicazione generica senza benefit", "Solo promozioni senza storytelling"],
      brandHashtags: ["#newcollection", "#shopnow", "#musthave"],
      kpis: [
        { label: "CTR campagne", target: "2.5", unit: "%" },
        { label: "ROAS", target: "3", unit: "x" },
      ],
      approvalWindow: "Entro 12h per contenuti promo",
    },
    calendarPreset: {
      postsPerWeek: 6,
      preferredDays: ["lunedi", "martedi", "giovedi", "venerdi", "domenica"],
      preferredTime: "18:30",
    },
    captionStyle: {
      toneHint: "Benefit-first, orientato alla conversione con CTA forte.",
      defaultObjective: "Promuovere prodotto/servizio",
      defaultLength: "short",
      includeEmoji: true,
      includeHashtags: true,
      keywordHints: ["spedizione veloce", "acquista ora", "stock limitato"],
    },
    reportChecklist: [
      "Riepilogo vendite attribuite social/ads",
      "Funnel: impression -> click -> conversione",
      "Top creatività per CTR e ROAS",
      "Prodotti best seller e underperforming",
      "Test A/B consigliati per prossimo ciclo",
    ],
  },
  {
    id: "b2b",
    label: "B2B / Servizi",
    industries: ["b2b", "saas", "consulenza", "software", "studio"],
    description: "Preset orientato a lead qualificati e autorevolezza di settore.",
    briefPatch: {
      toneOfVoiceType: "Professionale",
      targetGender: "Misto",
      activePlatforms: ["linkedin", "instagram"],
      formatPreferences: ["Articoli", "Carosello", "Post foto"],
      topicsToCover: ["Case study", "Insight verticali", "Processo e metodo", "FAQ decision maker"],
      topicsToAvoid: ["Clickbait", "Tone troppo leggero su temi tecnici"],
      brandHashtags: ["#businessgrowth", "#leadgeneration", "#industryinsights"],
      kpis: [
        { label: "Lead qualificati", target: "30", unit: "/mese" },
        { label: "CPL", target: "-15", unit: "%" },
      ],
      approvalWindow: "48h con revisione stakeholder",
    },
    calendarPreset: {
      postsPerWeek: 3,
      preferredDays: ["martedi", "giovedi"],
      preferredTime: "09:00",
    },
    captionStyle: {
      toneHint: "Data-driven, chiaro, autorevole con CTA di approfondimento.",
      defaultObjective: "Generare traffico",
      defaultLength: "long",
      includeEmoji: false,
      includeHashtags: true,
      keywordHints: ["scarica il case study", "prenota una demo", "parliamone"],
    },
    reportChecklist: [
      "Lead inbound e qualità lead",
      "Performance contenuti thought leadership",
      "Confronto traffico social -> landing",
      "Pipeline influenzata dalle campagne",
      "Azioni prioritarie per il prossimo mese",
    ],
  },
];

function readStorage(): Record<string, OperationalTemplateId> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, OperationalTemplateId>;
  } catch {
    return {};
  }
}

export function getOperationalTemplateById(id: OperationalTemplateId | null | undefined): OperationalTemplate | null {
  if (!id) return null;
  return OPERATIONAL_TEMPLATES.find((template) => template.id === id) ?? null;
}

export function inferTemplateFromIndustry(industry?: string): OperationalTemplate | null {
  if (!industry) return null;
  const needle = industry.trim().toLowerCase();
  if (!needle) return null;
  return (
    OPERATIONAL_TEMPLATES.find((template) =>
      template.industries.some((token) => needle.includes(token)),
    ) ?? null
  );
}

export function getClientOperationalTemplateId(clientId: string): OperationalTemplateId | null {
  const map = readStorage();
  return map[clientId] ?? null;
}

export function setClientOperationalTemplateId(clientId: string, templateId: OperationalTemplateId): void {
  const map = readStorage();
  map[clientId] = templateId;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}
