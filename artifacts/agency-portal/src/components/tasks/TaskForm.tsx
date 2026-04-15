import type { ReactNode } from "react";

export type TaskFormState = {
  title: string;
  description: string;
  projectId: string;
  assigneeId: string;
  status: string;
  priority: string;
  dueDate: string;
  taskType: "semplice" | "avanzata";
  categoria: string;
  meseRiferimento: string;
  pacchettoContenuti: string;
  tipoReport: string;
};

export function TaskForm({
  state,
  projectOptions,
  memberOptions,
  activeTemplate,
  onFormChange,
  actions,
  options,
  checklistSection,
}: {
  state: {
    open: boolean;
    editId: number | null;
    form: TaskFormState;
    isSubmitting: boolean;
  };
  projectOptions: Array<{ id: number | string; name: string }>;
  memberOptions: Array<{ id: number | string; name?: string | null; surname?: string | null }>;
  activeTemplate: { label: string } | null;
  onFormChange: (updates: Partial<TaskFormState>) => void;
  actions: {
    onTaskTypeToggle: (type: "semplice" | "avanzata") => void;
    onCategoriaChange: (categoria: string) => void;
    onMeseChange: (mese: string) => void;
    onPacchettoChange: (pacchetto: string) => void;
    onSave: () => void;
    onCancel: () => void;
  };
  options: {
    categories: readonly string[];
    months: string[];
    packages: Array<{ value: string; label: string }>;
    reportTypes: string[];
    statusLabels: Record<string, string>;
    priorityLabels: Record<string, string>;
  };
  checklistSection?: ReactNode;
}) {
  if (!state.open) return null;

  const { form } = state;

  return (
    <div className="bg-card border border-card-border rounded-xl p-6 mb-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold">{state.editId ? "Modifica Task" : "Nuovo Task"}</h2>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <button
            onClick={() => actions.onTaskTypeToggle("semplice")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${form.taskType === "semplice" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Semplice
          </button>
          <button
            onClick={() => actions.onTaskTypeToggle("avanzata")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${form.taskType === "avanzata" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Avanzata con checklist
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Titolo *</label>
          <input
            className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Titolo task"
            value={form.title}
            onChange={(e) => onFormChange({ title: e.target.value })}
          />
        </div>

        {form.taskType === "avanzata" && (
          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Categoria *</label>
            <select
              className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none"
              value={form.categoria}
              onChange={(e) => actions.onCategoriaChange(e.target.value)}
            >
              {options.categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        )}

        {form.taskType === "avanzata" && form.categoria === "Piano Editoriale Mensile" && (
          <>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Mese di riferimento</label>
              <select
                className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none"
                value={form.meseRiferimento}
                onChange={(e) => actions.onMeseChange(e.target.value)}
              >
                {options.months.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Pacchetto contenuti</label>
              <select
                className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none"
                value={form.pacchettoContenuti}
                onChange={(e) => actions.onPacchettoChange(e.target.value)}
              >
                {options.packages.map((pkg) => (
                  <option key={pkg.value} value={pkg.value}>
                    {pkg.label}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {form.taskType === "avanzata" && form.categoria === "Report Cliente" && (
          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Tipo report</label>
            <select
              className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none"
              value={form.tipoReport}
              onChange={(e) => onFormChange({ tipoReport: e.target.value })}
            >
              {options.reportTypes.map((reportType) => (
                <option key={reportType} value={reportType}>
                  {reportType}
                </option>
              ))}
            </select>
            {activeTemplate && (
              <p className="mt-1 text-[11px] text-violet-700">
                Checklist report template {activeTemplate.label} applicata automaticamente.
              </p>
            )}
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-muted-foreground">Progetto</label>
          <select
            className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none"
            value={form.projectId}
            onChange={(e) => onFormChange({ projectId: e.target.value })}
          >
            <option value="">Nessun progetto</option>
            {projectOptions.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Assegnato a</label>
          <select
            className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none"
            value={form.assigneeId}
            onChange={(e) => onFormChange({ assigneeId: e.target.value })}
          >
            <option value="">Nessuno</option>
            {memberOptions.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name ?? "Utente"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Stato</label>
          <select
            className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none"
            value={form.status}
            onChange={(e) => onFormChange({ status: e.target.value })}
          >
            {Object.entries(options.statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Priorità</label>
          <select
            className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none"
            value={form.priority}
            onChange={(e) => onFormChange({ priority: e.target.value })}
          >
            {Object.entries(options.priorityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Scadenza</label>
          <input
            type="date"
            className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none"
            value={form.dueDate}
            onChange={(e) => onFormChange({ dueDate: e.target.value })}
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Descrizione (opzionale)</label>
          <input
            className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none"
            placeholder="Descrizione..."
            value={form.description}
            onChange={(e) => onFormChange({ description: e.target.value })}
          />
        </div>
      </div>

      {form.taskType === "avanzata" && checklistSection}

      <div className="flex flex-col sm:flex-row gap-2 mt-4">
        <button
          onClick={actions.onSave}
          disabled={state.isSubmitting}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {state.isSubmitting ? "Salvataggio..." : state.editId ? "Aggiorna Task" : "Crea Task"}
        </button>
        <button
          onClick={actions.onCancel}
          className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:opacity-80"
        >
          Annulla
        </button>
      </div>
    </div>
  );
}
