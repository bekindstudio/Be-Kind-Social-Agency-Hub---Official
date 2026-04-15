import { Globe, Pencil, Save, Sparkles, X } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface ClientDetailHeaderProps {
  clientId: string | number;
  viewClient: {
    name: string;
    company?: string | null;
    website?: string | null;
    color?: string;
    createdAt: string;
    sector?: string | null;
  };
  displayLogo?: string | null;
  clientProjectsCount: number;
  editing: boolean;
  isSaving: boolean;
  onOpenAi: (payload: { id: string | number; name: string; sector: string | null | undefined; activeProjects: number }) => void;
  onSave: () => void;
  onCancel: () => void;
  onStartEdit: () => void;
}

export function ClientDetailHeader({
  clientId,
  viewClient,
  displayLogo,
  clientProjectsCount,
  editing,
  isSaving,
  onOpenAi,
  onSave,
  onCancel,
  onStartEdit,
}: ClientDetailHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-8">
      <div className="flex items-center gap-5">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center text-white font-bold text-3xl overflow-hidden shrink-0"
          style={{ backgroundColor: displayLogo ? "#f0f2ed" : viewClient.color }}
        >
          {displayLogo ? (
            <img src={displayLogo} alt={viewClient.name} className="w-full h-full object-contain p-1" />
          ) : (
            String(viewClient.name ?? "C").charAt(0).toUpperCase()
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{viewClient.name}</h1>
          {viewClient.company && <p className="text-muted-foreground">{viewClient.company}</p>}
          {viewClient.website && (
            <a
              href={viewClient.website}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1 mt-0.5"
            >
              <Globe size={13} /> {viewClient.website}
            </a>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Cliente dal {formatDate(viewClient.createdAt)}
          </p>
          <button
            onClick={() =>
              onOpenAi({
                id: clientId,
                name: viewClient.name,
                sector: viewClient.sector,
                activeProjects: clientProjectsCount,
              })
            }
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-violet-50 text-violet-700 rounded-lg hover:bg-violet-100 transition-colors border border-violet-200 mt-2"
          >
            <Sparkles size={12} /> Chiedi all'AI su questo cliente
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        {editing ? (
          <>
            <button
              onClick={onSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              <Save size={15} /> {isSaving ? "Salvataggio..." : "Salva"}
            </button>
            <button
              onClick={onCancel}
              className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:opacity-80"
            >
              <X size={15} /> Annulla
            </button>
          </>
        ) : (
          <button
            onClick={onStartEdit}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
          >
            <Pencil size={15} /> Modifica
          </button>
        )}
      </div>
    </div>
  );
}
