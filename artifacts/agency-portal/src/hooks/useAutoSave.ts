import { useCallback, useEffect, useRef } from "react";
import { useAutoSaveContext } from "@/context/AutoSaveContext";

export type UseAutoSaveOptions = {
  /** Debounce dopo l’ultima modifica (ms). Default 1500. */
  debounceMs?: number;
  /** Tentativi in caso di errore di rete. Default 3. */
  maxRetries?: number;
  /** Se false, non pianifica salvataggi. */
  enabled?: boolean;
  /** Chiave localStorage per backup se il salvataggio fallisce. */
  storageKey?: string;
  /** Serializza lo stato da mettere in backup (opzionale). */
  getBackupPayload?: () => Record<string, unknown>;
  /** Funzione di persistenza (PATCH/POST verso API). */
  save: () => Promise<void>;
};

/**
 * Autosave con debounce, salvataggio su blur (flush), beforeunload e retry.
 * Aggiorna l’indicatore globale tramite AutoSaveProvider.
 */
export function useAutoSave(options: UseAutoSaveOptions) {
  const {
    debounceMs = 1500,
    maxRetries = 3,
    enabled = true,
    storageKey,
    getBackupPayload,
    save,
  } = options;

  const { setIndicator, setRetryFn } = useAutoSaveContext();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const saveRef = useRef(save);
  saveRef.current = save;
  saveRef.current = save;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const runSave = useCallback(async (): Promise<boolean> => {
    if (!enabled) return true;
    if (savingRef.current) return true;
    savingRef.current = true;
    setIndicator({ state: "saving", message: "Salvataggio in corso…" });
    try {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          await saveRef.current();
          if (storageKey) {
            try {
              localStorage.removeItem(storageKey);
            } catch {
              /* ignore */
            }
          }
          setIndicator({ state: "saved", message: "Salvato" });
          window.setTimeout(() => {
            setIndicator({ state: "idle" });
          }, 2000);
          return true;
        } catch {
          if (attempt < maxRetries - 1) {
            await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
          }
        }
      }
      if (storageKey && getBackupPayload) {
        try {
          localStorage.setItem(
            storageKey,
            JSON.stringify({ savedAt: Date.now(), payload: getBackupPayload() }),
          );
        } catch {
          /* ignore */
        }
      }
      setIndicator({ state: "error", message: "Errore salvataggio" });
      return false;
    } finally {
      savingRef.current = false;
    }
  }, [enabled, getBackupPayload, maxRetries, setIndicator, storageKey]);

  useEffect(() => {
    setRetryFn(() => () => {
      void runSave();
    });
    return () => setRetryFn(null);
  }, [runSave, setRetryFn]);

  const flushSave = useCallback(async () => {
    clearTimer();
    return runSave();
  }, [clearTimer, runSave]);

  const scheduleSave = useCallback(() => {
    if (!enabled) return;
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void runSave();
    }, debounceMs);
  }, [clearTimer, debounceMs, enabled, runSave]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  useEffect(() => {
    const onBeforeUnload = () => {
      clearTimer();
      if (enabled) {
        void runSave();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [clearTimer, enabled, runSave]);

  useEffect(() => {
    const onOnline = () => {
      if (enabled) void flushSave();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [enabled, flushSave]);

  return {
    /** Chiamare onChange degli input (debounce). */
    scheduleSave,
    /** Uscita dal campo o flush immediato. */
    flushSave,
    onFieldBlur: flushSave,
  };
}
