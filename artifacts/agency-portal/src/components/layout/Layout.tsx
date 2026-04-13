import { ReactNode, useState, useEffect, useCallback } from "react";
import { portalFetch } from "@workspace/api-client-react";
import { Sidebar } from "./Sidebar";
import { GlobalSearch } from "@/components/GlobalSearch";
import { DailyFocusPopup } from "@/components/DailyFocusPopup";
import { DailyFocusWidget } from "@/components/DailyFocusWidget";
import { ActiveTimerWidget, useTimerStart } from "@/components/ActiveTimerWidget";
import { Menu } from "lucide-react";
import { AutoSaveIndicator } from "./AutoSaveIndicator";
import { OfflineBanner } from "./OfflineBanner";
import { ClientSelector } from "@/components/ClientSelector";
import { ClientHeader } from "@/components/ClientHeader";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);
  const startTimer = useTimerStart();

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const res = await portalFetch("/api/daily-focus/should-open");
        if (!res.ok) return;
        const data = await res.json();
        if (mounted && data?.shouldOpen) {
          setTimeout(() => setFocusOpen(true), 800);
        }
      } catch {}
    };
    check();
    return () => { mounted = false; };
  }, []);

  const handleFocusClose = useCallback(() => {
    setFocusOpen(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isCmdK) {
        e.preventDefault();
        setFocusOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleStartTimer = useCallback((task: any) => {
    startTimer({
      clientId: task.clientId,
      projectId: task.projectId,
      taskId: task.id,
      description: task.title,
    });
  }, [startTimer]);

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
        <div className="sticky top-0 z-40 bg-background border-b border-border px-4 py-2.5 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg hover:bg-muted transition-colors md:hidden">
            <Menu size={20} />
          </button>
          <span className="text-sm font-semibold md:hidden">Be Kind Social Agency HUB</span>
          <ClientSelector />
          <div className="ml-auto flex items-center gap-2">
            <AutoSaveIndicator />
            <ActiveTimerWidget />
            <DailyFocusWidget onClick={() => setFocusOpen(true)} />
            <GlobalSearch />
          </div>
        </div>
        <ClientHeader />
        <OfflineBanner />
        {children}
      </main>

      <DailyFocusPopup
        open={focusOpen}
        onClose={handleFocusClose}
        onStartTimer={handleStartTimer}
      />
    </div>
  );
}
