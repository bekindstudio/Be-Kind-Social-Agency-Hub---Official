import { useMemo, useState } from "react";
import { Copy, Pencil, Wand2, CalendarPlus, Sparkles } from "lucide-react";
import type { CaptionVariant, ImproveRequest } from "@/hooks/useCaptionAi";
import { CaptionEditor } from "./CaptionEditor";
import { ImprovePanel } from "./ImprovePanel";
import { AddToPlanModal } from "./AddToPlanModal";
import type { SocialPlatform } from "@/types/client";

interface CaptionResultsProps {
  variants: CaptionVariant[];
  bestVariantId?: string | null;
  selectedPlatform: "instagram" | "facebook" | "linkedin" | "tiktok";
  theme: string;
  clientId: string;
  brief: ImproveRequest["brief"];
  onUpdateVariant: (id: string, updates: Partial<CaptionVariant>) => void;
  onImprove: (request: ImproveRequest) => Promise<CaptionVariant | null>;
  onAddToPlan: (payload: { title: string; scheduledDate: string; platform: SocialPlatform; caption: string; clientId: string }) => void;
  onUseExample: (theme: string) => void;
}

const LIMITS: Record<string, number> = {
  instagram: 2200,
  facebook: 63206,
  linkedin: 3000,
  tiktok: 2200,
};

const EXAMPLES = ["Promozione weekend", "Presentazione prodotto", "Post motivazionale"];

export function CaptionResults({
  variants,
  bestVariantId,
  selectedPlatform,
  theme,
  clientId,
  brief,
  onUpdateVariant,
  onImprove,
  onAddToPlan,
  onUseExample,
}: CaptionResultsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [improvingId, setImprovingId] = useState<string | null>(null);
  const [planVariantId, setPlanVariantId] = useState<string | null>(null);

  const maxChars = LIMITS[selectedPlatform] ?? 2200;
  const strongest = useMemo(() => Math.max(...variants.map((variant) => variant.characterCount), 1), [variants]);

  if (variants.length === 0) {
    return (
      <div className="rounded-xl border border-card-border bg-card p-8 text-center">
        <Sparkles size={30} className="mx-auto text-violet-500 mb-3" />
        <p className="font-semibold">Configura il post e genera le tue caption</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {EXAMPLES.map((example) => (
            <button key={example} onClick={() => onUseExample(example)} className="px-3 py-1.5 rounded-full bg-violet-100 text-violet-700 text-xs font-medium">
              {example}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {variants.map((variant, index) => {
        const overLimit = variant.characterCount > maxChars;
        const warning = overLimit ? "text-rose-600" : variant.characterCount > maxChars * 0.8 ? "text-amber-600" : "text-emerald-600";
        const progress = Math.max(8, (variant.characterCount / strongest) * 100);

        return (
          <article key={variant.id} className="rounded-xl border border-card-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold flex items-center gap-2">
                Variante {index + 1}
                {bestVariantId === variant.id && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Migliore</span>
                )}
              </h3>
              <span className="text-xs px-2 py-1 rounded-full bg-violet-100 text-violet-700">{variant.tone}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {variant.notes}
              {variant.rankingReason ? ` · Ranking: ${variant.rankingReason}` : ""}
              {typeof variant.score === "number" ? ` · Score ${variant.score}/100` : ""}
            </p>
            <p className="mt-3 text-sm whitespace-pre-wrap">{variant.caption}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {variant.hashtags.map((hashtag) => (
                <span key={hashtag} className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">{hashtag}</span>
              ))}
            </div>
            <div className="mt-3">
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-violet-500" style={{ width: `${progress}%` }} />
              </div>
              <p className={`text-xs mt-1 font-medium ${warning}`}>
                {variant.characterCount}/{maxChars} caratteri
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={async () => {
                  const text = `${variant.caption}${variant.hashtags.length ? `\n\n${variant.hashtags.join(" ")}` : ""}`;
                  await navigator.clipboard.writeText(text.trim());
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-secondary text-secondary-foreground"
              >
                <Copy size={12} /> Copia
              </button>
              <button onClick={() => setEditingId(variant.id)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-secondary text-secondary-foreground">
                <Pencil size={12} /> Modifica
              </button>
              <button onClick={() => setImprovingId(variant.id)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-violet-100 text-violet-700">
                <Wand2 size={12} /> Migliora
              </button>
              <button onClick={() => setPlanVariantId(variant.id)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-emerald-100 text-emerald-700">
                <CalendarPlus size={12} /> Aggiungi al piano
              </button>
            </div>

            {editingId === variant.id && (
              <CaptionEditor
                initialCaption={variant.caption}
                initialHashtags={variant.hashtags}
                platform={selectedPlatform}
                onCancel={() => setEditingId(null)}
                onSave={(payload) => {
                  onUpdateVariant(variant.id, {
                    caption: payload.caption,
                    hashtags: payload.hashtags,
                    characterCount: payload.caption.length,
                  });
                  setEditingId(null);
                }}
              />
            )}

            {improvingId === variant.id && (
              <ImprovePanel
                caption={variant.caption}
                platform={selectedPlatform}
                brief={brief}
                onClose={() => setImprovingId(null)}
                onImprove={onImprove}
                onApply={(improved) => {
                  onUpdateVariant(variant.id, improved);
                  setImprovingId(null);
                }}
              />
            )}
          </article>
        );
      })}

      {planVariantId && (
        <AddToPlanModal
          open={Boolean(planVariantId)}
          onClose={() => setPlanVariantId(null)}
          initialTitle={theme || "Nuovo post"}
          platform={selectedPlatform}
          caption={variants.find((item) => item.id === planVariantId)?.caption ?? ""}
          clientId={clientId}
          onAdd={onAddToPlan}
        />
      )}
    </div>
  );
}
