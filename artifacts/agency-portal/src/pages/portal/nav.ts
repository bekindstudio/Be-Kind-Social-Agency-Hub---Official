import { createContext, useContext } from "react";
import type { TabKey } from "./components/BottomNav";

/** Schermate "overlay" impilate sopra le tab (dettaglio push con back). */
export type OverlayId = "report" | "brief" | "events" | "files" | "website-brief" | "contract";

export type PortalNav = {
  tab: TabKey;
  setTab: (t: TabKey) => void;
  push: (id: OverlayId, param?: unknown) => void;
  pop: () => void;
};

export const NavCtx = createContext<PortalNav | null>(null);

export function usePortalNav(): PortalNav {
  const n = useContext(NavCtx);
  if (!n) throw new Error("usePortalNav fuori da PortalShell");
  return n;
}
