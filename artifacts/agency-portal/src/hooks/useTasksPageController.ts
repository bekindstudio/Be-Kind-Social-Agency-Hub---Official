import { useCallback, useState } from "react";
import { TASK_STATUS_LABELS } from "@/lib/utils";
import { playTaskComplete } from "@/lib/sounds";
import { useToast } from "@/hooks/use-toast";
import { useTasks, EMPTY_TASK_FORM } from "@/hooks/useTasks";
import { useTaskFilters } from "@/hooks/useTaskFilters";
import { useTaskBulkActions } from "@/hooks/useTaskBulkActions";
import { useTaskChecklist } from "@/hooks/useTaskChecklist";
import {
  type ChecklistItem,
  createChecklistItem,
  generateChecklist,
  MESI,
  parseChecklist,
} from "@/components/tasks/TaskChecklist";
import type { TaskFormState } from "@/components/tasks/TaskForm";
import type { TaskRow } from "@/types/client";

function extractErrorMessage(error: unknown): string | null {
  if (typeof error === "object" && error != null && "data" in error) {
    const data = (error as { data?: unknown }).data;
    if (typeof data === "object" && data != null && "error" in data) {
      const value = (data as { error?: unknown }).error;
      if (typeof value === "string" && value.length > 0) return value;
    }
  }
  return null;
}

export function useTasksPageController() {
  const { toast } = useToast();
  const {
    activeTemplate,
    isLoading,
    taskList,
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
    queryClient,
  } = useTasks();

  const filters = useTaskFilters({
    taskList,
    hasScopedProjects,
    scopedProjectIds,
    scopedProjectList: scopedProjectList as Array<{ id?: number | string | null }>,
  });

  const bulkActions = useTaskBulkActions({
    taskList,
    filtered: filters.filtered,
    listTasksKey,
    toast,
  });

  const checklistState = useTaskChecklist({
    updateTask: {
      mutate: (variables, options) => {
        // TODO: align generated UpdateTaskBody typing to include checklistJson.
        updateTask.mutate(
          { id: variables.id, data: variables.data as never },
          { onSuccess: options?.onSuccess },
        );
      },
    },
    listTasksKey,
    addActivity,
    toast,
  });

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<TaskFormState>(EMPTY_TASK_FORM);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [viewMode, setViewMode] = useState<"list" | "kanban">(
    () => (localStorage.getItem("tasks-view") as "list" | "kanban") || "list",
  );

  const handleCategoriaChange = useCallback((cat: string) => {
    setForm((current) => ({ ...current, categoria: cat }));
    const items =
      cat === "Report Cliente" && activeTemplate
        ? activeTemplate.reportChecklist.map((text) => createChecklistItem(text))
        : generateChecklist(cat, form.meseRiferimento, form.pacchettoContenuti);
    setChecklist(items);
  }, [form.meseRiferimento, form.pacchettoContenuti, activeTemplate]);

  const handleMeseChange = useCallback((mese: string) => {
    setForm((current) => ({ ...current, meseRiferimento: mese }));
    if (form.categoria === "Piano Editoriale Mensile") {
      setChecklist(generateChecklist("Piano Editoriale Mensile", mese, form.pacchettoContenuti));
    }
  }, [form.categoria, form.pacchettoContenuti]);

  const handlePacchettoChange = useCallback((pacchetto: string) => {
    setForm((current) => ({ ...current, pacchettoContenuti: pacchetto }));
    if (form.categoria === "Piano Editoriale Mensile") {
      setChecklist(generateChecklist("Piano Editoriale Mensile", form.meseRiferimento, pacchetto));
    }
  }, [form.categoria, form.meseRiferimento]);

  const handleTaskTypeToggle = useCallback((type: "semplice" | "avanzata") => {
    setForm((current) => ({ ...current, taskType: type }));
    if (type === "avanzata") {
      setChecklist(generateChecklist(form.categoria, form.meseRiferimento, form.pacchettoContenuti));
    }
  }, [form.categoria, form.meseRiferimento, form.pacchettoContenuti]);

  const handleOpenEdit = useCallback((task: TaskRow) => {
    setEditId(task.id);
    setForm({
      title: task.title,
      description: task.description ?? "",
      projectId: task.projectId ? String(task.projectId) : "",
      assigneeId: task.assigneeId ? String(task.assigneeId) : "",
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ?? "",
      taskType: task.tipo === "avanzata" ? "avanzata" : "semplice",
      categoria: task.categoria ?? "Onboarding Nuovo Cliente",
      meseRiferimento: task.meseRiferimento ?? MESI[new Date().getMonth()],
      pacchettoContenuti: task.pacchettoContenuti ?? "8",
      tipoReport: "Mensile",
    });
    setChecklist(task.tipo === "avanzata" ? parseChecklist(task.checklistJson) : []);
    setShowForm(true);
  }, []);

  const resetFormState = useCallback(() => {
    setShowForm(false);
    setEditId(null);
    setForm(EMPTY_TASK_FORM);
    setChecklist([]);
  }, []);

  const handleSave = useCallback(() => {
    if (!form.title.trim()) return;
    const isAvanzata = form.taskType === "avanzata";
    const payload = {
      title: form.title,
      description: form.description || null,
      projectId: form.projectId ? Number(form.projectId) : null,
      assigneeId: form.assigneeId ? Number(form.assigneeId) : null,
      status: form.status,
      priority: form.priority,
      dueDate: form.dueDate || null,
      tipo: isAvanzata ? "avanzata" : "semplice",
      categoria: isAvanzata ? form.categoria : null,
      checklistJson: isAvanzata ? JSON.stringify(checklist) : "[]",
      pacchettoContenuti: isAvanzata && form.categoria === "Piano Editoriale Mensile" ? form.pacchettoContenuti : null,
      meseRiferimento: isAvanzata && form.categoria === "Piano Editoriale Mensile" ? form.meseRiferimento : null,
    };

    const onDone = () => {
      if (editId) void addActivity(editId, "Task aggiornata", form.title.trim());
      resetFormState();
    };

    if (editId) {
      updateTask.mutate(
        { id: editId, data: payload },
        {
          onSuccess: (updated: TaskRow) => {
            if (updated?.id != null) {
              applyTaskCacheUpdate((list) => list.map((task) => (task.id === updated.id ? { ...task, ...updated } : task)));
            }
            queryClient.invalidateQueries({ queryKey: listTasksKey });
            toast({ title: "Task aggiornata" });
            onDone();
          },
          onError: (err) => {
            toast({
              variant: "destructive",
              title: "Salvataggio task non riuscito",
              description: extractErrorMessage(err) || "Controlla i dati inseriti e riprova.",
            });
          },
        },
      );
      return;
    }

    createTask.mutate(
      { data: payload },
      {
        onSuccess: (created: TaskRow) => {
          if (created?.id != null) {
            applyTaskCacheUpdate((list) => [created, ...list]);
          }
          if (created?.id) void addActivity(created.id, "Task creata", created?.title ?? form.title.trim());
          queryClient.invalidateQueries({ queryKey: listTasksKey });
          toast({ title: "Task creata con successo" });
          onDone();
        },
        onError: (err) => {
          toast({
            variant: "destructive",
            title: "Creazione task non riuscita",
            description: extractErrorMessage(err) || "Controlla i dati inseriti e riprova.",
          });
        },
      },
    );
  }, [form, checklist, editId, addActivity, resetFormState, updateTask, applyTaskCacheUpdate, queryClient, listTasksKey, toast, createTask]);

  const handleStatusChange = useCallback((id: number, newStatus: string) => {
    updateTask.mutate(
      { id, data: { status: newStatus } },
      {
        onSuccess: () => {
          applyTaskCacheUpdate((list) => list.map((task) => (task.id === id ? { ...task, status: newStatus } : task)));
          queryClient.invalidateQueries({ queryKey: listTasksKey });
          void addActivity(id, `Stato cambiato in ${TASK_STATUS_LABELS[newStatus] ?? newStatus}`);
          if (newStatus === "done") playTaskComplete();
        },
        onError: () => {
          toast({ variant: "destructive", title: "Aggiornamento stato non riuscito" });
        },
      },
    );
  }, [updateTask, applyTaskCacheUpdate, queryClient, listTasksKey, addActivity, toast]);

  const handleDelete = useCallback((id: number) => {
    if (!confirm("Eliminare questo task?")) return;
    deleteTask.mutate(
      { id },
      {
        onSuccess: async () => {
          applyTaskCacheUpdate((list) => list.filter((task) => task.id !== id));
          await queryClient.invalidateQueries({ queryKey: listTasksKey });
          bulkActions.setSelectedTaskIds((prev) => prev.filter((currentId) => currentId !== id));
          toast({ title: "Task spostato nel cestino" });
        },
        onError: () => {
          toast({ variant: "destructive", title: "Eliminazione task non riuscita" });
        },
      },
    );
  }, [deleteTask, applyTaskCacheUpdate, queryClient, listTasksKey, bulkActions, toast]);

  return {
    isLoading,
    taskList,
    memberList,
    scopedProjectList,
    activeTemplate,
    listTasksKey,
    updateTask,
    createTask,
    addActivity,
    queryClient,
    showForm,
    setShowForm,
    editId,
    setEditId,
    form,
    setForm,
    checklist,
    setChecklist,
    viewMode,
    setViewMode,
    handleCategoriaChange,
    handleMeseChange,
    handlePacchettoChange,
    handleTaskTypeToggle,
    handleOpenEdit,
    handleSave,
    resetFormState,
    handleStatusChange,
    handleDelete,
    ...filters,
    ...bulkActions,
    ...checklistState,
  };
}
