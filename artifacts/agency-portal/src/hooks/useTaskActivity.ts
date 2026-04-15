import { useQuery } from "@tanstack/react-query";
import { portalFetch } from "@workspace/api-client-react";

export interface TaskActivityDto {
  id: number;
  action: string;
  entityType: string;
  entityId: number;
  entityName: string | null;
  details: string | null;
  userId: string | null;
  userName: string | null;
  createdAt: string;
}

const taskActivityQueryKey = (taskId: number | null) => ["tasks", taskId, "activity"] as const;

export function useTaskActivity(taskId: number | null) {
  return useQuery<TaskActivityDto[]>({
    queryKey: taskActivityQueryKey(taskId),
    enabled: Boolean(taskId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!taskId) return [];
      const response = await portalFetch(`/api/tasks/${taskId}/activity`);
      if (!response.ok) {
        throw new Error("Impossibile caricare l'attivita del task.");
      }
      return (await response.json()) as TaskActivityDto[];
    },
  });
}

export { taskActivityQueryKey };
