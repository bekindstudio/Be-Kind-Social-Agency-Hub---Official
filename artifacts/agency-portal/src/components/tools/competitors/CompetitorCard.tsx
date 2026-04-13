import { useMemo, useState } from "react";
import { ExternalLink, Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { MetricsUpdateForm } from "@/components/tools/competitors/MetricsUpdateForm";
import { useClientContext } from "@/context/ClientContext";
import type { Competitor } from "@/types/client";

interface CompetitorCardProps {
  competitor: Competitor;
  clientEngagementRate: number;
  onEdit: (competitor: Competitor) => void;
  onDelete: (competitor: Competitor) => void;
}

function avatarColor(name: string): string {
  const hue = name.charCodeAt(0) * 137 % 360;
  return `hsl(${hue}, 60%, 45%)`;
}

function initials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "C";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function TagEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const text = draft.trim();
    if (!text) return;
    if (!value.includes(text)) onChange([...value, text]);
    setDraft("");
  };
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {value.map((tag) => (
          <button key={tag} onClick={() => onChange(value.filter((t) => t !== tag))} className="text-[11px] rounded-full bg-muted px-2 py-0.5 hover:bg-muted/70">
            {tag} ×
          </button>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="flex-1 px-2.5 py-1.5 text-xs border border-input rounded bg-background"
        />
        <button onClick={add} className="px-2.5 py-1.5 text-xs rounded bg-muted hover:bg-muted/80">Aggiungi</button>
      </div>
    </div>
  );
}

export function CompetitorCard({ competitor, clientEngagementRate, onEdit, onDelete }: CompetitorCardProps) {
  const { updateCompetitor } = useClientContext();
  const [showDetails, setShowDetails] = useState(false);
  const [showMetricsForm, setShowMetricsForm] = useState(false);
  const followerDelta = useMemo(() => {
    if (competitor.followersPrevious == null || competitor.followersPrevious <= 0) return null;
    return ((competitor.followers - competitor.followersPrevious) / competitor.followersPrevious) * 100;
  }, [competitor.followers, competitor.followersPrevious]);
  const engagementVsClient = competitor.engagementRate - clientEngagementRate;
  const latestUpdate = competitor.updateHistory?.[competitor.updateHistory.length - 1]?.date ?? competitor.updatedAt;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div
          className="h-10 w-10 rounded-full text-white flex items-center justify-center text-xs font-bold shrink-0"
          style={{ backgroundColor: avatarColor(competitor.name) }}
        >
          {initials(competitor.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm truncate">{competitor.name}</p>
            {competitor.isPrimary && <span className="text-[10px] rounded-full bg-amber-100 text-amber-800 px-2 py-0.5">Principale</span>}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <PlatformIcon platform={competitor.platform} size="sm" />
            <span className="uppercase">{competitor.platform}</span>
            {competitor.profileUrl && (
              <a href={competitor.profileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-primary">
                Profilo <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-muted/40 p-2">
          <p className="text-muted-foreground">Follower</p>
          <p className="font-semibold">{competitor.followers.toLocaleString("it-IT")}</p>
          {followerDelta != null && (
            <p className={followerDelta >= 0 ? "text-emerald-600" : "text-red-600"}>
              {followerDelta >= 0 ? "+" : ""}{followerDelta.toFixed(1)}%
            </p>
          )}
        </div>
        <div className="rounded-lg bg-muted/40 p-2">
          <p className="text-muted-foreground">Engagement</p>
          <p className="font-semibold">{competitor.engagementRate.toFixed(1)}%</p>
          <p className={engagementVsClient >= 0 ? "text-emerald-600" : "text-red-600"}>
            {engagementVsClient >= 0 ? "↑" : "↓"} vs cliente
          </p>
        </div>
        <div className="rounded-lg bg-muted/40 p-2">
          <p className="text-muted-foreground">Post/settimana</p>
          <p className="font-semibold">{competitor.postsPerWeek.toFixed(1)}</p>
        </div>
        <div className="rounded-lg bg-muted/40 p-2">
          <p className="text-muted-foreground">Ultimo update</p>
          <p className="font-semibold">{new Date(latestUpdate).toLocaleDateString("it-IT")}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <button onClick={() => setShowMetricsForm((prev) => !prev)} className="text-xs px-2.5 py-1 rounded-lg border border-border hover:bg-muted">Aggiorna metriche</button>
        <button onClick={() => onEdit(competitor)} className="text-xs px-2.5 py-1 rounded-lg border border-border hover:bg-muted inline-flex items-center gap-1"><Pencil size={12} /> Modifica</button>
        <button onClick={() => onDelete(competitor)} className="text-xs px-2.5 py-1 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 inline-flex items-center gap-1"><Trash2 size={12} /> Elimina</button>
        <button onClick={() => setShowDetails((prev) => !prev)} className="ml-auto text-xs px-2.5 py-1 rounded-lg border border-border hover:bg-muted inline-flex items-center gap-1">
          Analisi dettagliata {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {showMetricsForm && (
        <div className="mt-3">
          <MetricsUpdateForm competitor={competitor} onClose={() => setShowMetricsForm(false)} />
        </div>
      )}

      {showDetails && (
        <div className="mt-3 space-y-2">
          <div>
            <label className="text-[11px] text-muted-foreground">Top contenuti</label>
            <textarea
              value={competitor.topContent ?? ""}
              onChange={(e) => updateCompetitor(competitor.id, { topContent: e.target.value })}
              rows={2}
              className="mt-1 w-full px-2.5 py-2 text-xs border border-input rounded bg-background resize-none"
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Strategia osservata</label>
            <textarea
              value={competitor.observedStrategy ?? ""}
              onChange={(e) => updateCompetitor(competitor.id, { observedStrategy: e.target.value })}
              rows={2}
              className="mt-1 w-full px-2.5 py-2 text-xs border border-input rounded bg-background resize-none"
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Punti di forza</label>
            <TagEditor value={competitor.strengths ?? []} onChange={(next) => updateCompetitor(competitor.id, { strengths: next })} placeholder="Aggiungi punto di forza" />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Punti deboli</label>
            <TagEditor value={competitor.weaknesses ?? []} onChange={(next) => updateCompetitor(competitor.id, { weaknesses: next })} placeholder="Aggiungi punto debole" />
          </div>
        </div>
      )}
    </div>
  );
}
