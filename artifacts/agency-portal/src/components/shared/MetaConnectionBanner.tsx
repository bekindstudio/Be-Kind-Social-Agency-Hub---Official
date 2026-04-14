import { AlertTriangle, RefreshCw, Link as LinkIcon } from "lucide-react";
import { Link } from "wouter";
import type { MetaApiError } from "@/services/metaApi";

interface MetaConnectionBannerProps {
  error: MetaApiError | null;
  lastSyncAt: string | null;
  isStale: boolean;
  onSync: () => void;
  syncing?: boolean;
}

export function MetaConnectionBanner({ error, lastSyncAt, isStale, onSync, syncing = false }: MetaConnectionBannerProps) {
  if (error?.error === "TOKEN_EXPIRED") {
    return (
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800 text-sm flex items-center justify-between gap-2">
        <span>Il token Meta e scaduto. Ricollega l'account dalla pagina Impostazioni.</span>
        <Link href="/settings" className="inline-flex items-center gap-1 text-xs font-semibold underline">
          <LinkIcon size={12} />
          Vai alle impostazioni
        </Link>
      </div>
    );
  }

  if (error?.error === "INSUFFICIENT_PERMISSIONS") {
    return (
      <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700 text-sm">
        Permessi Meta mancanti. Verifica i permessi richiesti in Impostazioni.
      </div>
    );
  }

  if (isStale) {
    return (
      <div className="mb-4 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-3 text-blue-800 text-sm flex items-center justify-between gap-2">
        <span>
          Dati aggiornati {lastSyncAt ? new Date(lastSyncAt).toLocaleString("it-IT") : "tempo fa"}.
          Potrebbero essere obsoleti.
        </span>
        <button
          onClick={onSync}
          disabled={syncing}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md bg-blue-600 text-white disabled:opacity-60"
        >
          <RefreshCw size={12} className={syncing ? "animate-spin" : ""} />
          Sincronizza ora
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800 text-sm flex items-center gap-2">
        <AlertTriangle size={14} />
        <span>{error.message ?? "Errore nella connessione Meta."}</span>
      </div>
    );
  }

  return null;
}
