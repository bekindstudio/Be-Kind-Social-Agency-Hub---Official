import { useEffect, useRef, useState } from "react";
import { Sparkles, Columns3, List, ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/utils";
import { EMPTY_TASK_FORM, toApiClientId } from "@/hooks/useTasks";
import { useTasksPageController } from "@/hooks/useTasksPageController";
import { useToast } from "@/hooks/use-toast";
import { TaskFilters } from "@/components/tasks/TaskFilters";
import { TaskList } from "@/components/tasks/TaskList";
import { TaskKanban } from "@/components/tasks/TaskKanban";
import { TaskDetail } from "@/components/tasks/TaskDetail";
import { TaskForm } from "@/components/tasks/TaskForm";
import { TaskWizard } from "@/components/tasks/TaskWizard";
import { TaskBulkActions } from "@/components/tasks/TaskBulkActions";
import {
  CATEGORIA_COLORS,
  CATEGORIE,
  ChecklistEditor,
  createChecklistItem,
  MESI,
  PACCHETTI,
  parseChecklist,
  generateChecklist,
  isOverdue,
  ProgressBar,
  TIPI_REPORT,
} from "@/components/tasks/TaskChecklist";
export default function Tasks() {
  const vm = useTasksPageController();
  const { toast } = useToast();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "1") {
      setWizardOpen(true);
      params.delete("new");
      const newSearch = params.toString();
      window.history.replaceState({}, "", `/tasks${newSearch ? `?${newSearch}` : ""}`);
    }
  }, []);

  // Deep-link ?id=<taskId> dalla ricerca globale / Command Palette: apre il
  // dettaglio della task appena la lista è caricata (prima il click sul
  // risultato portava solo alla lista, senza aprire nulla).
  const openedIdRef = useRef(false);
  useEffect(() => {
    if (openedIdRef.current) return;
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) return;
    const list = (vm.taskList as any[]) ?? [];
    const t = list.find((x) => String(x.id) === id);
    if (t) {
      vm.setDetailTask(t);
      openedIdRef.current = true;
      window.history.replaceState({}, "", "/tasks");
    }
  }, [vm.taskList]);

  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const endOfWeekISO = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? 0 : 7 - day;
    d.setDate(d.getDate() + diff);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (vm.selectedTaskIds.length === 0) return;
    const results = await Promise.allSettled(
      vm.selectedTaskIds.map((id: number) =>
        new Promise<void>((resolve, reject) => {
          vm.updateTask.mutate(
            { id, data: { status: newStatus } as any },
            {
              onSuccess: () => resolve(),
              onError: (err: any) => reject(err),
            }
          );
        })
      )
    );
    const success = results.filter((r) => r.status === "fulfilled").length;
    const failed = vm.selectedTaskIds.length - success;
    vm.queryClient.invalidateQueries({ queryKey: vm.listTasksKey });
    if (failed > 0) {
      toast({ variant: "destructive", title: `${success} aggiornate, ${failed} fallite` });
    } else {
      toast({ title: `${success} task aggiornate` });
    }
  };

  const applyPreset = (preset: "today" | "week" | "overdue" | "unassigned") => {
    if (activePreset === preset) {
      vm.clearFilters();
      setActivePreset("");
      return;
    }
    vm.clearFilters();
    if (preset === "today") {
      const t = todayISO();
      vm.setFilterDateFrom(t);
      vm.setFilterDateTo(t);
    } else if (preset === "week") {
      vm.setFilterDateFrom(todayISO());
      vm.setFilterDateTo(endOfWeekISO());
    } else if (preset === "overdue") {
      // Le task overdue sono quelle con dueDate < oggi e status != done
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      vm.setFilterDateTo(`${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`);
    } else if (preset === "unassigned") {
      vm.setFilterAssignee("unassigned");
    }
    setActivePreset(preset);
  };

  const handleWizardCreate = async ({ form, checklist }: { form: any; checklist: any[] }): Promise<void> => {
    if (!form.title?.trim()) return;
    if (!form.clientId) return;
    const isAvanzata = form.taskType === "avanzata";
    const payload = {
      title: form.title,
      description: form.description || null,
      clientId: toApiClientId(form.clientId),
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
    await new Promise<void>((resolve, reject) => {
      vm.createTask.mutate({ data: payload as any }, {
        onSuccess: (created: any) => {
          vm.queryClient.invalidateQueries({ queryKey: vm.listTasksKey });
          toast({ title: "Task creata", description: form.title });
          if (created?.id) void vm.addActivity(created.id, "Task creata", created?.title ?? form.title);
          resolve();
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Creazione task non riuscita", description: err?.message ?? "Riprova" });
          reject(err);
        },
      });
    });
  };

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-6xl mx-auto">
        {/* Hero (Wave BI): headline conciso "Hai N task da gestire" + line di
            contesto. Sostituisce il vecchio "{N} task totali" che era solo
            un numero senza utilità immediata. Pattern allineato a Today/Agenda. */}
        {(() => {
          const allTasks = vm.taskList as any[];
          const doneCount = allTasks.filter((t) => t?.status === "done").length;
          const pendingTasks = allTasks.filter((t) => t?.status !== "done");
          const now = new Date();
          const overdueCount = pendingTasks.filter((t) => t?.dueDate && new Date(t.dueDate) < now).length;
          const todoCount = pendingTasks.length;
          return (
            <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                {todoCount === 0 ? (
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                    Nessuna task da gestire. <span className="text-emerald-600">Tutto fatto ✓</span>
                  </h1>
                ) : (
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                    Hai <span className="text-primary tabular-nums">{todoCount}</span> {todoCount === 1 ? "task" : "task"} da gestire
                    {overdueCount > 0 && (
                      <span className="text-amber-600">, {overdueCount} {overdueCount === 1 ? "scaduta" : "scadute"}</span>
                    )}
                  </h1>
                )}
                <p className="text-sm text-muted-foreground mt-2">
                  {doneCount} {doneCount === 1 ? "completata" : "completate"} · {allTasks.length} totali
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                  <button onClick={() => { vm.setViewMode("list"); localStorage.setItem("tasks-view", "list"); }} className={`p-1.5 rounded-md transition-all ${vm.viewMode === "list" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`} title="Vista lista"><List size={15} /></button>
                  <button onClick={() => { vm.setViewMode("kanban"); localStorage.setItem("tasks-view", "kanban"); }} className={`p-1.5 rounded-md transition-all ${vm.viewMode === "kanban" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`} title="Vista kanban"><Columns3 size={15} /></button>
                </div>
                <button onClick={() => setWizardOpen(true)} className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"><Sparkles size={16} />Nuovo Task</button>
              </div>
            </div>
          );
        })()}

        <TaskWizard
          open={wizardOpen}
          onClose={() => setWizardOpen(false)}
          onCreate={handleWizardCreate}
          isSubmitting={vm.createTask.isPending}
          clientOptions={vm.clientList}
          projectOptions={vm.pickerProjectList}
          memberOptions={vm.memberList as Array<{ id: number | string; name?: string | null; surname?: string | null; email?: string | null }>}
        />

        <TaskForm
          state={{ open: vm.showForm, editId: vm.editId, form: vm.form, isSubmitting: vm.createTask.isPending || vm.updateTask.isPending }}
          clientOptions={vm.clientList}
          projectOptions={vm.pickerProjectList}
          memberOptions={vm.memberList as Array<{ id: number | string; name?: string | null; surname?: string | null }>}
          activeTemplate={vm.activeTemplate}
          onFormChange={(updates) => vm.setForm((prev) => ({ ...prev, ...updates }))}
          actions={{ onTaskTypeToggle: vm.handleTaskTypeToggle, onCategoriaChange: vm.handleCategoriaChange, onMeseChange: vm.handleMeseChange, onPacchettoChange: vm.handlePacchettoChange, onSave: vm.handleSave, onCancel: vm.resetFormState }}
          options={{ categories: CATEGORIE, months: MESI, packages: PACCHETTI, reportTypes: TIPI_REPORT, statusLabels: TASK_STATUS_LABELS, priorityLabels: PRIORITY_LABELS }}
          checklistSection={<ChecklistEditor items={vm.checklist} onChange={vm.setChecklist} />}
        />

        <TaskFilters
          filteredCount={vm.filtered.length}
          showMobileFilters={vm.showMobileFilters}
          onToggleMobileFilters={() => vm.setShowMobileFilters((v) => !v)}
          search={vm.search}
          onSearchChange={vm.setSearch}
          filterTipo={vm.filterTipo}
          onFilterTipoChange={vm.setFilterTipo}
          filterCategory={vm.filterCategory}
          onFilterCategoryChange={vm.setFilterCategory}
          categories={CATEGORIE}
          filterStatus={vm.filterStatus}
          onFilterStatusChange={vm.setFilterStatus}
          filterPriority={vm.filterPriority}
          onFilterPriorityChange={vm.setFilterPriority}
          filterClient={vm.filterClient}
          onFilterClientChange={vm.setFilterClient}
          clientOptions={vm.clientList}
          filterProject={vm.filterProject}
          onFilterProjectChange={vm.setFilterProject}
          projectOptions={vm.scopedProjectList as Array<{ id: number | string; name: string }>}
          filterAssignee={vm.filterAssignee}
          onFilterAssigneeChange={vm.setFilterAssignee}
          assigneeOptions={vm.memberList as Array<{ id: number | string; name: string; surname?: string | null }>}
          filterDateFrom={vm.filterDateFrom}
          onFilterDateFromChange={vm.setFilterDateFrom}
          filterDateTo={vm.filterDateTo}
          onFilterDateToChange={vm.setFilterDateTo}
          hasActiveFilters={vm.hasActiveFilters}
          onClearFilters={() => { vm.clearFilters(); setActivePreset(""); }}
          onApplyPreset={applyPreset}
          activePreset={activePreset}
        />

        <TaskBulkActions
          selectedIds={vm.selectedTaskIds}
          onDeleteSelected={vm.handleBulkDeleteTasks}
          onBulkStatusChange={handleBulkStatusChange}
        />

        {/* Le task completate sono nascoste di default: qui si mostrano/nascondono. */}
        {vm.doneCount > 0 && (
          <button
            onClick={() => vm.setHideDone(!vm.hideDone)}
            className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-card-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {vm.hideDone ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            <CheckCircle2 size={13} className="text-emerald-500" />
            {vm.hideDone ? `Mostra completate (${vm.doneCount})` : `Nascondi completate (${vm.doneCount})`}
          </button>
        )}

        {vm.isLoading ? (
          <div className="text-center text-muted-foreground py-12">Caricamento...</div>
        ) : vm.filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            {vm.hideDone && vm.doneCount > 0
              ? "Nessuna task da fare — sono tutte completate."
              : "Nessun task trovato"}
          </div>
        ) : vm.viewMode === "kanban" ? (
          <TaskKanban
            tasks={vm.filtered}
            selectedTaskIds={vm.selectedTaskIds}
            onToggleSelection={vm.toggleTaskSelection}
            onOpenEdit={vm.handleOpenEdit}
            onStatusChange={vm.handleStatusChange}
            onCreateInStatus={(status) => { vm.setShowForm(true); vm.setEditId(null); vm.setChecklist([]); vm.setForm({ ...EMPTY_TASK_FORM, status }); }}
            parseChecklist={parseChecklist}
            ProgressBar={ProgressBar}
            isOverdue={isOverdue}
            categoryColors={CATEGORIA_COLORS}
          />
        ) : (
          <TaskList
            filtered={vm.filtered}
            selectedTaskIds={vm.selectedTaskIds}
            toggleTaskSelection={vm.toggleTaskSelection}
            allTasksSelected={vm.allTasksSelected}
            toggleSelectAllTasks={vm.toggleSelectAllTasks}
            parseChecklist={parseChecklist}
            isOverdue={isOverdue}
            handleOpenEdit={vm.handleOpenEdit}
            handleOpenDetail={vm.handleOpenDetail}
            handleDelete={vm.handleDelete}
            ProgressBar={ProgressBar}
          />
        )}
      </div>

      <TaskDetail
        detailTask={vm.detailTask}
        setDetailTask={vm.setDetailTask}
        handleStatusChange={vm.handleStatusChange}
        updateTask={vm.updateTask}
        queryClient={vm.queryClient}
        listTasksKey={vm.listTasksKey}
        addActivity={vm.addActivity}
        parseChecklist={parseChecklist}
        handleToggleChecklistItem={vm.handleToggleChecklistItem}
        taskActivity={vm.taskActivity}
        isActivityLoading={vm.isActivityLoading}
        activityError={vm.activityError}
        commentDraft={vm.commentDraft}
        setCommentDraft={vm.setCommentDraft}
        handleAddComment={vm.handleAddComment}
        addTaskComment={vm.addTaskComment}
        taskComments={vm.taskComments}
        isCommentsLoading={vm.isCommentsLoading}
        commentsError={vm.commentsError}
      />
    </Layout>
  );
}
