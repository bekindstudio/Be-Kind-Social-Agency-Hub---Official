import { Plus, Columns3, List } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/utils";
import { EMPTY_TASK_FORM } from "@/hooks/useTasks";
import { useTasksPageController } from "@/hooks/useTasksPageController";
import { TaskFilters } from "@/components/tasks/TaskFilters";
import { TaskList } from "@/components/tasks/TaskList";
import { TaskKanban } from "@/components/tasks/TaskKanban";
import { TaskDetail } from "@/components/tasks/TaskDetail";
import { TaskForm } from "@/components/tasks/TaskForm";
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

  return (
    <Layout>
      <div className="p-4 md:p-8">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Task</h1>
            <p className="text-muted-foreground text-sm mt-1">{vm.taskList.length} task totali</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <button onClick={() => { vm.setViewMode("list"); localStorage.setItem("tasks-view", "list"); }} className={`p-1.5 rounded-md transition-all ${vm.viewMode === "list" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`} title="Vista lista"><List size={15} /></button>
              <button onClick={() => { vm.setViewMode("kanban"); localStorage.setItem("tasks-view", "kanban"); }} className={`p-1.5 rounded-md transition-all ${vm.viewMode === "kanban" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`} title="Vista kanban"><Columns3 size={15} /></button>
            </div>
            <button onClick={() => { vm.setEditId(null); vm.setShowForm(!vm.showForm); vm.setForm(EMPTY_TASK_FORM); vm.setChecklist([]); }} className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity w-full sm:w-auto"><Plus size={16} />Nuovo Task</button>
          </div>
        </div>

        <TaskForm
          state={{ open: vm.showForm, editId: vm.editId, form: vm.form, isSubmitting: vm.createTask.isPending || vm.updateTask.isPending }}
          projectOptions={vm.scopedProjectList as Array<{ id: number | string; name: string }>}
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
          onClearFilters={vm.clearFilters}
        />

        <TaskBulkActions
          selectedIds={vm.selectedTaskIds}
          onDeleteSelected={vm.handleBulkDeleteTasks}
        />

        {vm.isLoading ? (
          <div className="text-center text-muted-foreground py-12">Caricamento...</div>
        ) : vm.filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">Nessun task trovato</div>
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
