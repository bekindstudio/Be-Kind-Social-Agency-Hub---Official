import { useCallback, useMemo, useState } from "react";
import { portalFetch } from "@workspace/api-client-react";

export interface CaptionRequest {
  clientId: string;
  brief: {
    toneOfVoice: string;
    brandVoice: string[];
    targetAudience: string;
    objectives: string;
    doNotSay: string;
    hashtags: string[];
  };
  postDetails: {
    theme: string;
    contentType: string;
    objective: string;
    platform: "instagram" | "facebook" | "linkedin" | "tiktok";
    additionalNotes?: string;
    keywords?: string[];
  };
  options: {
    length: "short" | "medium" | "long";
    includeHashtags: boolean;
    includeEmoji: boolean;
    language: "italian" | "english";
    variants: number;
  };
}

export interface ImproveRequest {
  originalCaption: string;
  instruction: string;
  platform: "instagram" | "facebook" | "linkedin" | "tiktok";
  brief: CaptionRequest["brief"];
}

export interface CaptionVariant {
  id: string;
  caption: string;
  hashtags: string[];
  characterCount: number;
  platform: string;
  tone: string;
  notes: string;
  score?: number;
  rankingReason?: string;
}

export interface HashtagParams {
  theme: string;
  industry: string;
  platform: "instagram" | "facebook" | "linkedin" | "tiktok";
  count?: number;
}

export interface HashtagResult {
  hashtags: string[];
  categories: Record<string, string[]>;
}

export interface CaptionHistoryItem {
  id: string;
  clientId: string;
  generatedAt: string;
  request: CaptionRequest;
  variants: CaptionVariant[];
  tokensUsed: number;
  bestVariantId?: string | null;
}

interface UseCaptionAiReturn {
  generate: (request: CaptionRequest) => Promise<void>;
  improve: (request: ImproveRequest) => Promise<CaptionVariant | null>;
  generateHashtags: (params: HashtagParams) => Promise<HashtagResult | null>;
  variants: CaptionVariant[];
  isLoading: boolean;
  error: string | null;
  clearVariants: () => void;
  replaceVariants: (nextVariants: CaptionVariant[]) => void;
  tokensUsed: number;
  generationsToday: number;
  bestVariantId: string | null;
}

function historyKey(clientId: string): string {
  return `agency_hub_captions_${clientId}`;
}

function readHistory(clientId: string): CaptionHistoryItem[] {
  if (!clientId) return [];
  try {
    const raw = localStorage.getItem(historyKey(clientId));
    if (!raw) return [];
    return JSON.parse(raw) as CaptionHistoryItem[];
  } catch {
    return [];
  }
}

function writeHistory(clientId: string, items: CaptionHistoryItem[]): void {
  if (!clientId) return;
  localStorage.setItem(historyKey(clientId), JSON.stringify(items.slice(0, 50)));
}

function mapError(errorCode?: string): string {
  if (errorCode === "AI_ERROR") return "Errore nella generazione - riprova tra un momento";
  if (errorCode === "PARSE_ERROR") return "Risposta non valida - riprova";
  return "Controlla la connessione";
}

export function getCaptionHistory(clientId: string): CaptionHistoryItem[] {
  return readHistory(clientId);
}

export async function fetchCaptionHistory(clientId: string): Promise<CaptionHistoryItem[]> {
  if (!clientId) return [];
  try {
    const response = await portalFetch(`/api/ai/caption/history/${encodeURIComponent(clientId)}?limit=50`);
    const payload = await response.json();
    if (!response.ok || !Array.isArray(payload)) {
      return readHistory(clientId);
    }
    writeHistory(clientId, payload as CaptionHistoryItem[]);
    return payload as CaptionHistoryItem[];
  } catch {
    return readHistory(clientId);
  }
}

export function useCaptionAi(clientId: string): UseCaptionAiReturn {
  const [variants, setVariants] = useState<CaptionVariant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokensUsed, setTokensUsed] = useState(0);
  const [bestVariantId, setBestVariantId] = useState<string | null>(null);

  const generationsToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return readHistory(clientId).filter((item) => item.generatedAt.slice(0, 10) === today).length;
  }, [clientId, variants.length]);

  const clearVariants = useCallback(() => {
    setVariants([]);
    setError(null);
    setTokensUsed(0);
    setBestVariantId(null);
  }, []);

  const replaceVariants = useCallback((nextVariants: CaptionVariant[]) => {
    setVariants(nextVariants);
    setBestVariantId(nextVariants[0]?.id ?? null);
  }, []);

  const generate = useCallback(
    async (request: CaptionRequest) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await portalFetch("/api/ai/caption", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        });
        const payload = await response.json();
        if (!response.ok) {
          setError(mapError(payload?.error));
          return;
        }
        const nextVariants = (payload.variants ?? []) as CaptionVariant[];
        setVariants(nextVariants);
        const usedTokens = Number(payload.tokensUsed ?? 0);
        const bestId = (payload.bestVariantId as string | undefined) ?? nextVariants[0]?.id ?? null;
        setBestVariantId(bestId);
        setTokensUsed(usedTokens);
        const history = readHistory(clientId);
        const entry: CaptionHistoryItem = {
          id: crypto.randomUUID(),
          clientId,
          generatedAt: payload.generatedAt ?? new Date().toISOString(),
          request,
          variants: nextVariants,
          tokensUsed: usedTokens,
          bestVariantId: bestId,
        };
        writeHistory(clientId, [entry, ...history]);
        try {
          await portalFetch("/api/ai/caption/history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: entry.id,
              clientId: entry.clientId,
              generatedAt: entry.generatedAt,
              request: entry.request,
              variants: entry.variants,
              tokensUsed: entry.tokensUsed,
              bestVariantId: entry.bestVariantId,
            }),
          });
        } catch {
          // Keep local backup if backend history save fails.
        }
      } catch {
        setError("Controlla la connessione");
      } finally {
        setIsLoading(false);
      }
    },
    [clientId],
  );

  const improve = useCallback(async (request: ImproveRequest): Promise<CaptionVariant | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await portalFetch("/api/ai/caption/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(mapError(payload?.error));
        return null;
      }
      return payload.variant as CaptionVariant;
    } catch {
      setError("Controlla la connessione");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const generateHashtags = useCallback(async (params: HashtagParams): Promise<HashtagResult | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await portalFetch("/api/ai/hashtags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(mapError(payload?.error));
        return null;
      }
      return {
        hashtags: (payload.hashtags ?? []).map(String),
        categories: payload.categories ?? {},
      };
    } catch {
      setError("Controlla la connessione");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    generate,
    improve,
    generateHashtags,
    variants,
    isLoading,
    error,
    clearVariants,
    replaceVariants,
    tokensUsed,
    generationsToday,
    bestVariantId,
  };
}
