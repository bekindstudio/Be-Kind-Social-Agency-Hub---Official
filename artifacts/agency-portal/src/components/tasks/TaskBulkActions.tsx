import { Trash2, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "todo", label: "Da fare", icon: Circle },
  { value: "in_progress", label: "In corso", icon: Loader2 },
  { value: "in_review", label: "In revisione", icon: Loader2 },
  { value: "done", label: "Fatto", icon: CheckCircle2 },
];

export function TaskBulkActions({
  selectedIds,
  onDeleteSelected,
  onBulkStatusChange,
}: {
  selectedIds: number[];
  onDeleteSelected: () => void;
  onBulkStatusChange?: (status: string) => Promise<void> | void;
}) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [applying, setApplying] = useState(false);

  if (selectedIds.length === 0) return null;

  const handleStatus = async (status: string) => {
    if (!onBulkStatusChange || applying) return;
    setApplying(true);
    try {
      await onBulkStatusChange(status);
    } finally {
      setApplying(false);
      setStatusOpen(false);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 md:static md:mb-4 z-40 md:z-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 shadow-lg md:shadow-none">
        <p className="text-sm text-amber-900 font-medium">{selectedIds.length} task selezionati</p>
        <div className="flex flex-wrap items-center gap-2">
          {onBulkStatusChange && (
            <div className="relative">
              <button
                onClick={() => setStatusOpen((v) => !v)}
                disabled={applying}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
              >
                {applying ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                Cambia stato
              </button>
              {statusOpen && (
                <div className="absolute right-0 bottom-full mb-1 sm:bottom-auto sm:top-full sm:mt-1 sm:mb-0 w-44 bg-card border border-card-border rounded-lg shadow-lg z-50">
                  {STATUS_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => void handleStatus(opt.value)}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted text-left",
                          opt.value === "done" && "text-emerald-700"
                        )}
                      >
                        <Icon size={12} />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <button
            onClick={onDeleteSelected}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            <Trash2 size={13} />
            Elimina
          </button>
        </div>
      </div>
    </div>
  );
}
