/**
 * Feature flag lato client.
 *
 * AI_ENABLED: le funzioni AI (Caption AI, Idee, AI Assistant, chat) sono
 * mostrate solo se VITE_AI_ENABLED === "true" al build. Disabilitate di
 * default — coerente col gate AI_ENABLED lato API. Per riattivarle: impostare
 * VITE_AI_ENABLED=true (build) e AI_ENABLED=true + le env AI (runtime).
 */
export const AI_ENABLED =
  String(import.meta.env.VITE_AI_ENABLED ?? "").trim() === "true";

/** Href di navigazione che dipendono dall'AI (nascosti quando AI_ENABLED è false). */
export const AI_NAV_HREFS = new Set<string>([
  "/ai-assistant",
  "/tools/caption-ai",
  "/tools/content-ideas",
]);
