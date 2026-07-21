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
import { MESI } from "@/components/tasks/TaskChecklist";
import type { TaskFormState } from "@/components/tasks/TaskForm";
import type { TaskRow } from "@/types/client";

export function useTasks() {
  const qc = useQueryClient();
  const { activeClient, clients } = useClientContext();

  const activeClientNumericId = activeClient?.id ? Number(activeClient.id) : NaN;
  const apiClientId = Number.isFinite(activeClientNumericId) ? activeClientNumericId : null;
  const tasksQueryParams = apiClientId != null ? { clientId: apiClientId } : {};
  const projectsQueryParams = apiClientId != null ? { clientId: apiClientId } : {};

  const { data: tasks, isLoading } = useListTasks(tasksQueryParams as any);
  const { data: projects } = useListProjects(projectsQueryParams);
  // Elenco completo dei progetti (non filtrato dal cliente attivo): serve al
  // selettore in creazione task, dove si può scegliere qualunque cliente.
  const { data: allProjects } = useListProjects({});
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

  type ProjectLite = { id?: unknown; name?: unknown; clientId?: unknown; clientName?: unknown };
  const asProjectArray = (raw: unknown): ProjectLite[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw as ProjectLite[];
    if (Array.isArray((raw as { items?: unknown[] }).items)) {
      return (raw as { items: ProjectLite[] }).items;
    }
    return [raw as ProjectLite].filter(Boolean);
  };

  const projectList = useMemo<ProjectLite[]>(() => asProjectArray(projects), [projects]);

  const pickerProjectList = useMemo(
    () =>
      asProjectArray(allProjects).map((p) => ({
        id: p.id as number | string,
        name: String(p.name ?? ""),
        clientId: (p.clientId ?? null) as number | string | null,
      })),
    [allProjects],
  );

  // Lista clienti per il selettore obbligatorio in creazione task. Arriva dal
  // ClientContext, già caricato: nessuna fetch aggiuntiva.
  const clientList = useMemo(
    () => (clients ?? []).map((c) => ({ id: c.id, name: c.name })),
    [clients],
  );

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
      ? projectList.filter((project: { clientId?: unknown }) => Number(project?.clientId) === activeClientNumericId)
      : [];
    const byClientName = projectList.filter(
      (project: { clientName?: unknown }) => String(project?.clientName ?? "").trim().toLowerCase() === activeName,
    );
    const merged = [...byClientId, ...byClientName];
    if (merged.length === 0) return projectList;
    return merged.filter(
      (project: { id?: unknown }, index: number, arr: Array<{ id?: unknown }>) =>
        arr.findIndex((current) => Number(current?.id) === Number(project?.id)) === index,
    );
  }, [activeClient, activeClientNumericId, projectList]);

  const scopedProjectIds = useMemo(
    () =>
      new Set(
        scopedProjectList
          .map((project: { id?: unknown }) => Number(project?.id))
          .filter((id: number) => Number.isFinite(id)),
      ),
    [scopedProjectList],
  );
  const hasScopedProjects = activeClient != null && scopedProjectIds.size > 0;

  const applyTaskCacheUpdate = useCallback(
    (updater: (list: TaskRow[]) => TaskRow[]) => {
      qc.setQueryData(listTasksKey, (prev: unknown) => {
        if (!prev) return prev;
        if (Array.isArray(prev)) return updater(prev as TaskRow[]);
        if (typeof prev === "object" && prev != null && "items" in prev) {
          const prevWithItems = prev as { items?: TaskRow[] };
          if (Array.isArray(prevWithItems.items)) {
            return { ...(prev as object), items: updater(prevWithItems.items) };
          }
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
    activeClientId: apiClientId,
    activeTemplate,
    isLoading,
    taskList,
    projectList,
    pickerProjectList,
    clientList,
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

/**
 * Traduce il valore del selettore cliente nel campo `clientId` dell'API:
 * "" (non scelto) e "general" diventano null, cioè task senza cliente.
 */
export function toApiClientId(formClientId: string): number | null {
  if (!formClientId || formClientId === "general") return null;
  const parsed = Number(formClientId);
  return Number.isFinite(parsed) ? parsed : null;
}

export const EMPTY_TASK_FORM: TaskFormState = {
  title: "",
  description: "",
  clientId: "",
  projectId: "",
  assigneeId: "",
  status: "todo",
  priority: "medium",
  dueDate: "",
  taskType: "semplice",
  categoria: "Onboarding Nuovo Cliente",
  meseRiferimento: MESI[new Date().getMonth()],
  pacchettoContenuti: "8",
  tipoReport: "Mensile",
};
