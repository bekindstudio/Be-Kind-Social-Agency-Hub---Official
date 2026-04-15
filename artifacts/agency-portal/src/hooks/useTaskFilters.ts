import { useEffect, useMemo, useState } from "react";
import type { TaskRow } from "@/types/client";

type UseTaskFiltersParams = {
  taskList: TaskRow[];
  hasScopedProjects: boolean;
  scopedProjectIds: Set<number>;
  scopedProjectList: Array<{ id?: number | string | null }>;
};

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const STATUS_ORDER: Record<string, number> = { todo: 0, "in-progress": 1, review: 2, done: 3 };

export function useTaskFilters({ taskList, hasScopedProjects, scopedProjectIds, scopedProjectList }: UseTaskFiltersParams) {
  const [search, setSearch] = useState("");
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
      const matchActiveClient = !hasScopedProjects || (task.projectId != null && scopedProjectIds.has(Number(task.projectId)));
      const matchSearch = String(task?.title ?? "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = !filterStatus || task.status === filterStatus;
      const matchPriority = !filterPriority || task.priority === filterPriority;
      const matchTipo = !filterTipo || task.tipo === filterTipo;
      const matchCategory = !filterCategory || (task.categoria ?? "") === filterCategory;
      const matchProject = !filterProject || String(task.projectId) === filterProject;
      const matchAssignee = !filterAssignee || String(task.assigneeId) === filterAssignee;
      const matchDateFrom = !filterDateFrom || (task.dueDate != null && task.dueDate >= filterDateFrom);
      const matchDateTo = !filterDateTo || (task.dueDate != null && task.dueDate <= filterDateTo);
      return matchActiveClient && matchSearch && matchStatus && matchPriority && matchTipo && matchCategory && matchProject && matchAssignee && matchDateFrom && matchDateTo;
    });

    return list.sort((a, b) => {
      const statusA = STATUS_ORDER[a.status] ?? 1;
      const statusB = STATUS_ORDER[b.status] ?? 1;
      if (statusA !== statusB) return statusA - statusB;
      const prioA = PRIORITY_ORDER[a.priority] ?? 2;
      const prioB = PRIORITY_ORDER[b.priority] ?? 2;
      return prioA - prioB;
    });
  }, [
    taskList,
    hasScopedProjects,
    scopedProjectIds,
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

  const hasActiveFilters = !!(filterProject || filterAssignee || filterDateFrom || filterDateTo || filterStatus || filterPriority || filterTipo || filterCategory || search);

  const clearFilters = () => {
    setSearch("");
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
