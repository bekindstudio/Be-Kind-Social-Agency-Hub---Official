import type { ClientAnalytics } from "@/types/client";
import type { SavedReport } from "@/components/tools/reports/ReportHistory";

export interface ReportHistoryApiRow {
  id: number | string;
  clientId: number | string;
  period?: string | null;
  periodLabel?: string | null;
  createdAt?: string | null;
  noteAggiuntive?: string | null;
  strategiaProssimoPeriodo?: string | null;
  riepilogoEsecutivo?: string | null;
  analisiInsights?: string | null;
}

export function monthLabel(value: string): string {
  const [year, month] = value.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
}

export function toSavedReport(row: ReportHistoryApiRow): SavedReport {
  const sections: string[] = [];
  if (row.riepilogoEsecutivo) sections.push("overview");
  if (row.analisiInsights) sections.push("performance");
  if (row.strategiaProssimoPeriodo) sections.push("nextPlan");
  if (row.noteAggiuntive) sections.push("strategicNotes");

  return {
    id: String(row.id),
    clientId: String(row.clientId),
    period: row.periodLabel ?? row.period ?? "Report",
    generatedAt: row.createdAt ?? new Date().toISOString(),
    sections: sections.length > 0 ? sections : ["overview"],
    notes: row.noteAggiuntive ?? row.strategiaProssimoPeriodo ?? "",
  };
}

export function mapPayloadToAnalytics(
  payload: any,
  activeClientId: string | undefined,
): ClientAnalytics | null {
  const ig = payload?.instagram;
  if (!ig?.summary) return null;
  const summary = ig.summary;
  const labels: string[] = Array.isArray(ig.followerTrend?.labels) ? ig.followerTrend.labels : [];
  const data: number[] = Array.isArray(ig.followerTrend?.data) ? ig.followerTrend.data : [];
  const reachTotal = Number(summary.reach ?? 0);
  const impressionsTotal = Number(summary.impressions ?? 0);
  const dailyData = labels.map((label, index) => ({
    date: label,
    followers: Number(data[index] ?? summary.followers ?? 0),
    reach: Math.round(reachTotal / Math.max(1, labels.length || 1)),
    impressions: Math.round(impressionsTotal / Math.max(1, labels.length || 1)),
    engagement: Number(summary.engagementRate ?? 0),
  }));
  const topPosts = (ig.topPosts ?? []).map((post: any, index: number) => ({
    id: String(post.id ?? `report-post-${index}`),
    caption: String(post.caption ?? post.description ?? ""),
    mediaType: String(post.mediaType ?? post.type ?? "IMAGE"),
    timestamp: String(post.timestamp ?? post.date ?? new Date().toISOString()),
    likeCount: Number(post.likeCount ?? post.likes ?? 0),
    commentsCount: Number(post.commentsCount ?? post.comments ?? 0),
    reach: Number(post.reach ?? 0),
    engagementRate: Number(post.engagementRate ?? post.engagement ?? 0),
    thumbnailUrl: post.thumbnailUrl,
  }));
  return {
    clientId: activeClientId ?? "",
    period: "report",
    followers: Number(summary.followers ?? 0),
    followersPrevious: Math.max(0, Number(summary.followers ?? 0) - Number(summary.followerGrowth ?? 0)),
    followersGrowth: Number(summary.followerGrowthPct ?? 0),
    reach: reachTotal,
    reachPrevious: 0,
    impressions: impressionsTotal,
    engagementRate: Number(summary.engagementRate ?? 0),
    engagementRatePrevious: 0,
    postsPublished: topPosts.length,
    profileViews: Number(summary.profileViews ?? 0),
    dailyData,
    topPosts,
    updatedAt: new Date().toISOString(),
  };
}

export function buildFallbackMetrics(effectiveAnalytics: ClientAnalytics | null) {
  return {
    mock: true,
    instagram: {
      summary: {
        followers: effectiveAnalytics?.followers ?? 0,
        followerGrowth: effectiveAnalytics?.followersGrowth ?? 0,
        reach: effectiveAnalytics?.reach ?? 0,
        impressions: effectiveAnalytics?.impressions ?? 0,
        engagementRate: effectiveAnalytics?.engagementRate ?? 0,
        profileViews: effectiveAnalytics?.profileViews ?? 0,
      },
      topPosts: (effectiveAnalytics?.topPosts ?? []).map((post) => ({
        id: post.id,
        caption: post.caption,
        mediaType: post.mediaType,
        timestamp: post.timestamp,
        likes: post.likeCount,
        comments: post.commentsCount,
        reach: post.reach,
        impressions: 0,
        engagementRate: post.engagementRate,
      })),
    },
    metaAds: null,
  };
}
