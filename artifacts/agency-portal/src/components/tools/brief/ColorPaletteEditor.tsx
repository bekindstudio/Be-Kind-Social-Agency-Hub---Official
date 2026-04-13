import { Plus, X } from "lucide-react";

interface ColorPaletteEditorProps {
  colors: string[];
  labels: string[];
  onChange: (colors: string[], labels: string[]) => void;
}

export function ColorPaletteEditor({ colors, labels, onChange }: ColorPaletteEditorProps) {
  const updateColor = (index: number, value: string) => {
    const nextColors = [...colors];
    nextColors[index] = value;
    onChange(nextColors, labels);
  };

  const updateLabel = (index: number, value: string) => {
    const nextLabels = [...labels];
    nextLabels[index] = value;
    onChange(colors, nextLabels);
  };

  const add = () => {
    if (colors.length >= 6) return;
    onChange([...colors, "#4F46E5"], [...labels, `Colore ${colors.length + 1}`]);
  };

  const remove = (index: number) => {
    const nextColors = colors.filter((_, i) => i !== index);
    const nextLabels = labels.filter((_, i) => i !== index);
    onChange(nextColors, nextLabels);
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {colors.map((color, index) => (
          <div key={`${color}-${index}`} className="rounded-lg border border-input p-2">
            <div className="flex items-start justify-between gap-2">
              <label className="relative h-10 w-10 cursor-pointer overflow-hidden rounded-md border border-input">
                <input
                  type="color"
                  value={color}
                  onChange={(event) => updateColor(index, event.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label={`Colore palette ${index + 1}`}
                />
                <span className="block h-full w-full" style={{ backgroundColor: color }} />
              </label>
              <button
                type="button"
                onClick={() => remove(index)}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                aria-label={`Rimuovi colore ${index + 1}`}
              >
                <X size={12} />
              </button>
            </div>
            <input
              value={labels[index] ?? ""}
              onChange={(event) => updateLabel(index, event.target.value)}
              aria-label={`Etichetta colore ${index + 1}`}
              className="mt-2 w-full rounded border border-input bg-background px-2 py-1 text-xs"
              placeholder="Nome colore"
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        disabled={colors.length >= 6}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-input px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40"
      >
        <Plus size={12} />
        Aggiungi colore
      </button>
    </div>
  );
}
