import { useState, useEffect, useCallback } from "react";
import { Target, CheckCircle2 } from "lucide-react";

const API = "/api";

interface WidgetData {
  totalTasks: number;
  completedTasks: number;
}

export function DailyFocusWidget({ onClick }: { onClick: () => void }) {
  const [data, setData] = useState<WidgetData | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API}/daily-focus`, { credentials: "include" });
      if (!res.ok) return;
      const json = await res.json();
      const tasks = json.tasks ?? [];
      const session = json.session;
      const completedArr = Array.isArray(session?.tasksCompletedJson) ? session.tasksCompletedJson : [];
      setData({
        totalTasks: tasks.length,
        completedTasks: completedArr.length,
      });
    } catch {}
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (!data || data.totalTasks === 0) return null;

  const allDone = data.completedTasks >= data.totalTasks;
  const progress = data.totalTasks > 0 ? (data.completedTasks / data.totalTasks) * 100 : 0;

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        allDone
          ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400"
          : "bg-muted hover:bg-muted/80 text-foreground"
      }`}
      title="Apri Focus giornaliero"
    >
      {allDone ? (
        <CheckCircle2 size={14} className="text-green-600 dark:text-green-400" />
      ) : (
        <Target size={14} />
      )}
      <span className="hidden sm:inline">
        Focus: {data.completedTasks}/{data.totalTasks}
      </span>
      <div className="w-12 h-1.5 bg-background rounded-full overflow-hidden hidden sm:block">
        <div
          className={`h-full rounded-full transition-all ${allDone ? "bg-green-500" : "bg-primary"}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </button>
  );
}
