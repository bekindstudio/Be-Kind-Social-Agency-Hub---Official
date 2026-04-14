import { useCallback, useEffect, useMemo, useState } from "react";
import { portalFetch } from "@workspace/api-client-react";
import type {
  CampaignRequest,
  CampaignResponse,
  ContentIdea,
  IdeasRequest,
  IdeasResponse,
  PlanRequest,
  PlanResponse,
} from "@/types/content-ideas";

type LoadingType = "ideas" | "plan" | "campaign" | null;

interface StoredIdeasSession {
  generatedAt: string;
  ideas: ContentIdea[];
}

export interface UseContentIdeasReturn {
  generateIdeas: (request: IdeasRequest) => Promise<void>;
  generatePlan: (request: PlanRequest) => Promise<void>;
  generateCampaign: (request: CampaignRequest) => Promise<void>;
  ideas: ContentIdea[];
  plan: PlanResponse | null;
  campaign: CampaignResponse | null;
  isLoading: boolean;
  loadingType: LoadingType;
  error: string | null;
  clearResults: () => void;
  savedIdeas: ContentIdea[];
  saveIdea: (idea: ContentIdea) => void;
  removeSavedIdea: (id: string) => void;
  replaceSavedIdeas: (ideas: ContentIdea[]) => void;
  tokensUsed: number;
}

function mapError(errorCode?: string): string {
  if (errorCode === "AI_ERROR") return "Errore AI durante la generazione.";
  if (errorCode === "PARSE_ERROR") return "Risposta AI non valida. Riprova.";
  return "Errore di rete. Controlla la connessione.";
}

function ideasHistoryKey(clientId: string): string {
  return `agency_hub_ideas_${clientId}`;
}

function savedIdeasKey(clientId: string): string {
  return `agency_hub_saved_ideas_${clientId}`;
}

function plansKey(clientId: string): string {
  return `agency_hub_plans_${clientId}`;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function useContentIdeas(clientId: string): UseContentIdeasReturn {
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [campaign, setCampaign] = useState<CampaignResponse | null>(null);
  const [savedIdeas, setSavedIdeas] = useState<ContentIdea[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<LoadingType>(null);
  const [error, setError] = useState<string | null>(null);
  const [tokensUsed, setTokensUsed] = useState(0);

  useEffect(() => {
    if (!clientId) {
      setIdeas([]);
      setSavedIdeas([]);
      setPlan(null);
      setCampaign(null);
      setTokensUsed(0);
      return;
    }
    const recentIdeas = readJson<StoredIdeasSession[]>(ideasHistoryKey(clientId), []);
    const recentPlans = readJson<PlanResponse[]>(plansKey(clientId), []);
    const storedSavedIdeas = readJson<ContentIdea[]>(savedIdeasKey(clientId), []);
    setIdeas(recentIdeas[0]?.ideas ?? []);
    setPlan(recentPlans[0] ?? null);
    setSavedIdeas(storedSavedIdeas);
    setCampaign(null);
    setError(null);
    setTokensUsed(0);
  }, [clientId]);

  const persistSavedIdeas = useCallback((next: ContentIdea[]) => {
    setSavedIdeas(next);
    if (clientId) writeJson(savedIdeasKey(clientId), next);
  }, [clientId]);

  const saveIdea = useCallback((idea: ContentIdea) => {
    const deduped = savedIdeas.filter((item) => item.id !== idea.id);
    persistSavedIdeas([idea, ...deduped]);
  }, [persistSavedIdeas, savedIdeas]);

  const removeSavedIdea = useCallback((id: string) => {
    persistSavedIdeas(savedIdeas.filter((idea) => idea.id !== id));
  }, [persistSavedIdeas, savedIdeas]);

  const replaceSavedIdeas = useCallback((next: ContentIdea[]) => {
    persistSavedIdeas(next);
  }, [persistSavedIdeas]);

  const clearResults = useCallback(() => {
    setIdeas([]);
    setPlan(null);
    setCampaign(null);
    setError(null);
    setTokensUsed(0);
  }, []);

  const generateIdeas = useCallback(async (request: IdeasRequest) => {
    setIsLoading(true);
    setLoadingType("ideas");
    setError(null);
    try {
      const response = await portalFetch("/api/ai/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(mapError(payload?.error));
        return;
      }
      const parsed = payload as IdeasResponse;
      setIdeas(parsed.ideas ?? []);
      setTokensUsed(Number(parsed.tokensUsed ?? 0));
      if (clientId) {
        const sessions = readJson<StoredIdeasSession[]>(ideasHistoryKey(clientId), []);
        const nextSessions = [{ generatedAt: parsed.generatedAt ?? new Date().toISOString(), ideas: parsed.ideas ?? [] }, ...sessions].slice(0, 3);
        writeJson(ideasHistoryKey(clientId), nextSessions);
      }
    } catch {
      setError("Errore di rete. Controlla la connessione.");
    } finally {
      setIsLoading(false);
      setLoadingType(null);
    }
  }, [clientId]);

  const generatePlan = useCallback(async (request: PlanRequest) => {
    setIsLoading(true);
    setLoadingType("plan");
    setError(null);
    try {
      const response = await portalFetch("/api/ai/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(mapError(payload?.error));
        return;
      }
      const parsed = payload as PlanResponse;
      setPlan(parsed);
      setTokensUsed(Number(parsed.tokensUsed ?? 0));
      if (clientId) {
        const plans = readJson<PlanResponse[]>(plansKey(clientId), []);
        writeJson(plansKey(clientId), [parsed, ...plans].slice(0, 3));
      }
    } catch {
      setError("Errore di rete. Controlla la connessione.");
    } finally {
      setIsLoading(false);
      setLoadingType(null);
    }
  }, [clientId]);

  const generateCampaign = useCallback(async (request: CampaignRequest) => {
    setIsLoading(true);
    setLoadingType("campaign");
    setError(null);
    try {
      const response = await portalFetch("/api/ai/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(mapError(payload?.error));
        return;
      }
      setCampaign(payload as CampaignResponse);
      setTokensUsed(Number(payload?.tokensUsed ?? 0));
    } catch {
      setError("Errore di rete. Controlla la connessione.");
    } finally {
      setIsLoading(false);
      setLoadingType(null);
    }
  }, []);

  return useMemo(() => ({
    generateIdeas,
    generatePlan,
    generateCampaign,
    ideas,
    plan,
    campaign,
    isLoading,
    loadingType,
    error,
    clearResults,
    savedIdeas,
    saveIdea,
    removeSavedIdea,
    replaceSavedIdeas,
    tokensUsed,
  }), [
    campaign,
    clearResults,
    error,
    generateCampaign,
    generateIdeas,
    generatePlan,
    ideas,
    isLoading,
    loadingType,
    plan,
    removeSavedIdea,
    replaceSavedIdeas,
    saveIdea,
    savedIdeas,
    tokensUsed,
  ]);
}
