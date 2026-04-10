import { Loader2, RotateCcw } from "lucide-react";
import { useAutoSaveContext } from "@/context/AutoSaveContext";
import { cn } from "@/lib/utils";

/** Indicatore stato salvataggio (angolo header). */
export function AutoSaveIndicator() {
  const { indicator, retryFn } = useAutoSaveContext();

  if (indicator.state === "idle") {
    return null;
  }

  if (indicator.state === "saving") {
    return (
      <div
        className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300 shrink-0"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>{indicator.message ?? "Salvataggio in corso…"}</span>
      </div>
    );
  }

  if (indicator.state === "saved") {
    return (
      <div
        className="text-xs text-emerald-700 dark:text-emerald-400 shrink-0"
        role="status"
        aria-live="polite"
      >
        {indicator.message ?? "Salvato"}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-destructive shrink-0" role="alert">
      <span>{indicator.message ?? "Errore salvataggio"}</span>
      {retryFn && (
        <button
          type="button"
          onClick={() => retryFn()}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-0.5",
            "hover:bg-destructive/10 transition-colors",
          )}
        >
          <RotateCcw className="h-3 w-3" />
          Riprova
        </button>
      )}
    </div>
  );
}
