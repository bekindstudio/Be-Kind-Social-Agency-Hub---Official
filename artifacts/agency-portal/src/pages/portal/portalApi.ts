/**
 * Layer di rete del portale pubblico. Nessun login: il token nell'URL è la
 * chiave, i fetch sono same-origin (il cookie PIN viaggia da solo).
 *
 * Punto chiave (fix bug): distingue con nettezza VUOTO (200 con lista vuota) da
 * ERRORE (401/410/404/5xx). Prima un 500 o un PIN scaduto diventava data=null e
 * la UI mostrava un falso "nessun dato". Un 401 con { pinRequired } segnala che
 * il PIN è scaduto a metà sessione → la shell può ri-mostrare la schermata PIN.
 */

export const portalUrl = (token: string, path = "") =>
  `/api/public/portal/${encodeURIComponent(token)}${path}`;

export class PortalAuthError extends Error {
  constructor() { super("PIN_REQUIRED"); }
}
export class PortalHttpError extends Error {
  constructor(public status: number) { super(`HTTP_${status}`); }
}

/** GET che ritorna il JSON, o lancia PortalAuthError / PortalHttpError. */
export async function portalGet<T>(token: string, path: string): Promise<T> {
  const r = await fetch(portalUrl(token, path));
  if (r.ok) return (await r.json()) as T;
  if (r.status === 401) {
    const body = await r.json().catch(() => ({}));
    if ((body as { pinRequired?: boolean })?.pinRequired) throw new PortalAuthError();
  }
  throw new PortalHttpError(r.status);
}

/** POST/PUT con corpo JSON. Ritorna { ok, status, data }. */
export async function portalSend<T = unknown>(
  token: string, path: string, method: "POST" | "PUT", body: unknown,
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const r = await fetch(portalUrl(token, path), {
    method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const data = (await r.json().catch(() => null)) as T | null;
  return { ok: r.ok, status: r.status, data };
}
