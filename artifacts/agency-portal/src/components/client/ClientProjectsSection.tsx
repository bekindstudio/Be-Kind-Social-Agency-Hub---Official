import { CheckSquare, FolderKanban, Plus } from "lucide-react";
import { cn, PRIORITY_COLORS, PRIORITY_LABELS, STATUS_COLORS, STATUS_LABELS, TASK_STATUS_COLORS, TASK_STATUS_LABELS } from "@/lib/utils";

export function ClientProjectsSection({
  Section,
  Field,
  clientProjects,
  showProjectForm,
  setShowProjectForm,
  projectForm,
  setProjectForm,
  PROJECT_STATUS_OPTIONS,
  handleAddProject,
  createProject,
  clientTasks,
  showTaskForm,
  setShowTaskForm,
  taskForm,
  setTaskForm,
  TASK_STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  teamMembers,
  handleAddTask,
  createTask,
}: {
  Section: React.ComponentType<{ title: string; icon: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }>;
  Field: React.ComponentType<{ label: string; value: string; onChange: (v: string) => void; placeholder?: string; textarea?: boolean }>;
  clientProjects: any[];
  showProjectForm: boolean;
  setShowProjectForm: (value: boolean) => void;
  projectForm: any;
  setProjectForm: React.Dispatch<React.SetStateAction<any>>;
  PROJECT_STATUS_OPTIONS: Array<{ value: string; label: string }>;
  handleAddProject: () => void;
  createProject: any;
  clientTasks: any[];
  showTaskForm: boolean;
  setShowTaskForm: (value: boolean) => void;
  taskForm: any;
  setTaskForm: React.Dispatch<React.SetStateAction<any>>;
  TASK_STATUS_OPTIONS: Array<{ value: string; label: string }>;
  PRIORITY_OPTIONS: Array<{ value: string; label: string }>;
  teamMembers: any[] | undefined;
  handleAddTask: () => void;
  createTask: any;
}) {
  return (
    <>
      <Section
        title={`Progetti (${clientProjects.length})`}
        icon={<FolderKanban size={15} className="text-primary" />}
        action={
          <button
            onClick={() => setShowProjectForm(!showProjectForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90"
          >
            <Plus size={13} /> Nuovo Progetto
          </button>
        }
      >
        {showProjectForm && (
          <div className="bg-muted/50 border border-border rounded-xl p-4 mb-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome *" value={projectForm.name} onChange={(v) => setProjectForm((p: any) => ({ ...p, name: v }))} placeholder="Nome progetto" />
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Stato</label>
                <select
                  className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={projectForm.status}
                  onChange={(e) => setProjectForm((p: any) => ({ ...p, status: e.target.value }))}
                >
                  {PROJECT_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <Field label="Descrizione" value={projectForm.description} onChange={(v) => setProjectForm((p: any) => ({ ...p, description: v }))} placeholder="Descrizione breve" />
              <Field label="Budget (€)" value={projectForm.budget} onChange={(v) => setProjectForm((p: any) => ({ ...p, budget: v }))} placeholder="0" />
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={handleAddProject} disabled={createProject.isPending}
                className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {createProject.isPending ? "Salvataggio..." : "Crea Progetto"}
              </button>
              <button onClick={() => setShowProjectForm(false)}
                className="px-4 py-1.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:opacity-80">
                Annulla
              </button>
            </div>
          </div>
        )}

        {clientProjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun progetto per questo cliente.</p>
        ) : (
          <div className="space-y-2">
            {clientProjects.map((p: any) => (
              <a key={p.id} href={`/projects/${p.id}`} className="block rounded-xl border border-border p-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="font-medium text-sm">{p.name}</p>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_COLORS[p.status])}>
                    {STATUS_LABELS[p.status] ?? p.status}
                  </span>
                </div>
                {p.description && <p className="text-xs text-muted-foreground mb-3">{p.description}</p>}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${p.progress}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground">{p.progress}%</span>
                </div>
                {p.budget != null && (
                  <p className="text-xs text-muted-foreground mt-2">Budget: €{p.budget.toLocaleString("it-IT")}</p>
                )}
              </a>
            ))}
          </div>
        )}
      </Section>

      <div className="mt-6">
        <Section
          title={`Task (${clientTasks.length})`}
          icon={<CheckSquare size={15} className="text-primary" />}
          action={
            <button
              onClick={() => setShowTaskForm(!showTaskForm)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90"
            >
              <Plus size={13} /> Nuovo Task
            </button>
          }
        >
          {showTaskForm && (
            <div className="bg-muted/50 border border-border rounded-xl p-4 mb-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Titolo *" value={taskForm.title} onChange={(v) => setTaskForm((t: any) => ({ ...t, title: v }))} placeholder="Titolo task" />
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Progetto</label>
                  <select
                    className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none"
                    value={taskForm.projectId}
                    onChange={(e) => setTaskForm((t: any) => ({ ...t, projectId: e.target.value }))}
                  >
                    <option value="">Nessun progetto</option>
                    {clientProjects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Stato</label>
                  <select
                    className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none"
                    value={taskForm.status}
                    onChange={(e) => setTaskForm((t: any) => ({ ...t, status: e.target.value }))}
                  >
                    {TASK_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Priorità</label>
                  <select
                    className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none"
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm((t: any) => ({ ...t, priority: e.target.value }))}
                  >
                    {PRIORITY_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Assegna a</label>
                  <select
                    className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none"
                    value={taskForm.assigneeId}
                    onChange={(e) => setTaskForm((t: any) => ({ ...t, assigneeId: e.target.value }))}
                  >
                    <option value="">Nessuno</option>
                    {(teamMembers ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Scadenza</label>
                  <input type="date" className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none"
                    value={taskForm.dueDate}
                    onChange={(e) => setTaskForm((t: any) => ({ ...t, dueDate: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={handleAddTask} disabled={createTask.isPending}
                  className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                  {createTask.isPending ? "Salvataggio..." : "Crea Task"}
                </button>
                <button onClick={() => setShowTaskForm(false)}
                  className="px-4 py-1.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:opacity-80">
                  Annulla
                </button>
              </div>
            </div>
          )}

          {clientTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun task per questo cliente.</p>
          ) : (
            <div className="space-y-2">
              {clientTasks.map((t: any) => (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background">
                  <div className={cn(
                    "w-4 h-4 rounded-full border-2 shrink-0",
                    t.status === "done" ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground"
                  )} />
                  <p className={cn("flex-1 text-sm", t.status === "done" && "line-through text-muted-foreground")}>{t.title}</p>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", PRIORITY_COLORS[t.priority])}>{PRIORITY_LABELS[t.priority]}</span>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", TASK_STATUS_COLORS[t.status])}>{TASK_STATUS_LABELS[t.status]}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </>
  );
}
