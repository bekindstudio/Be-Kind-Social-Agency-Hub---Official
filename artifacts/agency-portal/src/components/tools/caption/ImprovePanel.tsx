import { useState } from "react";
import type { CaptionVariant, ImproveRequest } from "@/hooks/useCaptionAi";

interface ImprovePanelProps {
  caption: string;
  platform: "instagram" | "facebook" | "linkedin" | "tiktok";
  onImprove: (request: ImproveRequest) => Promise<CaptionVariant | null>;
  brief: ImproveRequest["brief"];
  onApply: (variant: CaptionVariant) => void;
  onClose: () => void;
}

const QUICK_PROMPTS = [
  "Rendila piu corta",
  "Rendila piu lunga",
  "Aggiungi urgenza",
  "Tono piu formale",
  "Tono piu informale",
  "Aggiungi call to action",
  "Rimuovi hashtag",
  "Piu emoji",
  "Ottimizza per SEO",
];

export function ImprovePanel({ caption, platform, onImprove, brief, onApply, onClose }: ImprovePanelProps) {
  const [instruction, setInstruction] = useState("");
  const [improved, setImproved] = useState<CaptionVariant | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div className="mt-3 rounded-lg border border-input bg-background p-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        {QUICK_PROMPTS.map((prompt) => (
          <button key={prompt} onClick={() => setInstruction(prompt)} className="px-2 py-1 text-xs rounded-full bg-muted text-muted-foreground hover:bg-violet-100 hover:text-violet-700">
            {prompt}
          </button>
        ))}
      </div>
      <textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        rows={3}
        placeholder="Scrivi un'istruzione personalizzata..."
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none"
      />
      <div className="flex items-center justify-end gap-2">
        <button onClick={onClose} className="px-3 py-2 text-sm text-muted-foreground">Chiudi</button>
        <button
          onClick={async () => {
            if (!instruction.trim()) return;
            setLoading(true);
            const next = await onImprove({
              originalCaption: caption,
              instruction: instruction.trim(),
              platform,
              brief,
            });
            setLoading(false);
            if (next) setImproved(next);
          }}
          disabled={loading || !instruction.trim()}
          className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
        >
          {loading ? "Miglioro..." : "Migliora"}
        </button>
      </div>
      {improved && (
        <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
          <p className="text-xs text-violet-700 font-semibold mb-2">Variante migliorata</p>
          <p className="text-sm whitespace-pre-wrap">{improved.caption}</p>
          <div className="mt-3 flex items-center gap-2 justify-end">
            <button onClick={() => setImproved(null)} className="px-3 py-1.5 text-xs text-muted-foreground">Scarta</button>
            <button onClick={() => onApply(improved)} className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium">
              Sostituisci
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
