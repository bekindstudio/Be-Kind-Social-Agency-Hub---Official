import { useQuery } from "@tanstack/react-query";
import { portalFetch } from "@workspace/api-client-react";
import type { TaskActivityItem } from "@/types/client";

export type TaskActivityDto = TaskActivityItem;

const taskActivityQueryKey = (taskId: number | null) => ["tasks", taskId, "activity"] as const;

export function useTaskActivity(taskId: number | null) {
  return useQuery<TaskActivityItem[]>({
    queryKey: taskActivityQueryKey(taskId),
    enabled: Boolean(taskId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!taskId) return [];
      const response = await portalFetch(`/api/tasks/${taskId}/activity`);
      if (!response.ok) {
        throw new Error("Impossibile caricare l'attivita del task.");
      }
      return (await response.json()) as TaskActivityItem[];
    },
  });
}

export { taskActivityQueryKey };
