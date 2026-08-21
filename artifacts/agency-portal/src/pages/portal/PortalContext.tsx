import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { portalGet, PortalAuthError } from "./portalApi";

/**
 * Stato condiviso del portale: token, branding, conteggi, e una cache
 * stale-while-revalidate in memoria. La cache vive per tutta la sessione del
 * portale (il provider resta montato mentre si cambia schermata) → cambiando
 * tab la schermata mostra subito i dati già visti e li rinfresca in background,
 * niente flash di spinner (fix bug 7).
 */

export type PortalBrand = {
  name: string;
  logo: string | null;
  color: string | null;
  cover: string | null;
  driveUrl: string | null;
  /** True se il cliente ha un ingaggio sul web: mostra il "Brief Sito Web". */
  wantsWebsite: boolean;
};
export type PortalCounts = { upcomingContent: number; ideas: number; reports: number };

type CacheEntry = { data: unknown; ts: number };

type Ctx = {
  token: string;
  brand: PortalBrand;
  counts: PortalCounts;
  /** Stato del contratto visibile nel portale: "inviato" | "firmato" | null. */
  contractStatus: string | null;
  cache: Map<string, CacheEntry>;
  onAuthExpired: () => void;
};

const PortalCtx = createContext<Ctx | null>(null);

export function PortalProvider({
  token, brand, counts, contractStatus = null, onAuthExpired, children,
}: {
  token: string;
  brand: PortalBrand;
  counts: PortalCounts;
  contractStatus?: string | null;
  onAuthExpired: () => void;
  children: ReactNode;
}) {
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  return (
    <PortalCtx.Provider value={{ token, brand, counts, contractStatus, cache: cacheRef.current, onAuthExpired }}>
      {children}
    </PortalCtx.Provider>
  );
}

export function usePortal(): Ctx {
  const c = useContext(PortalCtx);
  if (!c) throw new Error("usePortal fuori da PortalProvider");
  return c;
}

/** Hook dati SWR: { data, loading, error, refetch }. Vuoto ≠ errore. */
export function usePortalData<T>(path: string) {
  const { token, cache, onAuthExpired } = usePortal();
  const cached = cache.get(path);
  const [data, setData] = useState<T | null>((cached?.data as T) ?? null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    setLoading((prev) => prev && cache.get(path) == null);
    try {
      const fresh = await portalGet<T>(token, path);
      cache.set(path, { data: fresh, ts: Date.now() });
      setData(fresh);
      setLoading(false);
    } catch (e) {
      if (e instanceof PortalAuthError) { onAuthExpired(); return; }
      setLoading(false);
      setError(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, path]);

  useEffect(() => { void load(); }, [load]);

  return { data, loading, error, refetch: load };
}
