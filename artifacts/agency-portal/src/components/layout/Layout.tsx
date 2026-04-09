import { ReactNode, useState, useEffect, useCallback } from "react";
import { Sidebar } from "./Sidebar";
import { GlobalSearch } from "@/components/GlobalSearch";
import { DailyFocusPopup } from "@/components/DailyFocusPopup";
import { DailyFocusWidget } from "@/components/DailyFocusWidget";
import { ActiveTimerWidget, useTimerStart } from "@/components/ActiveTimerWidget";
import { Menu } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

const FOCUS_SEEN_KEY = "daily-focus-seen";

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);
  const startTimer = useTimerStart();

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const seen = localStorage.getItem(FOCUS_SEEN_KEY);
    if (seen !== today) {
      const timer = setTimeout(() => setFocusOpen(true), 1200);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);

  const handleFocusClose = useCallback(() => {
    setFocusOpen(false);
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(FOCUS_SEEN_KEY, today);
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
          <div className="ml-auto flex items-center gap-2">
            <ActiveTimerWidget />
            <DailyFocusWidget onClick={() => setFocusOpen(true)} />
            <GlobalSearch />
          </div>
        </div>
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
