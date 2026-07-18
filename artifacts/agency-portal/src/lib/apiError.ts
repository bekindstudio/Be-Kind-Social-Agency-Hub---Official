/**
 * Estrae il messaggio d'errore VERO da una Response dell'API, così i toast
 * mostrano la causa reale invece di un generico "Riprova". Regola di prodotto
 * sentita dall'utente: mai errori muti o generici.
 *
 * Prova prima il JSON ({error} o {message}), poi il testo grezzo; in ultima
 * istanza ripiega su "HTTP <status>". Non lancia mai.
 */
export async function apiErrorDetail(r: Response): Promise<string> {
  try {
    const clone = r.clone();
    const body = await clone.json().catch(() => null);
    if (body && typeof body === "object") {
      const b = body as Record<string, unknown>;
      if (typeof b.error === "string" && b.error.trim()) return b.error;
      if (typeof b.message === "string" && b.message.trim()) return b.message;
      // errori di validazione zod: array di {message}
      if (Array.isArray(b.issues) && b.issues.length) {
        const msgs = b.issues
          .map((i: any) => (i?.message ? String(i.message) : ""))
          .filter(Boolean);
        if (msgs.length) return msgs.join(" · ");
      }
    }
  } catch { /* fall through */ }
  try {
    const t = (await r.text()).trim();
    if (t) return t.slice(0, 300);
  } catch { /* fall through */ }
  return `HTTP ${r.status}`;
}
