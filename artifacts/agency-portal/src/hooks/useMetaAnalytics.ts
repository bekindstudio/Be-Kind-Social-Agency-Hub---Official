import { useCallback, useEffect, useMemo, useState } from "react";
import type { AnalyticsPeriod } from "@/types/client";
import { metaApi, type MetaApiError, type MetaInsightData, type MetaPostData } from "@/services/metaApi";

export interface AnalyticsData {
  daily: MetaInsightData[];
}

interface CachePayload {
  updatedAt: string;
  data: AnalyticsData | null;
  posts: MetaPostData[];
  lastSyncAt: string | null;
}

export interface UseMetaAnalyticsReturn {
  data: AnalyticsData | null;
  posts: MetaPostData[];
  isLoading: boolean;
  error: MetaApiError | null;
  sync: () => Promise<void>;
  lastSyncAt: string | null;
  isStale: boolean;
}

const TTL_MS = 60 * 60 * 1000;

function getCacheKey(clientId: string, period: AnalyticsPeriod): string {
  return `meta_cache_${clientId}_${period}`;
}

function buildRange(period: AnalyticsPeriod): { since: string; until: string; period: "day" | "week" | "month" } {
  const until = new Date();
  const since = new Date();
  const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
  since.setDate(until.getDate() - (days - 1));
  return {
    since: since.toISOString().slice(0, 10),
    until: until.toISOString().slice(0, 10),
    period: days <= 7 ? "day" : "month",
  };
}

function normalizeError(err: unknown): MetaApiError {
  const casted = (err ?? {}) as Record<string, any>;
  return {
    error: casted.error ?? "UNKNOWN",
    retryAfter: casted.retryAfter ? Number(casted.retryAfter) : undefined,
    message: casted.message ?? casted.error_description ?? "Unknown error",
  };
}

export function useMetaAnalytics(clientId: string, period: AnalyticsPeriod): UseMetaAnalyticsReturn {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [posts, setPosts] = useState<MetaPostData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<MetaApiError | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const cacheKey = useMemo(() => getCacheKey(clientId, period), [clientId, period]);

  const readCache = useCallback((): CachePayload | null => {
    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) return null;
      return JSON.parse(raw) as CachePayload;
    } catch {
      return null;
    }
  }, [cacheKey]);

  const writeCache = useCallback(
    (payload: CachePayload) => {
      localStorage.setItem(cacheKey, JSON.stringify(payload));
    },
    [cacheKey],
  );

  const sync = useCallback(async () => {
    if (!clientId) return;
    setIsLoading(true);
    setError(null);
    try {
      const range = buildRange(period);
      const numericClientId = Number(clientId);
      let insights: MetaInsightData[] = [];
      let topPosts: MetaPostData[] = [];

      if (Number.isFinite(numericClientId) && numericClientId > 0) {
        const params = new URLSearchParams({
          range: period === "7d" ? "7d" : period === "90d" ? "90d" : "30d",
          since: range.since,
          until: range.until,
          sync: "true",
        });

        // Best effort sync with assigned Meta accounts before loading report/analytics data.
        await fetch(`/api/meta/sync/${numericClientId}?since=${range.since}&until=${range.until}`, {
          method: "POST",
          credentials: "include",
        }).catch(() => null);

        const response = await fetch(`/api/meta/insights/${numericClientId}?${params.toString()}`, {
          credentials: "include",
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw payload;

        const instagram = (payload as any)?.instagram ?? {};
        const summary = instagram.summary ?? {};
        const followerTrend = instagram.followerTrend ?? { data: [] };
        const trendData = Array.isArray(followerTrend.data) ? followerTrend.data : [];
        const trendLen = trendData.length || 1;
        const sinceDate = new Date(range.since);

        insights = trendData.map((followers: number, index: number) => {
          const d = new Date(sinceDate);
          d.setDate(d.getDate() + index);
          return {
            date: d.toISOString().slice(0, 10),
            impressions: Math.round(Number(summary.impressions ?? 0) / trendLen),
            reach: Math.round(Number(summary.reach ?? 0) / trendLen),
            followerCount: Number(followers ?? 0),
            profileViews: Math.round(Number(summary.profileViews ?? 0) / trendLen),
            engagement: Number(summary.engagementRate ?? 0),
          };
        });

        const rawPosts = Array.isArray(instagram.topPosts) ? instagram.topPosts : [];
        topPosts = rawPosts.map((post: any) => ({
          id: String(post.id ?? crypto.randomUUID()),
          caption: String(post.caption ?? post.description ?? ""),
          mediaType: String(post.mediaType ?? "IMAGE"),
          timestamp: String(post.timestamp ?? new Date().toISOString()),
          likeCount: Number(post.likes ?? post.likeCount ?? 0),
          commentsCount: Number(post.comments ?? post.commentsCount ?? 0),
          reach: Number(post.reach ?? 0),
          impressions: Number(post.impressions ?? 0),
          engagementRate: Number(post.engagementRate ?? post.engagement ?? 0),
          thumbnailUrl: typeof post.thumbnailUrl === "string" ? post.thumbnailUrl : undefined,
        }));
      } else {
        const accounts = await metaApi.getAccounts();
        const account = accounts[0];
        if (!account?.id) {
          const noAccountError: MetaApiError = { error: "UNKNOWN", message: "No linked Meta account" };
          setError(noAccountError);
          setData(null);
          setPosts([]);
          return;
        }
        [insights, topPosts] = await Promise.all([
          metaApi.getInsights(String(account.id), range),
          metaApi.getPosts(String(account.id), { since: range.since, until: range.until, limit: "30" }),
        ]);
      }

      const syncAt = new Date().toISOString();
      setData({ daily: insights });
      setPosts(topPosts);
      setLastSyncAt(syncAt);
      writeCache({
        updatedAt: syncAt,
        data: { daily: insights },
        posts: topPosts,
        lastSyncAt: syncAt,
      });
    } catch (err) {
      const normalized = normalizeError(err);
      setError(normalized);
      if (normalized.error === "RATE_LIMIT" && normalized.retryAfter) {
        await new Promise((resolve) => setTimeout(resolve, normalized.retryAfter! * 1000));
        setIsLoading(false);
        await sync();
        return;
      }
    } finally {
      setIsLoading(false);
    }
  }, [clientId, period, writeCache]);

  useEffect(() => {
    const cached = readCache();
    if (cached) {
      setData(cached.data);
      setPosts(cached.posts ?? []);
      setLastSyncAt(cached.lastSyncAt ?? cached.updatedAt);
      const age = Date.now() - new Date(cached.updatedAt).getTime();
      if (age > TTL_MS) {
        void sync();
      }
      return;
    }
    void sync();
  }, [readCache, sync]);

  const isStale = useMemo(() => {
    if (!lastSyncAt) return true;
    return Date.now() - new Date(lastSyncAt).getTime() > TTL_MS;
  }, [lastSyncAt]);

  return { data, posts, isLoading, error, sync, lastSyncAt, isStale };
}
