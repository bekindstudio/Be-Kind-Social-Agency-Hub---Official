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
    if (/publishable key|wrong host|invalid api key/i.test(s)) {
      return [
        "La richiesta non sta raggiungendo l'API di questo progetto (Node/Express come Vercel Function): la risposta HTML sembra provenire da un altro host o da un gateway di autenticazione.",
        "",
        "Cosa controllare: l'API è servita same-origin su /api dalla Vercel Function (vedi api/ e vercel.json nel repo); verifica che le variabili d'ambiente dell'API siano impostate sul progetto Vercel. In locale, avvia l'api-server e controlla VITE_API_PROXY_TARGET / la proxy /api in vite.config verso quella porta.",
      ].join("\n");
    }
    return `Il server ha risposto con una pagina HTML (HTTP ${status}) invece di JSON: probabile URL dell'API errato o proxy non configurato. (${jsonFallback.slice(0, 160)}…)`;
  }
  return jsonFallback;
}
