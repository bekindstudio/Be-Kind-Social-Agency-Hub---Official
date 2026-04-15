import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { portalFetch } from "@workspace/api-client-react";
import type { TaskRow } from "@/types/client";

type ToastFn = (options: { title: string; description?: string; variant?: "default" | "destructive" }) => void;

type UseTaskBulkActionsParams = {
  taskList: TaskRow[];
  filtered: TaskRow[];
  listTasksKey: readonly unknown[];
  toast: ToastFn;
};

export function useTaskBulkActions({ taskList, filtered, listTasksKey, toast }: UseTaskBulkActionsParams) {
  const queryClient = useQueryClient();
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);

  useEffect(() => {
    const validIds = new Set(taskList.map((task) => task.id));
    setSelectedTaskIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [taskList]);

  const allFilteredTaskIds = useMemo(
    () => filtered.map((task) => Number(task.id)).filter((id) => Number.isFinite(id)),
    [filtered],
  );

  const allTasksSelected = allFilteredTaskIds.length > 0 && allFilteredTaskIds.every((id) => selectedTaskIds.includes(id));

  const toggleTaskSelection = useCallback((id: number, checked: boolean) => {
    setSelectedTaskIds((prev) => (checked ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((currentId) => currentId !== id)));
  }, []);

  const toggleSelectAllTasks = useCallback((checked: boolean) => {
    if (!checked) {
      setSelectedTaskIds((prev) => prev.filter((id) => !allFilteredTaskIds.includes(id)));
      return;
    }
    setSelectedTaskIds((prev) => Array.from(new Set([...prev, ...allFilteredTaskIds])));
  }, [allFilteredTaskIds]);

  const handleBulkDeleteTasks = useCallback(async () => {
    if (selectedTaskIds.length === 0) return;
    const ok = confirm(`Eliminare ${selectedTaskIds.length} task selezionati?`);
    if (!ok) return;

    const idsToDelete = [...selectedTaskIds];
    const results = await Promise.allSettled(
      idsToDelete.map((id) => portalFetch(`/api/tasks/${id}`, { method: "DELETE", credentials: "include" })),
    );

    const failedIds: number[] = [];
    let success = 0;
    results.forEach((result, idx) => {
      if (result.status === "fulfilled" && result.value.ok) {
        success += 1;
      } else {
        failedIds.push(idsToDelete[idx]);
      }
    });

    if (success > 0) {
      await queryClient.invalidateQueries({ queryKey: listTasksKey });
    }

    if (failedIds.length > 0) {
      setSelectedTaskIds(failedIds);
      toast({
        variant: "destructive",
        title: "Eliminazione parziale task",
        description: `${success} eliminati, ${failedIds.length} non eliminati. Ho lasciato selezionati quelli falliti.`,
      });
      return;
    }

    setSelectedTaskIds([]);
    toast({ title: `${success} task eliminati` });
  }, [selectedTaskIds, queryClient, listTasksKey, toast]);

  return {
    selectedTaskIds,
    setSelectedTaskIds,
    allTasksSelected,
    toggleTaskSelection,
    toggleSelectAllTasks,
    handleBulkDeleteTasks,
  };
}
