import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { portalFetch } from "@workspace/api-client-react";
import type { Competitor } from "@/types/client";

interface ClientCompetitorDto {
  id: string;
  clientId: number;
  name: string;
  profileUrl: string;
  platform: Competitor["platform"];
  followers: number;
  followersPrevious: number | null;
  engagementRate: number;
  postsPerWeek: number;
  isPrimary: boolean;
  notes: string;
  topContent: string | null;
  observedStrategy: string | null;
  strengths: string[];
  weaknesses: string[];
  updateHistory: Competitor["updateHistory"];
  createdAt: string;
  updatedAt: string;
}

type CreateCompetitorInput = Omit<Competitor, "id" | "createdAt" | "updatedAt">;
type UpdateCompetitorInput = Partial<Competitor>;

const competitorQueryKey = (clientId: string | null) =>
  ["clients", clientId ?? "none", "competitors"] as const;

function toNumericClientId(clientId: string | null): number | null {
  if (!clientId) return null;
  const n = Number(clientId);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toNowIso() {
  return new Date().toISOString();
}

function normalizeCompetitor(
  dto: ClientCompetitorDto,
  fallbackClientId: string,
): Competitor {
  return {
    id: String(dto.id),
    clientId: String(dto.clientId ?? fallbackClientId),
    name: dto.name ?? "",
    profileUrl: dto.profileUrl ?? "",
    platform: dto.platform,
    followers: Number(dto.followers ?? 0),
    followersPrevious:
      dto.followersPrevious == null ? undefined : Number(dto.followersPrevious),
    engagementRate: Number(dto.engagementRate ?? 0),
    postsPerWeek: Number(dto.postsPerWeek ?? 0),
    isPrimary: Boolean(dto.isPrimary),
    notes: dto.notes ?? "",
    topContent: dto.topContent ?? undefined,
    observedStrategy: dto.observedStrategy ?? undefined,
    strengths: Array.isArray(dto.strengths) ? dto.strengths : [],
    weaknesses: Array.isArray(dto.weaknesses) ? dto.weaknesses : [],
    updateHistory: Array.isArray(dto.updateHistory) ? dto.updateHistory : [],
    createdAt: dto.createdAt ?? toNowIso(),
    updatedAt: dto.updatedAt ?? toNowIso(),
  };
}

export function useClientCompetitors(clientId: string | null) {
  const numericClientId = toNumericClientId(clientId);
  return useQuery<Competitor[]>({
    queryKey: competitorQueryKey(clientId),
    enabled: numericClientId != null,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      if (!numericClientId || !clientId) return [];
      const response = await portalFetch(
        `/api/clients/${numericClientId}/competitors`,
      );
      if (!response.ok) {
        throw new Error("Impossibile caricare i competitor del cliente.");
      }
      const payload = (await response.json()) as ClientCompetitorDto[];
      return payload.map((row) => normalizeCompetitor(row, clientId));
    },
  });
}

export function useCreateCompetitor(clientId: string | null) {
  const queryClient = useQueryClient();
  const numericClientId = toNumericClientId(clientId);
  const key = competitorQueryKey(clientId);

  return useMutation({
    mutationFn: async (input: CreateCompetitorInput) => {
      if (!numericClientId || !clientId) throw new Error("Cliente non valido.");
      const response = await portalFetch(
        `/api/clients/${numericClientId}/competitors`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...input,
            profileUrl: input.profileUrl ?? "",
            topContent: input.topContent ?? undefined,
            observedStrategy: input.observedStrategy ?? undefined,
            updateHistory: input.updateHistory ?? [],
          }),
        },
      );
      if (!response.ok) throw new Error("Impossibile creare il competitor.");
      const payload = (await response.json()) as ClientCompetitorDto;
      return normalizeCompetitor(payload, clientId);
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Competitor[]>(key);
      const optimistic: Competitor = {
        id: `temp-${Date.now()}`,
        clientId: input.clientId,
        name: input.name,
        profileUrl: input.profileUrl,
        platform: input.platform,
        followers: input.followers,
        followersPrevious: input.followersPrevious,
        engagementRate: input.engagementRate,
        postsPerWeek: input.postsPerWeek,
        isPrimary: input.isPrimary,
        notes: input.notes,
        topContent: input.topContent,
        observedStrategy: input.observedStrategy,
        strengths: input.strengths,
        weaknesses: input.weaknesses,
        updateHistory: input.updateHistory,
        createdAt: toNowIso(),
        updatedAt: toNowIso(),
      };
      queryClient.setQueryData<Competitor[]>(key, (old = []) => [
        optimistic,
        ...old,
      ]);
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useUpdateCompetitor(clientId: string | null) {
  const queryClient = useQueryClient();
  const numericClientId = toNumericClientId(clientId);
  const key = competitorQueryKey(clientId);

  return useMutation({
    mutationFn: async ({
      competitorId,
      updates,
    }: {
      competitorId: string;
      updates: UpdateCompetitorInput;
    }) => {
      if (!numericClientId || !clientId) throw new Error("Cliente non valido.");
      const response = await portalFetch(
        `/api/clients/${numericClientId}/competitors/${competitorId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        },
      );
      if (!response.ok) throw new Error("Impossibile aggiornare il competitor.");
      const payload = (await response.json()) as ClientCompetitorDto;
      return normalizeCompetitor(payload, clientId);
    },
    onMutate: async ({ competitorId, updates }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Competitor[]>(key);
      queryClient.setQueryData<Competitor[]>(key, (old = []) =>
        old.map((competitor) =>
          competitor.id === competitorId
            ? { ...competitor, ...updates, updatedAt: toNowIso() }
            : competitor,
        ),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useDeleteCompetitor(clientId: string | null) {
  const queryClient = useQueryClient();
  const numericClientId = toNumericClientId(clientId);
  const key = competitorQueryKey(clientId);

  return useMutation({
    mutationFn: async (competitorId: string) => {
      if (!numericClientId || !clientId) throw new Error("Cliente non valido.");
      const response = await portalFetch(
        `/api/clients/${numericClientId}/competitors/${competitorId}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("Impossibile eliminare il competitor.");
      return competitorId;
    },
    onMutate: async (competitorId) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Competitor[]>(key);
      queryClient.setQueryData<Competitor[]>(key, (old = []) =>
        old.filter((competitor) => competitor.id !== competitorId),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
