import { useRef } from "react";
import { Plus } from "lucide-react";
import { TASK_STATUS_LABELS } from "@/lib/utils";
import { TaskCard } from "@/components/tasks/TaskCard";
import type { TaskRow } from "@/types/client";
import type { ChecklistItem } from "@/components/tasks/TaskChecklist";

const KANBAN_STATUSES = ["todo", "in-progress", "review", "done"] as const;

export function TaskKanban({
  tasks,
  selectedTaskIds,
  onToggleSelection,
  onOpenEdit,
  onStatusChange,
  onCreateInStatus,
  parseChecklist,
  ProgressBar,
  isOverdue,
  categoryColors,
}: {
  tasks: TaskRow[];
  selectedTaskIds: number[];
  onToggleSelection: (taskId: number, checked: boolean) => void;
  onOpenEdit: (task: TaskRow) => void;
  onStatusChange: (taskId: number, newStatus: string) => void;
  onCreateInStatus: (status: string) => void;
  parseChecklist: (json: string) => ChecklistItem[];
  ProgressBar: React.ComponentType<{ pct: number; className?: string }>;
  isOverdue: (dueDate?: string | null, status?: string) => boolean;
  categoryColors: Record<string, string>;
}) {
  const draggedTaskRef = useRef<number | null>(null);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {KANBAN_STATUSES.map((status) => {
        const colTasks = tasks.filter((task) => task.status === status);
        return (
          <div
            key={status}
            className="bg-muted/30 rounded-xl p-3 min-h-[300px]"
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add("ring-2", "ring-primary/40");
            }}
            onDragLeave={(e) => {
              e.currentTarget.classList.remove("ring-2", "ring-primary/40");
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove("ring-2", "ring-primary/40");
              if (draggedTaskRef.current != null) {
                onStatusChange(draggedTaskRef.current, status);
                draggedTaskRef.current = null;
              }
            }}
          >
            <div className="flex items-center gap-2 mb-3 px-1">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  status === "todo"
                    ? "bg-gray-400"
                    : status === "in-progress"
                      ? "bg-blue-500"
                      : status === "review"
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                }`}
              />
              <span className="text-sm font-semibold">{TASK_STATUS_LABELS[status]}</span>
              <span className="text-xs text-muted-foreground ml-auto">{colTasks.length}</span>
              <button
                className="p-1 rounded hover:bg-muted"
                title="Aggiungi task in questa colonna"
                onClick={() => onCreateInStatus(status)}
              >
                <Plus size={13} />
              </button>
            </div>
            <div className="space-y-2">
              {colTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onDragStart={() => {
                    draggedTaskRef.current = task.id;
                  }}
                  onDragEnd={() => {
                    draggedTaskRef.current = null;
                  }}
                  selected={selectedTaskIds.includes(task.id)}
                  onToggleSelection={(checked) => onToggleSelection(task.id, checked)}
                  onOpenEdit={() => onOpenEdit(task)}
                  parseChecklist={parseChecklist}
                  ProgressBar={ProgressBar}
                  isOverdue={isOverdue}
                  categoryColors={categoryColors}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
