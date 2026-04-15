import { Trash2 } from "lucide-react";

export function TaskBulkActions({
  selectedIds,
  onDeleteSelected,
}: {
  selectedIds: number[];
  onDeleteSelected: () => void;
}) {
  if (selectedIds.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:static md:mb-4 z-40 md:z-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 shadow-lg md:shadow-none">
        <p className="text-sm text-amber-900">{selectedIds.length} task selezionati</p>
        <button
          onClick={onDeleteSelected}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
        >
          <Trash2 size={13} />
          Elimina selezionati
        </button>
      </div>
    </div>
  );
}
