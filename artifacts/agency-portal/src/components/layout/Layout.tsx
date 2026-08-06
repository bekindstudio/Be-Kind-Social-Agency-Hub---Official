import { ReactNode, useState, useEffect, useCallback } from "react";
import { Sidebar } from "./Sidebar";
import { GlobalSearch } from "@/components/GlobalSearch";
import { CommandPalette } from "@/components/CommandPalette";
import { InstallBanner } from "@/components/InstallBanner";
import { DailyFocusPopup } from "@/components/DailyFocusPopup";
import { DailyFocusWidget } from "@/components/DailyFocusWidget";
import { Menu } from "lucide-react";
import { AutoSaveIndicator } from "./AutoSaveIndicator";
import { OfflineBanner } from "./OfflineBanner";
import { ClientSelector } from "@/components/ClientSelector";
import { ClientHeader } from "@/components/ClientHeader";
import { NotificationBell } from "./NotificationBell";
import { QuickCreate } from "./QuickCreate";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Il "Focus del giorno" NON si apre più da solo all'ingresso: era invadente.
  // Resta a portata di mano dal widget in topbar e con Cmd-J.
  const [focusOpen, setFocusOpen] = useState(false);

  const handleFocusClose = useCallback(() => {
    setFocusOpen(false);
  }, []);

  // Cmd-K è ora dedicato alla Command Palette (vedi CommandPalette.tsx).
  // Il Daily Focus si apre con Cmd-J o cliccando il widget in alto a destra.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isCmdJ = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j";
      if (isCmdJ) {
        e.preventDefault();
        setFocusOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-10 h-full w-60">
            <Sidebar />
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto bg-background min-w-0">
        {/* Topbar mobile-first: niente titolo "Be Kind Social Agency HUB" ridondante
            (il logo è già in sidebar / nella PWA). Su >= sm: layout pieno con gap
            maggiori. Le notifiche push browser sono state rimosse (Wave BN). */}
        <div className="sticky top-0 z-40 bg-background border-b border-border px-2 sm:px-4 py-2 sm:py-2.5 flex items-center gap-1.5 sm:gap-3 min-w-0">
          <button onClick={() => setSidebarOpen(true)} className="shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors md:hidden" aria-label="Apri menu">
            <Menu size={20} />
          </button>
          <div className="min-w-0 flex-1 sm:flex-initial">
            <ClientSelector />
          </div>
          <div className="ml-auto flex items-center gap-1 sm:gap-2 shrink-0">
            <AutoSaveIndicator />
            <DailyFocusWidget onClick={() => setFocusOpen(true)} />
            <GlobalSearch />
            <NotificationBell
              buttonClassName="border border-input bg-background hover:bg-muted"
              iconClassName="text-foreground"
              panelClassName="right-0 left-auto top-full mt-2"
            />
            <QuickCreate />
          </div>
        </div>
        <ClientHeader />
        <OfflineBanner />
        {children}
      </main>

      <DailyFocusPopup
        open={focusOpen}
        onClose={handleFocusClose}
      />

      <CommandPalette />
      <InstallBanner />
    </div>
  );
}
