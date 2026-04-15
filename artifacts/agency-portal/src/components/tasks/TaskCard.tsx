import { cn, PRIORITY_COLORS, PRIORITY_LABELS, formatDate } from "@/lib/utils";
import { calcProgress } from "@/lib/taskUtils";
import type { TaskRow } from "@/types/client";
import type { ChecklistItem } from "@/components/tasks/TaskChecklist";

export function TaskCard({
  task,
  onDragStart,
  onDragEnd,
  selected,
  onToggleSelection,
  onOpenEdit,
  parseChecklist,
  ProgressBar,
  isOverdue,
  categoryColors,
}: {
  task: TaskRow;
  onDragStart: () => void;
  onDragEnd: () => void;
  selected: boolean;
  onToggleSelection: (checked: boolean) => void;
  onOpenEdit: () => void;
  parseChecklist: (json: string) => ChecklistItem[];
  ProgressBar: React.ComponentType<{ pct: number; className?: string }>;
  isOverdue: (dueDate?: string | null, status?: string) => boolean;
  categoryColors: Record<string, string>;
}) {
  const isAvanzata = task.tipo === "avanzata";
  const items = isAvanzata ? parseChecklist(task.checklistJson) : [];
  const { pct } = calcProgress(items);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="bg-card border border-card-border rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
    >
      <div className="mb-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onToggleSelection(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="h-4 w-4 accent-primary"
          aria-label={`Seleziona task ${task.title}`}
        />
      </div>
      <p onClick={onOpenEdit} className="text-sm font-medium cursor-pointer hover:text-primary transition-colors line-clamp-2">{task.title}</p>
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", task.tipo === "avanzata" ? "bg-violet-100 text-violet-700" : "bg-gray-100 text-gray-600")}>
          {task.tipo === "avanzata" ? "Avanzata" : "Semplice"}
        </span>
        {task.tipo === "avanzata" && task.categoria && (
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", categoryColors[task.categoria] ?? "bg-gray-100 text-gray-600")}>
            {task.categoria}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", PRIORITY_COLORS[task.priority])}>{PRIORITY_LABELS[task.priority]}</span>
        {task.assigneeName && (
          <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
            <span className="w-4 h-4 rounded-full bg-primary/10 text-primary inline-flex items-center justify-center font-semibold">
              {task.assigneeName.charAt(0).toUpperCase()}
            </span>
            {task.assigneeName}
          </span>
        )}
        {task.dueDate && <span className={cn("text-[10px] ml-auto", isOverdue(task.dueDate, task.status) ? "text-red-600 font-semibold" : "text-muted-foreground")}>{formatDate(task.dueDate)}</span>}
      </div>
      {isAvanzata && (
        <div className="mt-2">
          <ProgressBar pct={pct} />
          <p className="text-[10px] text-muted-foreground mt-1">{calcProgress(items).done}/{calcProgress(items).total} completati</p>
        </div>
      )}
    </div>
  );
}
