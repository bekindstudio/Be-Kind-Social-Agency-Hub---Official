import { ListChecks, X } from "lucide-react";
import type { QueryClient } from "@tanstack/react-query";
import { cn, PRIORITY_LABELS, TASK_STATUS_LABELS, formatDate } from "@/lib/utils";
import { TaskActivity } from "@/components/tasks/TaskActivity";
import { TaskComments } from "@/components/tasks/TaskComments";
import type { ChecklistItem } from "@/components/tasks/TaskChecklist";
import type { TaskActivityItem, TaskComment, TaskRow } from "@/types/client";

type UpdateTaskMutation = {
  mutate: (
    variables: { id: number; data: { priority?: string } },
    options?: { onSuccess?: () => void },
  ) => void;
};

type AddTaskCommentMutation = {
  isPending: boolean;
};

export function TaskDetail({
  detailTask,
  setDetailTask,
  handleStatusChange,
  updateTask,
  queryClient,
  listTasksKey,
  addActivity,
  parseChecklist,
  handleToggleChecklistItem,
  taskActivity,
  isActivityLoading,
  activityError,
  commentDraft,
  setCommentDraft,
  handleAddComment,
  addTaskComment,
  taskComments,
  isCommentsLoading,
  commentsError,
}: {
  detailTask: TaskRow | null;
  setDetailTask: (task: TaskRow | null) => void;
  handleStatusChange: (id: number, status: string) => void;
  updateTask: UpdateTaskMutation;
  queryClient: QueryClient;
  listTasksKey: readonly unknown[];
  addActivity: (taskId: number, action: string, entityName?: string) => Promise<void>;
  parseChecklist: (json: string) => ChecklistItem[];
  handleToggleChecklistItem: (task: TaskRow, itemId: string) => void;
  taskActivity: TaskActivityItem[];
  isActivityLoading: boolean;
  activityError: unknown;
  commentDraft: string;
  setCommentDraft: (value: string) => void;
  handleAddComment: () => void;
  addTaskComment: AddTaskCommentMutation;
  taskComments: TaskComment[];
  isCommentsLoading: boolean;
  commentsError: unknown;
}) {
  if (!detailTask) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={() => setDetailTask(null)} />
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-card border-l border-card-border shadow-2xl overflow-y-auto">
        <div className="p-5 border-b border-card-border flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Task Detail</p>
            <h3 className="font-semibold text-lg">{detailTask.title}</h3>
          </div>
          <button onClick={() => setDetailTask(null)} className="p-1.5 hover:bg-muted rounded-lg"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Stato</label>
              <select
                className="w-full mt-1 px-2.5 py-2 border border-input rounded-lg bg-background text-sm"
                value={detailTask.status}
                onChange={(e) => {
                  const status = e.target.value;
                  setDetailTask({ ...detailTask, status });
                  handleStatusChange(detailTask.id, status);
                }}
              >
                {Object.entries(TASK_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Priorità</label>
              <select
                className="w-full mt-1 px-2.5 py-2 border border-input rounded-lg bg-background text-sm"
                value={detailTask.priority}
                onChange={(e) => {
                  const priority = e.target.value;
                  setDetailTask({ ...detailTask, priority });
                  updateTask.mutate({ id: detailTask.id, data: { priority } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: listTasksKey }) });
                  void addActivity(detailTask.id, `Priorità cambiata in ${PRIORITY_LABELS[priority] ?? priority}`, detailTask.title);
                }}
              >
                {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          {detailTask.tipo === "avanzata" && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ListChecks size={14} className="text-primary" />
                <p className="text-sm font-semibold">Checklist</p>
              </div>
              <div className="space-y-1 max-h-60 overflow-y-auto border border-card-border rounded-lg p-2">
                {parseChecklist(detailTask.checklistJson).map((item) => (
                  <label key={item.id} className="flex items-start gap-2 text-sm py-1">
                    <input
                      type="checkbox"
                      checked={item.completato}
                      onChange={() => handleToggleChecklistItem(detailTask, item.id)}
                      className="mt-0.5"
                    />
                    <span className={cn(item.completato && "line-through text-muted-foreground")}>
                      {item.gruppo ? `${item.gruppo}: ` : ""}{item.testo}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <TaskActivity
            isActivityLoading={isActivityLoading}
            activityError={activityError}
            taskActivity={taskActivity}
          />

          <TaskComments
            commentDraft={commentDraft}
            setCommentDraft={setCommentDraft}
            handleAddComment={handleAddComment}
            addTaskComment={addTaskComment}
            taskComments={taskComments}
            isCommentsLoading={isCommentsLoading}
            commentsError={commentsError}
          />
        </div>
      </div>
    </div>
  );
}
