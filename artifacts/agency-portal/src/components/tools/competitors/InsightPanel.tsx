import { useMemo, useState } from "react";
import type { ClientAnalytics, Competitor } from "@/types/client";

export interface Insight {
  type: "warning" | "opportunity" | "info";
  title: string;
  description: string;
  metric?: string;
}

const INSIGHT_STORAGE_KEY = "competitor_insights_hidden";

function readHiddenIds(): string[] {
  try {
    const raw = localStorage.getItem(INSIGHT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeHiddenIds(ids: string[]) {
  localStorage.setItem(INSIGHT_STORAGE_KEY, JSON.stringify(ids));
}

function emojiIcon(type: Insight["type"]) {
  if (type === "warning") return "⚠";
  if (type === "opportunity") return "💡";
  return "ℹ";
}

function insightColor(type: Insight["type"]) {
  if (type === "warning") return "bg-amber-50 border-amber-200";
  if (type === "opportunity") return "bg-emerald-50 border-emerald-200";
  return "bg-sky-50 border-sky-200";
}

export function generateInsights(clientAnalytics: ClientAnalytics | null, competitors: Competitor[]): Insight[] {
  const insights: Insight[] = [];
  if (competitors.length === 0) {
    insights.push({
      type: "info",
      title: "Dati competitor insufficienti",
      description: "Aggiungi almeno un competitor per avviare i confronti automatici.",
    });
    return insights;
  }

  const avgEngagement = competitors.reduce((sum, c) => sum + c.engagementRate, 0) / competitors.length;
  const avgPosts = competitors.reduce((sum, c) => sum + c.postsPerWeek, 0) / competitors.length;
  const maxPostsCompetitor = competitors.reduce((best, c) => (c.postsPerWeek > best.postsPerWeek ? c : best), competitors[0]);
  const clientEngagement = clientAnalytics?.engagementRate ?? 0;
  const clientPostsPerWeek = clientAnalytics ? clientAnalytics.postsPublished / 4 : 0;
  const clientFollowers = clientAnalytics?.followers ?? 0;
  const maxCompetitorFollowers = Math.max(...competitors.map((c) => c.followers));

  if (clientAnalytics && clientEngagement < avgEngagement) {
    insights.push({
      type: "warning",
      title: "Engagement sotto la media competitor",
      description: `I competitor hanno in media ${avgEngagement.toFixed(2)}% vs cliente ${clientEngagement.toFixed(2)}%.`,
      metric: "engagement",
    });
  }

  if (clientAnalytics && maxPostsCompetitor.postsPerWeek >= clientPostsPerWeek * 2 && clientPostsPerWeek > 0) {
    insights.push({
      type: "opportunity",
      title: "Frequenza di pubblicazione migliorabile",
      description: `${maxPostsCompetitor.name} pubblica ${maxPostsCompetitor.postsPerWeek.toFixed(1)} post/settimana: valuta incremento della frequenza editoriale.`,
      metric: "post_frequency",
    });
  }

  const notesMentionVideo = competitors.every((c) => {
    const text = `${c.notes ?? ""} ${c.topContent ?? ""} ${c.observedStrategy ?? ""}`.toLowerCase();
    return text.includes("video") || text.includes("reel");
  });
  if (notesMentionVideo) {
    insights.push({
      type: "info",
      title: "Formato video dominante",
      description: "Nei competitor analizzati il formato video/reel risulta ricorrente: integralo nel piano editoriale.",
      metric: "content_format",
    });
  }

  if (clientAnalytics && clientFollowers > maxCompetitorFollowers) {
    insights.push({
      type: "info",
      title: "Cliente leader per follower",
      description: "Il cliente risulta il brand con piu follower nel confronto. Focus su mantenimento e qualità engagement.",
      metric: "followers",
    });
  }

  insights.push({
    type: "opportunity",
    title: "Benchmark frequenza media",
    description: `Media competitor: ${avgPosts.toFixed(1)} post/settimana. Usa questo dato per calibrare roadmap contenuti.`,
    metric: "benchmark",
  });

  return insights;
}

interface InsightPanelProps {
  clientId: string;
  clientAnalytics: ClientAnalytics | null;
  competitors: Competitor[];
}

export function InsightPanel({ clientId, clientAnalytics, competitors }: InsightPanelProps) {
  const [hidden, setHidden] = useState<string[]>(() => readHiddenIds());
  const insights = useMemo(() => generateInsights(clientAnalytics, competitors), [clientAnalytics, competitors]);
  const visible = insights.filter((insight, idx) => !hidden.includes(`${clientId}:${idx}:${insight.title}`));

  const dismiss = (id: string) => {
    const next = [...hidden, id];
    setHidden(next);
    writeHiddenIds(next);
  };

  return (
    <div className="space-y-2">
      {visible.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
          Nessun nuovo insight disponibile.
        </div>
      )}
      {visible.map((insight, idx) => {
        const id = `${clientId}:${idx}:${insight.title}`;
        return (
          <div key={id} className={`rounded-lg border p-3 ${insightColor(insight.type)}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{emojiIcon(insight.type)} {insight.title}</p>
                <p className="text-sm mt-1 text-foreground/80">{insight.description}</p>
              </div>
              <button onClick={() => dismiss(id)} className="text-xs text-muted-foreground hover:text-foreground">
                Nascondi
              </button>
            </div>
          </div>
        );
      })}
      {/* TODO: Replace deterministic insight rules with Claude API generated insights. */}
    </div>
  );
}
