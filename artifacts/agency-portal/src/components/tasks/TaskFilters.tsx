import { CalendarDays, Search, SlidersHorizontal, X } from "lucide-react";
import { cn, PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/utils";

interface TaskFiltersProps {
  filteredCount: number;
  showMobileFilters: boolean;
  onToggleMobileFilters: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  filterTipo: string;
  onFilterTipoChange: (value: string) => void;
  filterCategory: string;
  onFilterCategoryChange: (value: string) => void;
  categories: readonly string[];
  filterStatus: string;
  onFilterStatusChange: (value: string) => void;
  filterPriority: string;
  onFilterPriorityChange: (value: string) => void;
  filterProject: string;
  onFilterProjectChange: (value: string) => void;
  projectOptions: Array<{ id: number | string; name: string }>;
  filterAssignee: string;
  onFilterAssigneeChange: (value: string) => void;
  assigneeOptions: Array<{ id: number | string; name: string; surname?: string | null }>;
  filterDateFrom: string;
  onFilterDateFromChange: (value: string) => void;
  filterDateTo: string;
  onFilterDateToChange: (value: string) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

export function TaskFilters({
  filteredCount,
  showMobileFilters,
  onToggleMobileFilters,
  search,
  onSearchChange,
  filterTipo,
  onFilterTipoChange,
  filterCategory,
  onFilterCategoryChange,
  categories,
  filterStatus,
  onFilterStatusChange,
  filterPriority,
  onFilterPriorityChange,
  filterProject,
  onFilterProjectChange,
  projectOptions,
  filterAssignee,
  onFilterAssigneeChange,
  assigneeOptions,
  filterDateFrom,
  onFilterDateFromChange,
  filterDateTo,
  onFilterDateToChange,
  hasActiveFilters,
  onClearFilters,
}: TaskFiltersProps) {
  return (
    <>
      <div className="mb-3 flex items-center justify-between md:hidden">
        <button
          onClick={onToggleMobileFilters}
          className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm"
        >
          <SlidersHorizontal size={14} />
          {showMobileFilters ? "Nascondi filtri" : "Mostra filtri"}
        </button>
        <span className="text-xs text-muted-foreground">{filteredCount} risultati</span>
      </div>
      <div className={cn("mb-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3", !showMobileFilters && "hidden md:grid")}>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Cerca task..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <select className="px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" value={filterTipo} onChange={(e) => onFilterTipoChange(e.target.value)}>
          <option value="">Tutti i tipi</option>
          <option value="semplice">Semplice</option>
          <option value="avanzata">Avanzata</option>
        </select>
        <select className="px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" value={filterCategory} onChange={(e) => onFilterCategoryChange(e.target.value)}>
          <option value="">Tutte le categorie</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select className="px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" value={filterStatus} onChange={(e) => onFilterStatusChange(e.target.value)}>
          <option value="">Tutti gli stati</option>
          {Object.entries(TASK_STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select className="px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" value={filterPriority} onChange={(e) => onFilterPriorityChange(e.target.value)}>
          <option value="">Tutte le priorita</option>
          {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select className="px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" value={filterProject} onChange={(e) => onFilterProjectChange(e.target.value)}>
          <option value="">Tutti i progetti</option>
          {projectOptions.map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.name}
            </option>
          ))}
        </select>
        <select className="px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" value={filterAssignee} onChange={(e) => onFilterAssigneeChange(e.target.value)}>
          <option value="">Tutti gli assegnatari</option>
          {assigneeOptions.map((m) => (
            <option key={m.id} value={String(m.id)}>
              {m.name} {m.surname ?? ""}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1.5">
          <CalendarDays size={14} className="text-muted-foreground shrink-0" />
          <input type="date" className="px-2 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" value={filterDateFrom} onChange={(e) => onFilterDateFromChange(e.target.value)} title="Da data" />
          <span className="text-xs text-muted-foreground">-</span>
          <input type="date" className="px-2 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" value={filterDateTo} onChange={(e) => onFilterDateToChange(e.target.value)} title="A data" />
        </div>
        {hasActiveFilters && (
          <button onClick={onClearFilters} className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground border border-input rounded-lg bg-background flex items-center gap-1">
            <X size={12} /> Azzera filtri
          </button>
        )}
      </div>
    </>
  );
}
