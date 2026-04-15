import { useCallback, useMemo } from "react";
import {
  getListTasksQueryKey,
  portalFetch,
  useCreateTask,
  useDeleteTask,
  useListProjects,
  useListTasks,
  useListTeamMembers,
  useUpdateTask,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getClientOperationalTemplateId, getOperationalTemplateById } from "@/lib/operationalTemplates";
import { useClientContext } from "@/context/ClientContext";
import { taskActivityQueryKey } from "@/hooks/useTaskActivity";

export type TaskRow = {
  id: number;
  title: string;
  description?: string | null;
  projectId?: number | null;
  projectName?: string | null;
  assigneeId?: number | null;
  assigneeName?: string | null;
  status: string;
  priority: string;
  dueDate?: string | null;
  tipo: string;
  categoria?: string | null;
  checklistJson: string;
  pacchettoContenuti?: string | null;
  meseRiferimento?: string | null;
  createdAt: string;
  updatedAt: string;
};

export function useTasks() {
  const qc = useQueryClient();
  const { activeClient } = useClientContext();

  const activeClientNumericId = activeClient?.id ? Number(activeClient.id) : NaN;
  const apiClientId = Number.isFinite(activeClientNumericId) ? activeClientNumericId : null;
  const tasksQueryParams = apiClientId != null ? { clientId: apiClientId } : {};
  const projectsQueryParams = apiClientId != null ? { clientId: apiClientId } : {};

  const { data: tasks, isLoading } = useListTasks(tasksQueryParams as any);
  const { data: projects } = useListProjects(projectsQueryParams);
  const { data: members } = useListTeamMembers();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const listTasksKey = getListTasksQueryKey(tasksQueryParams as any);

  const activeTemplate = useMemo(() => {
    if (!activeClient?.id) return null;
    const templateId = getClientOperationalTemplateId(activeClient.id);
    return getOperationalTemplateById(templateId);
  }, [activeClient?.id]);

  const projectList = useMemo(() => {
    if (!projects) return [];
    if (Array.isArray(projects)) return projects;
    if (Array.isArray((projects as { items?: unknown[] }).items)) {
      return (projects as { items: unknown[] }).items;
    }
    return [projects].filter(Boolean);
  }, [projects]);

  const memberList = useMemo(() => {
    if (!members) return [];
    if (Array.isArray(members)) return members;
    if (Array.isArray((members as { items?: unknown[] }).items)) {
      return (members as { items: unknown[] }).items;
    }
    return [members].filter(Boolean);
  }, [members]);

  const taskList = useMemo(() => {
    if (!tasks) return [];
    if (Array.isArray(tasks)) return tasks as TaskRow[];
    if (Array.isArray((tasks as { items?: unknown[] }).items)) {
      return (tasks as { items: TaskRow[] }).items;
    }
    return [tasks as TaskRow].filter(Boolean);
  }, [tasks]);

  const scopedProjectList = useMemo(() => {
    if (!activeClient) return projectList;
    const activeName = activeClient.name.trim().toLowerCase();
    const byClientId = Number.isFinite(activeClientNumericId)
      ? projectList.filter((p: any) => Number(p?.clientId) === activeClientNumericId)
      : [];
    const byClientName = projectList.filter(
      (p: any) => String(p?.clientName ?? "").trim().toLowerCase() === activeName,
    );
    const merged = [...byClientId, ...byClientName];
    if (merged.length === 0) return projectList;
    return merged.filter(
      (p: any, index: number, arr: any[]) =>
        arr.findIndex((x: any) => Number(x?.id) === Number(p?.id)) === index,
    );
  }, [activeClient, activeClientNumericId, projectList]);

  const scopedProjectIds = useMemo(
    () =>
      new Set(
        scopedProjectList
          .map((p: any) => Number(p?.id))
          .filter((id: number) => Number.isFinite(id)),
      ),
    [scopedProjectList],
  );
  const hasScopedProjects = activeClient != null && scopedProjectIds.size > 0;

  const applyTaskCacheUpdate = useCallback(
    (updater: (list: TaskRow[]) => TaskRow[]) => {
      qc.setQueryData(listTasksKey, (prev: any) => {
        if (!prev) return prev;
        if (Array.isArray(prev)) return updater(prev as TaskRow[]);
        if (Array.isArray(prev?.items)) {
          return { ...prev, items: updater(prev.items as TaskRow[]) };
        }
        return prev;
      });
    },
    [qc, listTasksKey],
  );

  const addActivity = useCallback(
    async (taskId: number, action: string, entityName?: string) => {
      try {
        await portalFetch("/api/activity-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            entityType: "task",
            entityId: taskId,
            entityName,
          }),
        });
        await qc.invalidateQueries({ queryKey: taskActivityQueryKey(taskId) });
      } catch {
        // Best-effort logging: no UX interruption.
      }
    },
    [qc],
  );

  return {
    activeClient,
    activeTemplate,
    isLoading,
    taskList,
    projectList,
    memberList,
    scopedProjectList,
    scopedProjectIds,
    hasScopedProjects,
    createTask,
    updateTask,
    deleteTask,
    listTasksKey,
    applyTaskCacheUpdate,
    addActivity,
    queryClient: qc,
  };
}
