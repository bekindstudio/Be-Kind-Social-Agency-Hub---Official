import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type AutoSaveIndicatorState = "idle" | "saving" | "saved" | "error";

export type IndicatorPayload = {
  state: AutoSaveIndicatorState;
  message?: string;
};

type Ctx = {
  indicator: IndicatorPayload;
  setIndicator: (p: IndicatorPayload) => void;
  retryFn: (() => void) | null;
  setRetryFn: (fn: (() => void) | null) => void;
};

const AutoSaveContext = createContext<Ctx | null>(null);

export function AutoSaveProvider({ children }: { children: ReactNode }) {
  const [indicator, setIndicator] = useState<IndicatorPayload>({ state: "idle" });
  const [retryFn, setRetryFn] = useState<(() => void) | null>(null);

  const value = useMemo(
    () => ({ indicator, setIndicator, retryFn, setRetryFn }),
    [indicator, retryFn],
  );

  return <AutoSaveContext.Provider value={value}>{children}</AutoSaveContext.Provider>;
}

export function useAutoSaveContext(): Ctx {
  const ctx = useContext(AutoSaveContext);
  if (!ctx) {
    return {
      indicator: { state: "idle" },
      setIndicator: () => {},
      retryFn: null,
      setRetryFn: () => {},
    };
  }
  return ctx;
}
