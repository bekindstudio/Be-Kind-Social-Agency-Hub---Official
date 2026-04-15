import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { portalFetch } from "@workspace/api-client-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useClientCore } from "@/context/ClientCoreContext";
import {
  useClientCompetitors,
  useCreateCompetitor,
  useDeleteCompetitor,
  useUpdateCompetitor,
} from "@/hooks/useClientCompetitors";
import {
  useClientEvents,
  useCreateClientEvent,
  useDeleteClientEvent,
  useUpdateClientEvent,
} from "@/hooks/useClientEvents";
import type { ClientBrief, ClientEvent, Competitor } from "@/types/client";

type CreateCompetitorInput = Omit<Competitor, "id">;
type UpdateCompetitorInput = Partial<Competitor>;
type CreateEventInput = Omit<ClientEvent, "id" | "createdAt" | "updatedAt">;
type UpdateEventInput = Partial<ClientEvent>;

export interface BriefContextType {
  brief: ClientBrief | null;
  briefLoading: boolean;
  briefsByClient: Record<string, ClientBrief>;
  updateBrief: (updates: Partial<ClientBrief>) => void;
  competitors: Competitor[];
  addCompetitor: (c: CreateCompetitorInput) => void;
  updateCompetitor: (id: string, u: UpdateCompetitorInput) => void;
  removeCompetitor: (id: string) => void;
  clientEvents: ClientEvent[];
  allClientEvents: ClientEvent[];
  addClientEvent: (e: CreateEventInput) => ClientEvent;
  updateClientEvent: (id: string, u: UpdateEventInput) => void;
  deleteClientEvent: (id: string) => void;
}

const BriefContext = createContext<BriefContextType | null>(null);

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function defaultBrief(clientId: string): ClientBrief {
  return {
    clientId,
    objectives: "",
    targetAudience: "",
    toneOfVoice: "",
    brandVoice: "",
    colorPalette: [],
    fonts: [],
    competitors: [],
    notes: "",
    updatedAt: nowIso(),
  };
}

function parseRemoteBrief(rawText: string | null | undefined, clientId: string): ClientBrief | null {
  if (!rawText) return null;
  try {
    const parsed = JSON.parse(rawText) as Partial<ClientBrief>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      ...defaultBrief(clientId),
      ...parsed,
      clientId,
      updatedAt: parsed.updatedAt ?? nowIso(),
    };
  } catch {
    return null;
  }
}

export function BriefProvider({ children }: { children: ReactNode }) {
  const { activeClientId, clients } = useClientCore();
  const [briefs, setBriefs] = useState<Record<string, ClientBrief>>({});
  const queryClient = useQueryClient();
  const activeClientNumericId =
    activeClientId && Number.isFinite(Number(activeClientId))
      ? Number(activeClientId)
      : null;

  useEffect(() => {
    setBriefs((prev) => {
      const next = { ...prev };
      clients.forEach((client) => {
        if (!next[client.id]) {
          next[client.id] = defaultBrief(client.id);
        }
      });
      return next;
    });
  }, [clients]);

  const remoteBriefQuery = useQuery({
    queryKey: ["client-brief", activeClientNumericId],
    enabled: activeClientNumericId != null,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      if (activeClientNumericId == null || !activeClientId) return null;
      const response = await portalFetch(`/api/clients/${activeClientNumericId}/brief`, {
        credentials: "include",
      });
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error("Impossibile caricare il brief del cliente.");
      }
      const payload = (await response.json().catch(() => null)) as
        | { rawText?: string }
        | null;
      return parseRemoteBrief(payload?.rawText ?? null, activeClientId);
    },
  });

  const upsertRemoteBrief = useMutation({
    mutationFn: async ({
      clientId,
      brief,
    }: {
      clientId: number;
      brief: ClientBrief;
    }) => {
      const response = await portalFetch(`/api/clients/${clientId}/brief`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: JSON.stringify(brief) }),
      });
      if (!response.ok) {
        throw new Error("Impossibile salvare il brief sul server.");
      }
      return (await response.json()) as { rawText?: string } | null;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(
        ["client-brief", variables.clientId],
        parseRemoteBrief(data?.rawText ?? null, variables.brief.clientId),
      );
    },
  });

  const briefsByClient = useMemo(() => {
    if (!activeClientId || !remoteBriefQuery.data) return briefs;
    return {
      ...briefs,
      [activeClientId]: remoteBriefQuery.data,
    };
  }, [activeClientId, briefs, remoteBriefQuery.data]);

  const brief = activeClientId ? briefsByClient[activeClientId] ?? null : null;

  const updateBrief = useCallback(
    (briefUpdates: Partial<ClientBrief>) => {
      if (!activeClientId) return;
      const current = brief ?? defaultBrief(activeClientId);
      const nextBrief: ClientBrief = {
        ...current,
        ...briefUpdates,
        clientId: activeClientId,
        updatedAt: nowIso(),
      };

      setBriefs((prev) => ({
        ...prev,
        [activeClientId]: nextBrief,
      }));

      if (activeClientNumericId != null) {
        upsertRemoteBrief.mutate({
          clientId: activeClientNumericId,
          brief: nextBrief,
        });
      }
    },
    [activeClientId, activeClientNumericId, brief, upsertRemoteBrief],
  );

  const { data: remoteCompetitors = [] } = useClientCompetitors(activeClientId);
  const createCompetitorMutation = useCreateCompetitor(activeClientId);
  const updateCompetitorMutation = useUpdateCompetitor(activeClientId);
  const deleteCompetitorMutation = useDeleteCompetitor(activeClientId);
  const competitors = activeClientId ? remoteCompetitors : [];

  const addCompetitor = useCallback(
    (competitorInput: CreateCompetitorInput) => {
      createCompetitorMutation.mutate(competitorInput);
    },
    [createCompetitorMutation],
  );

  const updateCompetitor = useCallback(
    (id: string, updates: UpdateCompetitorInput) => {
      updateCompetitorMutation.mutate({ competitorId: id, updates });
    },
    [updateCompetitorMutation],
  );

  const removeCompetitor = useCallback(
    (id: string) => {
      deleteCompetitorMutation.mutate(id);
    },
    [deleteCompetitorMutation],
  );

  const { data: remoteEvents = [] } = useClientEvents(activeClientId);
  const createEventMutation = useCreateClientEvent(activeClientId);
  const updateEventMutation = useUpdateClientEvent(activeClientId);
  const deleteEventMutation = useDeleteClientEvent(activeClientId);

  const clientEvents = activeClientId
    ? [...remoteEvents].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      )
    : [];

  const allClientEvents = useMemo(
    () =>
      [...clientEvents].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      ),
    [clientEvents],
  );

  const addClientEvent = useCallback(
    (eventInput: CreateEventInput): ClientEvent => {
      const timestamp = nowIso();
      const nextEvent: ClientEvent = {
        ...eventInput,
        id: makeId(),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      createEventMutation.mutate(eventInput);
      return nextEvent;
    },
    [createEventMutation],
  );

  const updateClientEvent = useCallback(
    (id: string, updates: UpdateEventInput) => {
      updateEventMutation.mutate({ eventId: id, updates });
    },
    [updateEventMutation],
  );

  const deleteClientEvent = useCallback(
    (id: string) => {
      deleteEventMutation.mutate(id);
    },
    [deleteEventMutation],
  );

  const value: BriefContextType = {
    brief,
    briefLoading: remoteBriefQuery.isLoading,
    briefsByClient,
    updateBrief,
    competitors,
    addCompetitor,
    updateCompetitor,
    removeCompetitor,
    clientEvents,
    allClientEvents,
    addClientEvent,
    updateClientEvent,
    deleteClientEvent,
  };

  return <BriefContext.Provider value={value}>{children}</BriefContext.Provider>;
}

export function useBrief(): BriefContextType {
  const ctx = useContext(BriefContext);
  if (!ctx) {
    throw new Error("useBrief must be used within BriefProvider");
  }
  return ctx;
}
