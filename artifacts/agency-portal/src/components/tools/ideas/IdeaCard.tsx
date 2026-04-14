import { useMemo, useState } from "react";
import { Camera, Lightbulb, MessageSquareText, Trash2 } from "lucide-react";
import { useLocation } from "wouter";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { AddToPlanModal } from "@/components/tools/caption/AddToPlanModal";
import type { ContentIdea } from "@/types/content-ideas";
import type { SocialPlatform } from "@/types/client";

interface IdeaCardProps {
  idea: ContentIdea;
  clientId: string;
  onSaveIdea: (idea: ContentIdea) => void;
  onDiscard: (id: string) => void;
  onAddToPlan: (payload: { title: string; scheduledDate: string; platform: SocialPlatform; caption: string; clientId: string }) => void;
}

export function IdeaCard({ idea, clientId, onSaveIdea, onDiscard, onAddToPlan }: IdeaCardProps) {
  const [, setLocation] = useLocation();
  const [showCaptionDraft, setShowCaptionDraft] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const engagementClass = useMemo(() => {
    if (idea.estimatedEngagement === "high") return "bg-emerald-100 text-emerald-700";
    if (idea.estimatedEngagement === "low") return "bg-rose-100 text-rose-700";
    return "bg-amber-100 text-amber-700";
  }, [idea.estimatedEngagement]);

  const platform = (idea.platform || "instagram").toLowerCase() as SocialPlatform;
  const hashtagsPreview = idea.hashtags.slice(0, 5);
  const hashtagsOverflow = Math.max(0, idea.hashtags.length - hashtagsPreview.length);

  return (
    <article className="rounded-xl border border-card-border bg-card p-4 shadow-sm">
      <header className="mb-3 flex flex-wrap items-start gap-2">
        <h3 className="flex-1 text-base font-semibold">{idea.title}</h3>
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs">
          <PlatformIcon platform={platform} size="sm" />
          {idea.platform}
        </span>
        <span className="rounded-full bg-violet-100 px-2 py-1 text-xs text-violet-700">{idea.format}</span>
        <span className={`rounded-full px-2 py-1 text-xs ${engagementClass}`}>{idea.estimatedEngagement}</span>
      </header>

      <div className="mb-2 flex flex-wrap gap-1">
        {idea.tags.map((tag) => (
          <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {tag}
          </span>
        ))}
      </div>

      <p className="text-sm text-foreground/90">{idea.description}</p>

      <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-2 text-sm text-blue-900">
        <p className="text-xs font-semibold uppercase tracking-wide">Hook - prima frase</p>
        <p>{idea.hook}</p>
      </div>

      {idea.captionDraft && (
        <div className="mt-3">
          <button type="button" className="text-xs font-semibold text-violet-700" onClick={() => setShowCaptionDraft((prev) => !prev)}>
            {showCaptionDraft ? "Nascondi bozza caption" : "Mostra bozza caption"}
          </button>
          {showCaptionDraft && <p className="mt-1 whitespace-pre-wrap rounded-lg border border-border bg-muted/50 p-2 text-sm">{idea.captionDraft}</p>}
        </div>
      )}

      {idea.cta && (
        <div className="mt-2">
          <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">CTA: {idea.cta}</span>
        </div>
      )}

      <p className="mt-3 flex items-start gap-2 text-sm italic text-muted-foreground">
        <Camera size={14} className="mt-0.5 shrink-0" />
        {idea.visualSuggestion}
      </p>

      <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
        <Lightbulb size={14} className="mt-0.5 shrink-0" />
        Perché funziona: {idea.reasoning}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {hashtagsPreview.map((tag) => (
          <span key={tag} className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] text-sky-700">
            {tag}
          </span>
        ))}
        {hashtagsOverflow > 0 && (
          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] text-sky-700">+{hashtagsOverflow}</span>
        )}
      </div>

      <footer className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="rounded-lg bg-emerald-100 px-2.5 py-1.5 text-xs font-medium text-emerald-700" onClick={() => setPlanOpen(true)}>
          Aggiungi al piano
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg bg-violet-100 px-2.5 py-1.5 text-xs font-medium text-violet-700"
          onClick={() => {
            sessionStorage.setItem("agency_hub_caption_prefill", JSON.stringify({
              theme: idea.title,
              description: idea.description,
              platform: idea.platform,
              contentType: idea.format,
            }));
            setLocation("/tools/caption-ai");
          }}
        >
          <MessageSquareText size={12} />
          Genera caption completa
        </button>
        <button type="button" className="rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-medium text-secondary-foreground" onClick={() => onSaveIdea(idea)}>
          Salva idea
        </button>
        <button type="button" className="inline-flex items-center gap-1 rounded-lg bg-rose-100 px-2.5 py-1.5 text-xs font-medium text-rose-700" onClick={() => onDiscard(idea.id)}>
          <Trash2 size={12} />
          Scarta
        </button>
      </footer>

      <AddToPlanModal
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        initialTitle={idea.title}
        platform={platform}
        caption={idea.captionDraft || idea.description}
        clientId={clientId}
        onAdd={onAddToPlan}
      />
    </article>
  );
}
