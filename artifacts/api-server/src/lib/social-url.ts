/**
 * Normalizzazione + riconoscimento piattaforma per i link della Banca Idee.
 *
 * Sta lato server e NON in agency-portal/src/lib perché è una validazione di
 * sicurezza: il cliente (area /portal/:token, senza login) incolla URL arbitrari
 * che poi finiscono in un `href` renderizzato, e un controllo fatto solo nel
 * browser è aggirabile con una POST diretta all'endpoint pubblico.
 */

const PLATFORM_HOSTS: { platform: string; hosts: string[] }[] = [
  { platform: "instagram", hosts: ["instagram.com", "instagr.am"] },
  { platform: "tiktok", hosts: ["tiktok.com"] },
  { platform: "youtube", hosts: ["youtube.com", "youtu.be"] },
  { platform: "facebook", hosts: ["facebook.com", "fb.com", "fb.watch"] },
  { platform: "linkedin", hosts: ["linkedin.com"] },
  { platform: "pinterest", hosts: ["pinterest.com", "pinterest.it", "pin.it"] },
];

/** Deriva la piattaforma dall'hostname dell'URL. Fallback: "web". */
export function derivePlatform(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    for (const entry of PLATFORM_HOSTS) {
      if (entry.hosts.some((h) => host === h || host.endsWith(`.${h}`))) return entry.platform;
    }
    return "web";
  } catch {
    return "web";
  }
}

/**
 * Aggiunge https:// se manca lo schema (si incolla spesso "instagram.com/p/…"),
 * poi accetta SOLO http/https: blocca javascript:, data:, file:, che in un href
 * diventerebbero XSS al click. Ritorna l'URL normalizzato, o null se non valido.
 */
export function normalizeExternalUrl(raw: string): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || trimmed.length > 2000) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  // Un hostname senza punto non è un dominio pubblico (localhost, hostname
  // interni): non ha senso come "link di ispirazione" e non deve entrare in DB.
  if (!parsed.hostname.includes(".")) return null;
  return parsed.toString();
}
