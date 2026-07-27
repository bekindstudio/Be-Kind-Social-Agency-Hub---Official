/**
 * Motore di calcolo del preventivo, condiviso tra server e client.
 *
 * IMPORTANTE: il server è l'autorità. Il client usa queste funzioni solo per
 * mostrare il prezzo in tempo reale mentre il prospect compone; al momento
 * dell'invio il server ricalcola tutto da capo e ignora i numeri del client
 * (che potrebbero essere manomessi).
 */

export type QuoteTier = { label: string; value: string; price: number };
export type QuoteOption = { label: string; key: string; multi?: boolean; choices: string[] };

export type QuoteServiceDef = {
  key: string;
  name: string;
  description?: string | null;
  category: string;
  billing: "monthly" | "oneoff";
  pricing: "fixed" | "tiered" | "per_unit";
  basePrice: number;
  unitLabel?: string | null;
  unitPrice?: number | null;
  minQty: number;
  maxQty: number;
  tiers: QuoteTier[];
  options: QuoteOption[];
};

/** Una riga scelta dal prospect. */
export type QuoteSelectionItem = {
  key: string;
  tier?: string | null;
  qty?: number | null;
  /** scelte informative (canali, obiettivi…): non incidono sul prezzo. */
  choices?: Record<string, string[]>;
};

/** Regole di sconto e durata. In codice: cambiano di rado e si limano con calma. */
export const QUOTE_SETTINGS = {
  minMonths: 4,
  monthsOptions: [4, 6, 12],
  /** Sconto bundle in base al numero di servizi scelti. */
  bundleTiers: [
    { minServices: 5, percent: 15 },
    { minServices: 3, percent: 10 },
  ] as { minServices: number; percent: number }[],
  /** Tetto allo sconto totale (bundle + codice), a protezione del margine. */
  maxDiscountPercent: 20,
};

export function bundlePercentFor(serviceCount: number): number {
  for (const t of QUOTE_SETTINGS.bundleTiers) {
    if (serviceCount >= t.minServices) return t.percent;
  }
  return 0;
}

/** Prezzo di una singola riga (prima degli sconti). */
export function lineTotal(service: QuoteServiceDef, item: QuoteSelectionItem): number {
  if (service.pricing === "fixed") return Math.max(0, service.basePrice);
  if (service.pricing === "tiered") {
    const tier = service.tiers.find((t) => t.value === item.tier) ?? service.tiers[0];
    return tier ? Math.max(0, tier.price) : 0;
  }
  if (service.pricing === "per_unit") {
    const qty = Math.min(service.maxQty, Math.max(service.minQty, Math.floor(item.qty ?? 0)));
    return Math.max(0, (service.unitPrice ?? 0) * qty);
  }
  return 0;
}

export type QuoteBreakdown = {
  lines: Array<{ key: string; name: string; billing: "monthly" | "oneoff"; amount: number; label: string }>;
  serviceCount: number;
  months: number;
  monthlySubtotal: number;
  oneoffSubtotal: number;
  bundlePercent: number;
  codePercent: number;
  discountPercent: number;
  monthlyDiscounted: number;
  contractTotal: number;
  /** Acconto da versare ora: il primo mese (scontato). */
  deposit: number;
};

/**
 * Calcolo completo. `codePercent` è già validato a monte (0 se codice assente
 * o non valido). Lo sconto si applica SOLO al ricorrente mensile, non alle voci
 * una-tantum: è lì che il volume conta e va protetto il margine sulle ore.
 */
export function computeQuote(
  services: QuoteServiceDef[],
  selection: QuoteSelectionItem[],
  months: number,
  codePercent = 0,
): QuoteBreakdown {
  const byKey = new Map(services.map((s) => [s.key, s]));
  const safeMonths = QUOTE_SETTINGS.monthsOptions.includes(months) ? months : QUOTE_SETTINGS.minMonths;

  const lines: QuoteBreakdown["lines"] = [];
  let monthlySubtotal = 0;
  let oneoffSubtotal = 0;

  for (const item of selection) {
    const service = byKey.get(item.key);
    if (!service) continue;
    const amount = lineTotal(service, item);
    if (amount <= 0 && service.pricing === "per_unit") continue; // 0 unità = non incluso
    let label = service.name;
    if (service.pricing === "tiered") {
      const tier = service.tiers.find((t) => t.value === item.tier) ?? service.tiers[0];
      if (tier) label = `${service.name} · ${tier.label}`;
    } else if (service.pricing === "per_unit") {
      const qty = Math.min(service.maxQty, Math.max(service.minQty, Math.floor(item.qty ?? 0)));
      label = `${service.name} · ${qty} ${service.unitLabel ?? "pz"}`;
    }
    lines.push({ key: service.key, name: service.name, billing: service.billing, amount, label });
    if (service.billing === "monthly") monthlySubtotal += amount;
    else oneoffSubtotal += amount;
  }

  const serviceCount = lines.length;
  const bundlePercent = bundlePercentFor(serviceCount);
  const discountPercent = Math.min(QUOTE_SETTINGS.maxDiscountPercent, bundlePercent + Math.max(0, codePercent));

  const monthlyDiscounted = Math.round(monthlySubtotal * (1 - discountPercent / 100));
  const contractTotal = monthlyDiscounted * safeMonths + oneoffSubtotal;
  const deposit = monthlyDiscounted; // il primo mese

  return {
    lines,
    serviceCount,
    months: safeMonths,
    monthlySubtotal,
    oneoffSubtotal,
    bundlePercent,
    codePercent: Math.max(0, codePercent),
    discountPercent,
    monthlyDiscounted,
    contractTotal,
    deposit,
  };
}
