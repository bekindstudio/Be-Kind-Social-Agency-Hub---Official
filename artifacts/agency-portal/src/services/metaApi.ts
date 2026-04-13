export type MetaApiErrorCode = "TOKEN_EXPIRED" | "INSUFFICIENT_PERMISSIONS" | "RATE_LIMIT" | "UNKNOWN";

export interface InsightParams {
  period?: "day" | "week" | "month";
  since?: string;
  until?: string;
}

export interface PostParams {
  since?: string;
  until?: string;
  limit?: string;
}

export interface MetaInsightData {
  date: string;
  impressions: number;
  reach: number;
  followerCount: number;
  profileViews: number;
  engagement?: number;
}

export interface MetaPostData {
  id: string;
  caption: string;
  mediaType: string;
  timestamp: string;
  likeCount: number;
  commentsCount: number;
  reach: number;
  impressions: number;
  engagementRate: number;
  thumbnailUrl?: string;
}

export type MetaApiError = {
  error: MetaApiErrorCode;
  retryAfter?: number;
  message?: string;
};

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

async function readJson<T>(request: Promise<Response>): Promise<T> {
  const response = await request;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw payload;
  }
  return payload as T;
}

export const metaApi = {
  getAccounts: () => readJson<any[]>(fetch(`${BASE_URL}/api/meta/accounts`, { credentials: "include" })),

  getInsights: (accountId: string, params: InsightParams) =>
    readJson<MetaInsightData[]>(
      fetch(`${BASE_URL}/api/meta/insights/${accountId}?${new URLSearchParams(params as Record<string, string>).toString()}`, {
        credentials: "include",
      }),
    ),

  getPosts: (accountId: string, params: PostParams) =>
    readJson<MetaPostData[]>(
      fetch(`${BASE_URL}/api/meta/posts/${accountId}?${new URLSearchParams(params as Record<string, string>).toString()}`, {
        credentials: "include",
      }),
    ),

  exchangeToken: (accessToken: string) =>
    readJson<{ success: true; expiresAt: string }>(
      fetch(`${BASE_URL}/api/meta/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ accessToken }),
      }),
    ),
};
