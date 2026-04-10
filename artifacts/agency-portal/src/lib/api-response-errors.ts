/**
 * Se la risposta è HTML (es. pagina errore Express o altro host), spiega in italiano
 * cause tipiche (proxy / rewrite / dominio API sbagliato).
 */
export function describeApiFailureForUser(
  status: number,
  rawBody: string,
  jsonFallback: string,
): string {
  const s = rawBody.trim();
  if (s.startsWith("<!DOCTYPE") || s.toLowerCase().startsWith("<html")) {
    if (/publishable key|clerk\.com|@clerk|clerk\.accounts/i.test(s)) {
      return [
        "La richiesta non sta raggiungendo l'API di questo progetto (Node/Express su Render) ma un altro servizio: il testo «Publishable key» è tipico di Clerk.",
        "",
        "Cosa controllare: su Vercel devono esserci i rewrite da /api verso l'URL del tuo servizio Render (vedi vercel.json nel repo). In locale, avvia l'api-server e verifica VITE_API_PROXY_TARGET / la proxy /api in vite.config verso quella porta.",
      ].join("\n");
    }
    return `Il server ha risposto con una pagina HTML (HTTP ${status}) invece di JSON: probabile URL dell'API errato o proxy non configurato. (${jsonFallback.slice(0, 160)}…)`;
  }
  return jsonFallback;
}
