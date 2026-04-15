import { Activity } from "lucide-react";
import { formatDate } from "@/lib/utils";

export function TaskActivity({
  isActivityLoading,
  activityError,
  taskActivity,
}: {
  isActivityLoading: boolean;
  activityError: unknown;
  taskActivity: any[];
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Activity size={14} className="text-primary" />
        <p className="text-sm font-semibold">Activity log</p>
      </div>
      <div className="space-y-1.5 max-h-36 overflow-y-auto">
        {isActivityLoading && <p className="text-xs text-muted-foreground">Caricamento attività...</p>}
        {!!activityError && <p className="text-xs text-destructive">Impossibile caricare attività task.</p>}
        {taskActivity.map((a) => (
          <div key={a.id} className="text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1.5">
            <span className="text-foreground">{a.action}</span> · {formatDate(a.createdAt)}
          </div>
        ))}
        {!isActivityLoading && !activityError && taskActivity.length === 0 && (
          <p className="text-xs text-muted-foreground">Nessuna attività</p>
        )}
      </div>
    </div>
  );
}
