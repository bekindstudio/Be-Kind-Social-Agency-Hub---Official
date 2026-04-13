import { useMemo, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { MetricCards } from "@/components/tools/analytics/MetricCards";
import { PerformanceChart } from "@/components/tools/analytics/PerformanceChart";
import { ContentPerformance } from "@/components/tools/analytics/ContentPerformance";
import { TopPosts } from "@/components/tools/analytics/TopPosts";
import { FollowerGrowth } from "@/components/tools/analytics/FollowerGrowth";
import { MetaConnectionBanner } from "@/components/shared/MetaConnectionBanner";
import { useClientContext } from "@/context/ClientContext";
import { useMetaAnalytics } from "@/hooks/useMetaAnalytics";
import type { AnalyticsPeriod } from "@/types/client";

function mapPeriodToLabel(period: AnalyticsPeriod): string {
  if (period === "7d") return "Ultimi 7gg";
  if (period === "90d") return "Ultimi 90gg";
  if (period === "custom") return "Personalizzato";
  return "Ultimi 30gg";
}

export default function AnalyticsPage() {
  const { activeClient, analytics, refreshAnalytics, setMetaAccountId } = useClientContext();
  const [period, setPeriod] = useState<AnalyticsPeriod>("30d");
  const [platform, setPlatform] = useState<"all" | "instagram" | "facebook">("all");
  const meta = useMetaAnalytics(activeClient?.id ?? "", period);

  const mergedDaily = useMemo(() => {
    if (meta.data?.daily?.length) {
      return meta.data.daily.map((point) => ({
        date: point.date,
        followers: point.followerCount,
        reach: point.reach,
        impressions: point.impressions,
        engagement: point.engagement ?? 0,
      }));
    }
    return analytics?.dailyData ?? [];
  }, [meta.data?.daily, analytics?.dailyData]);

  const mergedPosts = useMemo(() => {
    if (meta.posts.length > 0) return meta.posts;
    return (analytics?.topPosts ?? []).map((post) => ({
      id: post.id,
      caption: post.caption,
      mediaType: post.mediaType,
      timestamp: post.timestamp,
      likeCount: post.likeCount,
      commentsCount: post.commentsCount,
      reach: post.reach,
      impressions: 0,
      engagementRate: post.engagementRate,
      thumbnailUrl: post.thumbnailUrl,
    }));
  }, [meta.posts, analytics?.topPosts]);

  const contentPerformanceRows = useMemo(() => {
    const map = {
      "Post foto": { type: "Post foto" as const, reach: 0, engagement: 0, count: 0 },
      Carosello: { type: "Carosello" as const, reach: 0, engagement: 0, count: 0 },
      "Reel/Video": { type: "Reel/Video" as const, reach: 0, engagement: 0, count: 0 },
      Stories: { type: "Stories" as const, reach: 0, engagement: 0, count: 0 },
    };
    for (const post of mergedPosts) {
      const normalizedType =
        post.mediaType === "CAROUSEL_ALBUM"
          ? "Carosello"
          : post.mediaType === "VIDEO"
            ? "Reel/Video"
            : post.mediaType === "STORY"
              ? "Stories"
              : "Post foto";
      map[normalizedType].count += 1;
      map[normalizedType].reach += Number(post.reach ?? 0);
      map[normalizedType].engagement += Number(post.engagementRate ?? 0);
    }
    return (Object.values(map) as Array<{ type: "Post foto" | "Carosello" | "Reel/Video" | "Stories"; reach: number; engagement: number; count: number }>).map(
      (row) => ({
        ...row,
        engagement: row.count > 0 ? Number((row.engagement / row.count).toFixed(2)) : 0,
      }),
    );
  }, [mergedPosts]);

  const previousWindow = useMemo(() => {
    const split = Math.floor(mergedDaily.length / 2);
    const previous = mergedDaily.slice(0, split);
    const current = mergedDaily.slice(split);
    const sum = (arr: typeof mergedDaily, key: "reach" | "impressions" | "engagement" | "followers") =>
      arr.reduce((acc, item) => acc + Number(item[key] ?? 0), 0);
    const avg = (arr: typeof mergedDaily, key: "engagement") => (arr.length ? sum(arr, key) / arr.length : 0);
    return {
      followers: current.at(-1)?.followers ?? analytics?.followers ?? 0,
      followersPrevious: previous.at(-1)?.followers ?? analytics?.followersPrevious ?? 0,
      reach: sum(current, "reach") || analytics?.reach || 0,
      reachPrevious: sum(previous, "reach") || analytics?.reachPrevious || 0,
      engagement: avg(current, "engagement") || analytics?.engagementRate || 0,
      engagementPrevious: avg(previous, "engagement") || analytics?.engagementRatePrevious || 0,
      posts: mergedPosts.length || analytics?.postsPublished || 0,
      postsPrevious: Math.max(0, Math.round((mergedPosts.length || analytics?.postsPublished || 0) * 0.8)),
    };
  }, [mergedDaily, mergedPosts.length, analytics]);

  const syncAll = async () => {
    await meta.sync();
    await refreshAnalytics(period);
    if (analytics?.accountId) {
      setMetaAccountId(analytics.accountId);
    }
  };

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
            <p className="text-sm text-muted-foreground">
              {activeClient ? `Cliente attivo: ${activeClient.name}` : "Seleziona un cliente per visualizzare analytics"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={period} onChange={(e) => setPeriod(e.target.value as AnalyticsPeriod)} className="px-3 py-2 rounded-lg border border-input bg-background text-sm">
              <option value="7d">Ultimi 7gg</option>
              <option value="30d">Ultimi 30gg</option>
              <option value="90d">Ultimi 90gg</option>
              <option value="custom">Personalizzato</option>
            </select>
            <select value={platform} onChange={(e) => setPlatform(e.target.value as "all" | "instagram" | "facebook")} className="px-3 py-2 rounded-lg border border-input bg-background text-sm">
              <option value="all">Tutte</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
            </select>
            <button onClick={syncAll} disabled={meta.isLoading} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60">
              {meta.isLoading ? "Sincronizzazione..." : "Sincronizza dati"}
            </button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Aggiornato il {meta.lastSyncAt ? new Date(meta.lastSyncAt).toLocaleDateString("it-IT", { day: "2-digit", month: "short" }) : "--"} ·{" "}
          {meta.lastSyncAt ? new Date(meta.lastSyncAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : "--"} · {mapPeriodToLabel(period)} ·{" "}
          {platform === "all" ? "Tutte le piattaforme" : platform}
        </p>

        <MetaConnectionBanner error={meta.error} isStale={meta.isStale} lastSyncAt={meta.lastSyncAt} onSync={syncAll} syncing={meta.isLoading} />

        {meta.isLoading && mergedDaily.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="h-24 rounded-xl bg-[var(--color-background-secondary)] animate-pulse opacity-70" />
            ))}
          </div>
        ) : (
          <MetricCards
            followers={previousWindow.followers}
            followersPrevious={previousWindow.followersPrevious}
            reach={previousWindow.reach}
            reachPrevious={previousWindow.reachPrevious}
            engagementRate={previousWindow.engagement}
            engagementRatePrevious={previousWindow.engagementPrevious}
            postsPublished={previousWindow.posts}
            postsPublishedPrevious={previousWindow.postsPrevious}
            industry={activeClient?.industry}
          />
        )}

        <PerformanceChart data={mergedDaily} />
        <ContentPerformance rows={contentPerformanceRows} />
        <TopPosts posts={mergedPosts} />
        <FollowerGrowth points={mergedDaily.map((row) => ({ date: row.date, followers: row.followers }))} />
      </div>
    </Layout>
  );
}
