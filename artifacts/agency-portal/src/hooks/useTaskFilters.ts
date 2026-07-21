import { useEffect, useMemo, useState } from "react";
import type { TaskRow } from "@/types/client";

type UseTaskFiltersParams = {
  taskList: TaskRow[];
  hasScopedProjects: boolean;
  scopedProjectIds: Set<number>;
  scopedProjectList: Array<{ id?: number | string | null }>;
  activeClientId: number | null;
};

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

/** Cliente mostrato per una task: diretto o ereditato dal progetto. */
export function taskClientId(task: TaskRow): number | null {
  return task.effectiveClientId ?? task.clientId ?? null;
}

export function useTaskFilters({ taskList, hasScopedProjects, scopedProjectIds, scopedProjectList, activeClientId }: UseTaskFiltersParams) {
  const [search, setSearch] = useState("");
  // "" = tutti, "general" = solo task senza cliente, "<id>" = un cliente.
  const [filterClient, setFilterClient] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const filtered = useMemo(() => {
    const list = taskList.filter((task) => {
      // Con un cliente attivo si vedono sia le task dei suoi progetti sia quelle
      // agganciate direttamente a lui. Prima contava solo il progetto: una task
      // "cliente sì, progetto no" spariva dalla lista.
      const cid = taskClientId(task);
      const matchActiveClient = !hasScopedProjects
        || (task.projectId != null && scopedProjectIds.has(Number(task.projectId)))
        || (activeClientId != null && cid === activeClientId);
      const matchClient = !filterClient
        ? true
        : filterClient === "general"
          ? cid == null
          : String(cid) === filterClient;
      const matchSearch = String(task?.title ?? "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = !filterStatus || task.status === filterStatus;
      const matchPriority = !filterPriority || task.priority === filterPriority;
      const matchTipo = !filterTipo || task.tipo === filterTipo;
      const matchCategory = !filterCategory || (task.categoria ?? "") === filterCategory;
      const matchProject = !filterProject || String(task.projectId) === filterProject;
      const matchAssignee = !filterAssignee
        ? true
        : filterAssignee === "unassigned"
          ? task.assigneeId == null
          : String(task.assigneeId) === filterAssignee;
      const matchDateFrom = !filterDateFrom || (task.dueDate != null && task.dueDate >= filterDateFrom);
      const matchDateTo = !filterDateTo || (task.dueDate != null && task.dueDate <= filterDateTo);
      return matchActiveClient && matchClient && matchSearch && matchStatus && matchPriority && matchTipo && matchCategory && matchProject && matchAssignee && matchDateFrom && matchDateTo;
    });

    return list.sort((a, b) => {
      // 1) Completate sempre in fondo.
      const doneA = a.status === "done" ? 1 : 0;
      const doneB = b.status === "done" ? 1 : 0;
      if (doneA !== doneB) return doneA - doneB;
      // 2) Ordine cronologico per scadenza (più vicina prima; senza data in fondo).
      const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      if (dateA !== dateB) return dateA - dateB;
      // 3) Poi per urgenza.
      const prioA = PRIORITY_ORDER[a.priority] ?? 2;
      const prioB = PRIORITY_ORDER[b.priority] ?? 2;
      return prioA - prioB;
    });
  }, [
    taskList,
    hasScopedProjects,
    scopedProjectIds,
    activeClientId,
    filterClient,
    search,
    filterStatus,
    filterPriority,
    filterTipo,
    filterCategory,
    filterProject,
    filterAssignee,
    filterDateFrom,
    filterDateTo,
  ]);

  useEffect(() => {
    if (!filterProject) return;
    const stillVisible = scopedProjectList.some((project) => String(project?.id) === filterProject);
    if (!stillVisible) setFilterProject("");
  }, [filterProject, scopedProjectList]);

  const hasActiveFilters = !!(filterClient || filterProject || filterAssignee || filterDateFrom || filterDateTo || filterStatus || filterPriority || filterTipo || filterCategory || search);

  const clearFilters = () => {
    setSearch("");
    setFilterClient("");
    setFilterStatus("");
    setFilterPriority("");
    setFilterTipo("");
    setFilterCategory("");
    setFilterProject("");
    setFilterAssignee("");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  return {
    search,
    setSearch,
    filterClient,
    setFilterClient,
    filterStatus,
    setFilterStatus,
    filterPriority,
    setFilterPriority,
    filterTipo,
    setFilterTipo,
    filterCategory,
    setFilterCategory,
    filterProject,
    setFilterProject,
    filterAssignee,
    setFilterAssignee,
    filterDateFrom,
    setFilterDateFrom,
    filterDateTo,
    setFilterDateTo,
    showMobileFilters,
    setShowMobileFilters,
    filtered,
    hasActiveFilters,
    clearFilters,
  };
}
