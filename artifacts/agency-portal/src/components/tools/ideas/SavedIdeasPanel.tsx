import { useState } from "react";
import { Bookmark, GripVertical, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { ContentIdea } from "@/types/content-ideas";

interface SavedIdeasPanelProps {
  savedIdeas: ContentIdea[];
  onReorder: (next: ContentIdea[]) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onAddAllToPlan: (ideas: ContentIdea[]) => void;
}

export function SavedIdeasPanel({ savedIdeas, onReorder, onRemove, onClear, onAddAllToPlan }: SavedIdeasPanelProps) {
  const [open, setOpen] = useState(false);

  const moveIdea = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= savedIdeas.length) return;
    const next = [...savedIdeas];
    const [current] = next.splice(index, 1);
    next.splice(target, 0, current);
    onReorder(next);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button type="button" className="fixed bottom-6 left-6 z-40 inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-lg">
          <Bookmark size={16} />
          Idee salvate ({savedIdeas.length})
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[420px] overflow-y-auto sm:max-w-[420px]">
        <SheetHeader>
          <SheetTitle>Idee salvate</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <div className="flex gap-2">
            <button type="button" className="flex-1 rounded-lg bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-700" onClick={() => onAddAllToPlan(savedIdeas)}>
              Aggiungi tutte al piano
            </button>
            <button
              type="button"
              className="flex-1 rounded-lg bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700"
              onClick={() => {
                if (!window.confirm("Vuoi rimuovere tutte le idee salvate?")) return;
                onClear();
              }}
            >
              Pulisci tutto
            </button>
          </div>

          {savedIdeas.map((idea, index) => (
            <div key={idea.id} className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-start gap-2">
                <GripVertical size={14} className="mt-1 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">{idea.title}</p>
                  <p className="text-xs text-muted-foreground">{idea.platform} · {idea.format}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{idea.description}</p>
                </div>
                <button type="button" className="rounded-md p-1 text-rose-600 hover:bg-rose-100" onClick={() => onRemove(idea.id)}>
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="mt-2 flex justify-end gap-1">
                <button type="button" className="rounded-md bg-muted px-2 py-1 text-[11px]" onClick={() => moveIdea(index, -1)}>
                  Su
                </button>
                <button type="button" className="rounded-md bg-muted px-2 py-1 text-[11px]" onClick={() => moveIdea(index, 1)}>
                  Giù
                </button>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
