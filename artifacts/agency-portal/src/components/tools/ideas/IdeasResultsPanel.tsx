import { useMemo, useState } from "react";
import type { ContentIdea } from "@/types/content-ideas";
import type { SocialPlatform } from "@/types/client";
import { IdeaCard } from "@/components/tools/ideas/IdeaCard";

interface IdeasResultsPanelProps {
  ideas: ContentIdea[];
  clientName: string;
  period: string;
  isLoading: boolean;
  clientId: string;
  onSaveIdea: (idea: ContentIdea) => void;
  onDiscardIdea: (id: string) => void;
  onRegenerate: () => void;
  onAddAllToPlan: (ideas: ContentIdea[]) => void;
  onAddToPlan: (payload: { title: string; scheduledDate: string; platform: SocialPlatform; caption: string; clientId: string }) => void;
}

export function IdeasResultsPanel({
  ideas,
  clientName,
  period,
  isLoading,
  clientId,
  onSaveIdea,
  onDiscardIdea,
  onRegenerate,
  onAddAllToPlan,
  onAddToPlan,
}: IdeasResultsPanelProps) {
  const [platformFilter, setPlatformFilter] = useState("all");
  const [formatFilter, setFormatFilter] = useState("all");
  const [engagementFilter, setEngagementFilter] = useState("all");

  const filteredIdeas = useMemo(() => {
    return ideas.filter((idea) => {
      if (platformFilter !== "all" && idea.platform.toLowerCase() !== platformFilter) return false;
      if (formatFilter !== "all" && idea.format !== formatFilter) return false;
      if (engagementFilter !== "all" && idea.estimatedEngagement !== engagementFilter) return false;
      return true;
    });
  }, [engagementFilter, formatFilter, ideas, platformFilter]);

  const platformOptions = useMemo(() => Array.from(new Set(ideas.map((idea) => idea.platform.toLowerCase()))), [ideas]);
  const formatOptions = useMemo(() => Array.from(new Set(ideas.map((idea) => idea.format))), [ideas]);

  return (
    <section className="space-y-3">
      <header className="rounded-xl border border-card-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold">
            {ideas.length} idee generate per {clientName} - {period}
          </h2>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button type="button" className="rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-medium text-secondary-foreground" onClick={onRegenerate}>
              Rigenera
            </button>
            <button type="button" className="rounded-lg bg-emerald-100 px-2.5 py-1.5 text-xs font-medium text-emerald-700" onClick={() => onAddAllToPlan(filteredIdeas)}>
              Aggiungi tutte al piano
            </button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          <select className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs" value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}>
            <option value="all">Tutte le piattaforme</option>
            {platformOptions.map((platform) => (
              <option key={platform} value={platform}>
                {platform}
              </option>
            ))}
          </select>
          <select className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs" value={formatFilter} onChange={(e) => setFormatFilter(e.target.value)}>
            <option value="all">Tutti i formati</option>
            {formatOptions.map((format) => (
              <option key={format} value={format}>
                {format}
              </option>
            ))}
          </select>
          <select className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs" value={engagementFilter} onChange={(e) => setEngagementFilter(e.target.value)}>
            <option value="all">Tutti engagement</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </header>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-48 animate-pulse rounded-xl border border-card-border bg-muted/40" />
          ))}
        </div>
      )}

      {!isLoading && ideas.length === 0 && (
        <div className="rounded-xl border border-dashed border-card-border bg-card p-8 text-center text-sm text-muted-foreground">
          <svg className="mx-auto mb-3" width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
            <rect x="8" y="10" width="56" height="52" rx="10" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.35" />
            <path d="M20 25h32M20 34h24M20 43h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          </svg>
          Configura e genera le tue idee
        </div>
      )}

      {!isLoading && filteredIdeas.map((idea) => (
        <IdeaCard
          key={idea.id}
          idea={idea}
          clientId={clientId}
          onSaveIdea={onSaveIdea}
          onDiscard={onDiscardIdea}
          onAddToPlan={onAddToPlan}
        />
      ))}
    </section>
  );
}
