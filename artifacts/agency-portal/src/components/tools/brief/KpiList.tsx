import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { BriefKpi } from "@/types/client";

interface KpiListProps {
  value: BriefKpi[];
  onChange: (next: BriefKpi[]) => void;
}

export function KpiList({ value, onChange }: KpiListProps) {
  const [draft, setDraft] = useState<BriefKpi>({ label: "", target: "", unit: "" });

  const updateItem = (index: number, updates: Partial<BriefKpi>) => {
    const next = [...value];
    next[index] = { ...next[index], ...updates };
    onChange(next);
  };

  const remove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const add = () => {
    if (!draft.label.trim() || !draft.target.trim()) return;
    onChange([...value, { label: draft.label.trim(), target: draft.target.trim(), unit: draft.unit.trim() }]);
    setDraft({ label: "", target: "", unit: "" });
  };

  return (
    <div className="space-y-2">
      {value.map((item, index) => (
        <div key={`${item.label}-${index}`} className="grid grid-cols-1 gap-2 rounded-lg border border-input p-2 sm:grid-cols-12">
          <input
            value={item.label}
            onChange={(event) => updateItem(index, { label: event.target.value })}
            aria-label={`KPI ${index + 1} etichetta`}
            className="rounded border border-input bg-background px-2 py-1.5 text-xs sm:col-span-5"
            placeholder="Es. Follower Instagram"
          />
          <input
            value={item.target}
            onChange={(event) => updateItem(index, { target: event.target.value })}
            aria-label={`KPI ${index + 1} target`}
            className="rounded border border-input bg-background px-2 py-1.5 text-xs sm:col-span-3"
            placeholder="Es. 5000"
          />
          <input
            value={item.unit}
            onChange={(event) => updateItem(index, { unit: event.target.value })}
            aria-label={`KPI ${index + 1} scadenza`}
            className="rounded border border-input bg-background px-2 py-1.5 text-xs sm:col-span-3"
            placeholder="Es. entro dic 2025"
          />
          <button
            type="button"
            onClick={() => remove(index)}
            aria-label={`Rimuovi KPI ${index + 1}`}
            className="inline-flex items-center justify-center rounded border border-input px-2 py-1.5 text-muted-foreground hover:bg-muted sm:col-span-1"
          >
            <X size={12} />
          </button>
        </div>
      ))}

      <div className="grid grid-cols-1 gap-2 rounded-lg border border-dashed border-input p-2 sm:grid-cols-12">
        <input
          value={draft.label}
          onChange={(event) => setDraft((prev) => ({ ...prev, label: event.target.value }))}
          aria-label="Nuovo KPI etichetta"
          className="rounded border border-input bg-background px-2 py-1.5 text-xs sm:col-span-5"
          placeholder="Nuovo KPI"
        />
        <input
          value={draft.target}
          onChange={(event) => setDraft((prev) => ({ ...prev, target: event.target.value }))}
          aria-label="Nuovo KPI target"
          className="rounded border border-input bg-background px-2 py-1.5 text-xs sm:col-span-3"
          placeholder="Target"
        />
        <input
          value={draft.unit}
          onChange={(event) => setDraft((prev) => ({ ...prev, unit: event.target.value }))}
          aria-label="Nuovo KPI scadenza"
          className="rounded border border-input bg-background px-2 py-1.5 text-xs sm:col-span-3"
          placeholder="Scadenza"
        />
        <button
          type="button"
          onClick={add}
          aria-label="Aggiungi KPI"
          className="inline-flex items-center justify-center rounded bg-primary px-2 py-1.5 text-primary-foreground hover:opacity-90 sm:col-span-1"
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
  );
}
