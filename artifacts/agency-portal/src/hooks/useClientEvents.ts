import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { portalFetch } from "@workspace/api-client-react";
import type { ClientEvent } from "@/types/client";

interface ClientEventDto {
  id: string;
  clientId: number;
  title: string;
  date: string;
  endDate: string | null;
  type: ClientEvent["type"];
  priority: ClientEvent["priority"];
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

type CreateEventInput = Omit<ClientEvent, "id" | "createdAt" | "updatedAt">;
type UpdateEventInput = Partial<ClientEvent>;

const eventQueryKey = (clientId: string | null) =>
  ["clients", clientId ?? "none", "events"] as const;

function toNumericClientId(clientId: string | null): number | null {
  if (!clientId) return null;
  const n = Number(clientId);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toNowIso() {
  return new Date().toISOString();
}

function normalizeEvent(dto: ClientEventDto, fallbackClientId: string): ClientEvent {
  return {
    id: String(dto.id),
    clientId: String(dto.clientId ?? fallbackClientId),
    title: dto.title ?? "",
    date: dto.date ?? toNowIso(),
    endDate: dto.endDate ?? undefined,
    type: dto.type,
    priority: dto.priority,
    note: dto.note ?? undefined,
    createdAt: dto.createdAt ?? toNowIso(),
    updatedAt: dto.updatedAt ?? toNowIso(),
  };
}

export function useClientEvents(clientId: string | null) {
  const numericClientId = toNumericClientId(clientId);
  return useQuery<ClientEvent[]>({
    queryKey: eventQueryKey(clientId),
    enabled: numericClientId != null,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      if (!numericClientId || !clientId) return [];
      const response = await portalFetch(`/api/clients/${numericClientId}/events`);
      if (!response.ok) {
        throw new Error("Impossibile caricare gli eventi del cliente.");
      }
      const payload = (await response.json()) as ClientEventDto[];
      return payload.map((row) => normalizeEvent(row, clientId));
    },
  });
}

export function useCreateClientEvent(clientId: string | null) {
  const queryClient = useQueryClient();
  const numericClientId = toNumericClientId(clientId);
  const key = eventQueryKey(clientId);

  return useMutation({
    mutationFn: async (input: CreateEventInput) => {
      if (!numericClientId || !clientId) throw new Error("Cliente non valido.");
      const response = await portalFetch(`/api/clients/${numericClientId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: input.title,
          date: input.date,
          endDate: input.endDate ?? null,
          type: input.type,
          priority: input.priority,
          note: input.note ?? undefined,
        }),
      });
      if (!response.ok) throw new Error("Impossibile creare l'evento.");
      const payload = (await response.json()) as ClientEventDto;
      return normalizeEvent(payload, clientId);
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ClientEvent[]>(key);
      const optimistic: ClientEvent = {
        id: `temp-${Date.now()}`,
        clientId: input.clientId,
        title: input.title,
        date: input.date,
        endDate: input.endDate,
        type: input.type,
        priority: input.priority,
        note: input.note,
        createdAt: toNowIso(),
        updatedAt: toNowIso(),
      };
      queryClient.setQueryData<ClientEvent[]>(key, (old = []) =>
        [...old, optimistic].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
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

export function useUpdateClientEvent(clientId: string | null) {
  const queryClient = useQueryClient();
  const numericClientId = toNumericClientId(clientId);
  const key = eventQueryKey(clientId);

  return useMutation({
    mutationFn: async ({
      eventId,
      updates,
    }: {
      eventId: string;
      updates: UpdateEventInput;
    }) => {
      if (!numericClientId || !clientId) throw new Error("Cliente non valido.");
      const response = await portalFetch(
        `/api/clients/${numericClientId}/events/${eventId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        },
      );
      if (!response.ok) throw new Error("Impossibile aggiornare l'evento.");
      const payload = (await response.json()) as ClientEventDto;
      return normalizeEvent(payload, clientId);
    },
    onMutate: async ({ eventId, updates }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ClientEvent[]>(key);
      queryClient.setQueryData<ClientEvent[]>(key, (old = []) =>
        old
          .map((event) =>
            event.id === eventId
              ? { ...event, ...updates, updatedAt: toNowIso() }
              : event,
          )
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
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

export function useDeleteClientEvent(clientId: string | null) {
  const queryClient = useQueryClient();
  const numericClientId = toNumericClientId(clientId);
  const key = eventQueryKey(clientId);

  return useMutation({
    mutationFn: async (eventId: string) => {
      if (!numericClientId || !clientId) throw new Error("Cliente non valido.");
      const response = await portalFetch(
        `/api/clients/${numericClientId}/events/${eventId}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("Impossibile eliminare l'evento.");
      return eventId;
    },
    onMutate: async (eventId) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ClientEvent[]>(key);
      queryClient.setQueryData<ClientEvent[]>(key, (old = []) =>
        old.filter((event) => event.id !== eventId),
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
