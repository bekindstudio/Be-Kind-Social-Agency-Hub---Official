import { useState, type CSSProperties } from "react";
import { NavCtx, type OverlayId } from "./nav";
import { BottomNav, type TabKey } from "./components/BottomNav";
import { T } from "./theme";
import { HomeScreen } from "./screens/HomeScreen";
import { ContentScreen } from "./screens/ContentScreen";
import { IdeasScreen } from "./screens/IdeasScreen";
import { ReportsScreen } from "./screens/ReportsScreen";
import { ReportDetailScreen } from "./screens/ReportDetailScreen";
import { ChatScreen } from "./screens/ChatScreen";
import { BriefScreen } from "./screens/BriefScreen";
import { WebsiteBriefScreen } from "./screens/WebsiteBriefScreen";
import { ContractScreen } from "./screens/ContractScreen";
import { EventsScreen } from "./screens/EventsScreen";
import { FilesScreen } from "./screens/FilesScreen";
import type { Report } from "./types";

/**
 * Guscio del portale-app: tiene la tab attiva e una pila di schermate "overlay"
 * (dettaglio push con back). Bottom nav visibile solo quando non c'è overlay,
 * così le schermate di dettaglio sono a tutto schermo e nulla copre i loro
 * pulsanti (fix bug 8).
 */
export function PortalShell() {
  const [tab, setTabState] = useState<TabKey>("home");
  const [stack, setStack] = useState<{ id: OverlayId; param?: unknown }[]>([]);

  const nav = {
    tab,
    setTab: (t: TabKey) => { setStack([]); setTabState(t); },
    push: (id: OverlayId, param?: unknown) => setStack((s) => [...s, { id, param }]),
    pop: () => setStack((s) => s.slice(0, -1)),
  };
  const top = stack[stack.length - 1];

  return (
    <NavCtx.Provider value={nav}>
      <div
        className="min-h-[100dvh]"
        style={{ background: T.cream, ["--bk-topbar" as string]: "calc(76px + env(safe-area-inset-top))" } as CSSProperties}
      >
        {/* Barra agenzia fissa in alto: verde Be Kind + logo, sempre visibile allo scorrere. */}
        <header
          className="fixed top-0 inset-x-0 z-50 flex items-center justify-center shadow-sm"
          style={{ background: T.sage, height: "var(--bk-topbar)", paddingTop: "env(safe-area-inset-top)" }}
        >
          <img src="/logo-bekind.png" alt="Be Kind Social Agency" className="h-16 object-contain brightness-0 invert" />
        </header>
        <main
          className="max-w-xl mx-auto px-5"
          style={{
            paddingTop: "calc(var(--bk-topbar) + 1.25rem)",
            paddingBottom: top ? "2rem" : "calc(76px + env(safe-area-inset-bottom))",
          }}
        >
          {top ? <Overlay id={top.id} param={top.param} /> : <Tab tab={tab} />}
        </main>
        {!top && <BottomNav active={tab} onChange={nav.setTab} />}
      </div>
    </NavCtx.Provider>
  );
}

function Tab({ tab }: { tab: TabKey }) {
  switch (tab) {
    case "home": return <HomeScreen />;
    case "content": return <ContentScreen />;
    case "chat": return <ChatScreen />;
    case "ideas": return <IdeasScreen />;
    case "reports": return <ReportsScreen />;
  }
}

function Overlay({ id, param }: { id: OverlayId; param?: unknown }) {
  switch (id) {
    case "report": return <ReportDetailScreen report={param as Report} />;
    case "brief": return <BriefScreen />;
    case "website-brief": return <WebsiteBriefScreen />;
    case "contract": return <ContractScreen />;
    case "events": return <EventsScreen />;
    case "files": return <FilesScreen />;
  }
}
