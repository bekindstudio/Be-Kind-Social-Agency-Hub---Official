/** Dati agenzia predefiniti (allineati al portale / preventivi). */
export const DEFAULT_AGENCY = {
  AGENZIA_NOME: "Michael Balleroni — Be Kind Social",
  AGENZIA_INDIRIZZO: "Via C. Menotti, 184 — 61122 Pesaro (PU)",
  AGENZIA_PIVA: "02871720419",
  AGENZIA_PEC: "michaelballeroni@pec.it",
  AGENZIA_IBAN: "IT60X0542811101000000123456",
};

export function defaultLogoUrl(): string {
  if (typeof window === "undefined") return "/logo-bekind.png";
  const base = import.meta.env.BASE_URL || "/";
  const path = base.endsWith("/") ? `${base}logo-bekind.png` : `${base}/logo-bekind.png`;
  return new URL(path, window.location.origin).href;
}

export const SERVICE_SLUGS = [
  "social_mensile",
  "ads",
  "content_plan",
  "consulenza",
  "full_service",
  "una_tantum",
] as const;

export type ServiceSlug = (typeof SERVICE_SLUGS)[number];

export const SERVICE_LABELS: Record<ServiceSlug, { title: string; description: string }> = {
  social_mensile: {
    title: "Gestione Social Media",
    description: "Piano mensile, contenuti e reportistica.",
  },
  ads: {
    title: "Campagne Ads",
    description: "Meta, Google, TikTok — KPI e budget.",
  },
  content_plan: {
    title: "Content & creatività",
    description: "Piano contenuti, formati e revisioni.",
  },
  consulenza: {
    title: "Consulenza strategica",
    description: "Ore dedicate, NDA e modalità.",
  },
  full_service: {
    title: "Full service",
    description: "Pacchetto integrato con SLA e referente.",
  },
  una_tantum: {
    title: "Progetto una tantum",
    description: "Milestone, acconti e consegna.",
  },
};

/** Sostituisce {{CHIAVE}} nel testo/HTML. */
export function applyContractVariables(html: string, vars: Record<string, string>): string {
  let out = html;
  for (const [k, v] of Object.entries(vars)) {
    const safe = v ?? "";
    out = out.replaceAll(`{{${k}}}`, safe);
  }
  return out;
}

/** Estrae le chiavi {{UPPER_SNAKE}} dal contenuto. */
export function extractVariableKeys(html: string): string[] {
  const set = new Set<string>();
  const re = /\{\{([A-Z0-9_]+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    set.add(m[1]!);
  }
  return [...set].sort();
}

/** Evidenzia le variabili in HTML (solo anteprima interna). */
export function highlightVariablesInHtml(html: string): string {
  return html.replace(
    /\{\{([A-Z0-9_]+)\}\}/g,
    '<span class="contract-var-token" data-var="1">{{$1}}</span>',
  );
}

export function todayIt(): string {
  return new Date().toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
