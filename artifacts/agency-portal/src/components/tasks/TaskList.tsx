import { ListChecks, Pencil, Trash2 } from "lucide-react";
import { cn, PRIORITY_COLORS, PRIORITY_LABELS, TASK_STATUS_COLORS, TASK_STATUS_LABELS, formatDate } from "@/lib/utils";

export function TaskList({
  filtered,
  selectedTaskIds,
  toggleTaskSelection,
  allTasksSelected,
  toggleSelectAllTasks,
  parseChecklist,
  calcProgress,
  isOverdue,
  handleOpenEdit,
  handleOpenDetail,
  handleDelete,
  ProgressBar,
}: {
  filtered: any[];
  selectedTaskIds: number[];
  toggleTaskSelection: (id: number, checked: boolean) => void;
  allTasksSelected: boolean;
  toggleSelectAllTasks: (checked: boolean) => void;
  parseChecklist: (json: string) => any[];
  calcProgress: (items: any[]) => { done: number; total: number; pct: number };
  isOverdue: (dueDate?: string | null, status?: string) => boolean;
  handleOpenEdit: (task: any) => void;
  handleOpenDetail: (task: any) => void;
  handleDelete: (id: number) => void;
  ProgressBar: React.ComponentType<{ pct: number; className?: string }>;
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl">
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-card-border bg-muted/30">
              <th className="px-3 py-2 text-left">
                <input
                  type="checkbox"
                  checked={allTasksSelected}
                  onChange={(e) => toggleSelectAllTasks(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                  aria-label="Seleziona tutti i task filtrati"
                />
              </th>
              <th className="px-3 py-2 text-left">Title</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Category</th>
              <th className="px-3 py-2 text-left">Priority</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Assigned to</th>
              <th className="px-3 py-2 text-left">Due date</th>
              <th className="px-3 py-2 text-left">Progress</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((task) => {
              const isAvanzata = task.tipo === "avanzata";
              const items = isAvanzata ? parseChecklist(task.checklistJson) : [];
              const { done, total, pct } = calcProgress(items);
              return (
                <tr key={task.id} className="border-b border-card-border/50">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedTaskIds.includes(task.id)}
                      onChange={(e) => toggleTaskSelection(task.id, e.target.checked)}
                      className="h-4 w-4 accent-primary"
                      aria-label={`Seleziona task ${task.title}`}
                    />
                  </td>
                  <td className="px-3 py-2 max-w-[280px]">
                    <button onClick={() => handleOpenEdit(task)} className="font-medium hover:text-primary text-left truncate">
                      {task.title}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn("text-[11px] px-1.5 py-0.5 rounded-full font-medium", isAvanzata ? "bg-violet-100 text-violet-700" : "bg-gray-100 text-gray-600")}>
                      {isAvanzata ? "Avanzata" : "Semplice"}
                    </span>
                  </td>
                  <td className="px-3 py-2">{task.categoria ?? "—"}</td>
                  <td className="px-3 py-2"><span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", PRIORITY_COLORS[task.priority])}>{PRIORITY_LABELS[task.priority]}</span></td>
                  <td className="px-3 py-2"><span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", TASK_STATUS_COLORS[task.status])}>{TASK_STATUS_LABELS[task.status]}</span></td>
                  <td className="px-3 py-2">{task.assigneeName ?? "—"}</td>
                  <td className={cn("px-3 py-2", isOverdue(task.dueDate, task.status) ? "text-red-600 font-semibold" : "")}>{task.dueDate ? formatDate(task.dueDate) : "—"}</td>
                  <td className="px-3 py-2 min-w-[130px]">
                    {isAvanzata ? (
                      <div>
                        <ProgressBar pct={pct} />
                        <span className="text-[11px] text-muted-foreground">{done}/{total}</span>
                      </div>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleOpenEdit(task)} className="p-1.5 text-muted-foreground hover:text-foreground" title="Modifica"><Pencil size={14} /></button>
                      {isAvanzata && <button onClick={() => handleOpenDetail(task)} className="p-1.5 text-primary/70 hover:text-primary" title="Dettaglio"><ListChecks size={14} /></button>}
                      <button onClick={() => handleDelete(task.id)} className="p-1.5 text-muted-foreground hover:text-destructive" title="Elimina"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="md:hidden divide-y divide-card-border/70">
        {filtered.map((task) => {
          const isAvanzata = task.tipo === "avanzata";
          const items = isAvanzata ? parseChecklist(task.checklistJson) : [];
          const { done, total, pct } = calcProgress(items);
          return (
            <div key={task.id} className="p-3">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={selectedTaskIds.includes(task.id)}
                  onChange={(e) => toggleTaskSelection(task.id, e.target.checked)}
                  className="mt-1 h-4 w-4 accent-primary"
                  aria-label={`Seleziona task ${task.title}`}
                />
                <div className="min-w-0 flex-1">
                  <button onClick={() => handleOpenEdit(task)} className="font-medium text-left break-words hover:text-primary">
                    {task.title}
                  </button>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", isAvanzata ? "bg-violet-100 text-violet-700" : "bg-gray-100 text-gray-600")}>
                      {isAvanzata ? "Avanzata" : "Semplice"}
                    </span>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", PRIORITY_COLORS[task.priority])}>{PRIORITY_LABELS[task.priority]}</span>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", TASK_STATUS_COLORS[task.status])}>{TASK_STATUS_LABELS[task.status]}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                    <span>Assegnato: {task.assigneeName ?? "—"}</span>
                    <span>Scadenza: {task.dueDate ? formatDate(task.dueDate) : "—"}</span>
                  </div>
                  {isAvanzata && (
                    <div className="mt-2">
                      <ProgressBar pct={pct} />
                      <span className="text-[11px] text-muted-foreground">{done}/{total}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-end gap-1">
                <button onClick={() => handleOpenEdit(task)} className="p-2 text-muted-foreground hover:text-foreground" title="Modifica"><Pencil size={15} /></button>
                {isAvanzata && <button onClick={() => handleOpenDetail(task)} className="p-2 text-primary/70 hover:text-primary" title="Dettaglio"><ListChecks size={15} /></button>}
                <button onClick={() => handleDelete(task.id)} className="p-2 text-muted-foreground hover:text-destructive" title="Elimina"><Trash2 size={15} /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
