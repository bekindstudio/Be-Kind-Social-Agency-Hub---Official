import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { parseChecklist } from "@/components/tasks/TaskChecklist";
import { useAddTaskComment, useTaskComments } from "@/hooks/useTaskComments";
import { useTaskActivity } from "@/hooks/useTaskActivity";
import type { TaskRow } from "@/types/client";

type ToastFn = (options: { title: string; description?: string; variant?: "default" | "destructive" }) => void;

type UpdateTaskMutation = {
  mutate: (
    variables: { id: number; data: { checklistJson: string } },
    options?: { onSuccess?: () => void },
  ) => void;
};

type UseTaskChecklistParams = {
  updateTask: UpdateTaskMutation;
  listTasksKey: readonly unknown[];
  addActivity: (taskId: number, action: string, entityName?: string) => Promise<void>;
  toast: ToastFn;
};

export function useTaskChecklist({ updateTask, listTasksKey, addActivity, toast }: UseTaskChecklistParams) {
  const queryClient = useQueryClient();
  const [detailTask, setDetailTask] = useState<TaskRow | null>(null);
  const [commentDraft, setCommentDraft] = useState("");

  const detailTaskId = detailTask?.id ?? null;
  const { data: taskComments = [], isLoading: isCommentsLoading, error: commentsError } = useTaskComments(detailTaskId);
  const addTaskComment = useAddTaskComment(detailTaskId);
  const { data: taskActivity = [], isLoading: isActivityLoading, error: activityError } = useTaskActivity(detailTaskId);

  const handleToggleChecklistItem = useCallback((task: TaskRow, itemId: string) => {
    const items = parseChecklist(task.checklistJson).map((item) => (
      item.id === itemId ? { ...item, completato: !item.completato } : item
    ));
    const newJson = JSON.stringify(items);
    setDetailTask((prev) => (prev ? { ...prev, checklistJson: newJson } : null));
    updateTask.mutate(
      { id: task.id, data: { checklistJson: newJson } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: listTasksKey });
          void addActivity(task.id, "Checklist aggiornata", task.title);
        },
      },
    );
  }, [updateTask, queryClient, listTasksKey, addActivity]);

  const handleAddComment = useCallback(() => {
    if (!detailTask || !commentDraft.trim()) return;
    addTaskComment.mutate(
      { authorName: "Team", content: commentDraft.trim() },
      {
        onSuccess: async () => {
          void addActivity(detailTask.id, "Commento aggiunto", detailTask.title);
          setCommentDraft("");
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Commento non inviato",
            description: "Riprova tra qualche secondo.",
          });
        },
      },
    );
  }, [detailTask, commentDraft, addTaskComment, addActivity, toast]);

  const handleOpenDetail = useCallback((task: TaskRow) => {
    if (task.tipo !== "avanzata") return;
    setDetailTask(task);
  }, []);

  return {
    detailTask,
    setDetailTask,
    commentDraft,
    setCommentDraft,
    taskComments,
    isCommentsLoading,
    commentsError,
    addTaskComment,
    taskActivity,
    isActivityLoading,
    activityError,
    handleToggleChecklistItem,
    handleAddComment,
    handleOpenDetail,
  };
}
