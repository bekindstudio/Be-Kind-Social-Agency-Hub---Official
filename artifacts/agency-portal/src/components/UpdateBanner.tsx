import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

/**
 * Avviso "nuova versione disponibile".
 *
 * Problema che risolve: la PWA installata cachea la grafica (service worker) e,
 * se resta aperta o in background, continua a mostrare la versione vecchia dopo
 * un deploy — servivano hard refresh manuali.
 *
 * Come funziona: alla prima apertura memorizza il marker di build live
 * (/api/version, pubblico). Poi ricontrolla al focus della finestra e ogni paio
 * di minuti; se il marker è cambiato → il server ha una versione più nuova →
 * mostra la barra. "Aggiorna" DEREGISTRA il service worker, svuota le cache e
 * ricarica: così arrivano davvero i file nuovi.
 */
export function UpdateBanner() {
  const initialMarker = useRef<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    let alive = true;

    const check = async () => {
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        const marker = String(j?.marker ?? "");
        if (!marker) return;
        if (initialMarker.current == null) {
          initialMarker.current = marker; // baseline alla prima apertura
          return;
        }
        if (marker !== initialMarker.current && alive) setUpdateAvailable(true);
      } catch {
        /* offline o errore: non disturbare */
      }
    };

    void check();
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    const intervalId = window.setInterval(() => void check(), 120_000);

    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(intervalId);
    };
  }, []);

  if (!updateAvailable) return null;

  const applyUpdate = async () => {
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((reg) => reg.unregister()));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      /* se la pulizia fallisce, ricarico comunque */
    }
    window.location.reload();
  };

  return (
    <div className="fixed inset-x-0 bottom-4 z-[100] flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto inline-flex items-center gap-3 rounded-xl border border-card-border bg-card px-4 py-2.5 shadow-lg">
        <RefreshCw size={15} className="text-primary shrink-0" />
        <span className="text-sm">È disponibile una nuova versione.</span>
        <button
          type="button"
          onClick={() => void applyUpdate()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
        >
          Aggiorna
        </button>
      </div>
    </div>
  );
}
