import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { portalFetch } from "@workspace/api-client-react";
import type { TaskComment } from "@/types/client";

export type TaskCommentDto = TaskComment;

const taskCommentsQueryKey = (taskId: number | null) => ["tasks", taskId, "comments"] as const;

export function useTaskComments(taskId: number | null) {
  return useQuery<TaskComment[]>({
    queryKey: taskCommentsQueryKey(taskId),
    enabled: Boolean(taskId),
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      if (!taskId) return [];
      const response = await portalFetch(`/api/tasks/${taskId}/comments`);
      if (!response.ok) {
        throw new Error("Impossibile caricare i commenti del task.");
      }
      return (await response.json()) as TaskComment[];
    },
  });
}

export function useAddTaskComment(taskId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { content: string; authorName: string }) => {
      if (!taskId) {
        throw new Error("Task non selezionato.");
      }
      const response = await portalFetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error("Impossibile aggiungere il commento.");
      }
      return (await response.json()) as TaskComment;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: taskCommentsQueryKey(taskId) });
    },
  });
}
