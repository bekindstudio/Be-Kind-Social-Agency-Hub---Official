import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { portalFetch } from "@workspace/api-client-react";
import type { EditorialPost } from "@/types/client";

type PostPlatform = EditorialPost["platform"];
type PostStatus = EditorialPost["status"];

interface ClientPostDto {
  id: string;
  clientId: number;
  title: string;
  caption: string;
  platform: PostPlatform;
  status: PostStatus;
  scheduledDate: string | null;
  mediaUrls: string[];
  hashtags: string[];
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

type CreatePostInput = Omit<EditorialPost, "id" | "createdAt" | "updatedAt">;
type UpdatePostInput = Partial<EditorialPost>;

const DEFAULT_DATE = () => new Date().toISOString();

const postQueryKey = (clientId: string | null) =>
  ["clients", clientId ?? "none", "posts"] as const;

function toNumericClientId(clientId: string | null): number | null {
  if (!clientId) return null;
  const n = Number(clientId);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizePost(dto: ClientPostDto, fallbackClientId: string): EditorialPost {
  return {
    id: String(dto.id),
    clientId: String(dto.clientId ?? fallbackClientId),
    title: dto.title ?? "",
    caption: dto.caption ?? "",
    platform: dto.platform,
    status: dto.status,
    scheduledDate: dto.scheduledDate ?? DEFAULT_DATE(),
    mediaUrls: Array.isArray(dto.mediaUrls) ? dto.mediaUrls : [],
    hashtags: Array.isArray(dto.hashtags) ? dto.hashtags : [],
    internalNotes: dto.internalNotes ?? undefined,
    createdAt: dto.createdAt ?? DEFAULT_DATE(),
    updatedAt: dto.updatedAt ?? DEFAULT_DATE(),
  };
}

export function useClientPosts(clientId: string | null) {
  const numericClientId = toNumericClientId(clientId);
  return useQuery<EditorialPost[]>({
    queryKey: postQueryKey(clientId),
    enabled: numericClientId != null,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      if (!numericClientId || !clientId) return [];
      const response = await portalFetch(`/api/clients/${numericClientId}/posts`);
      if (!response.ok) {
        throw new Error("Impossibile caricare i post del cliente.");
      }
      const payload = (await response.json()) as ClientPostDto[];
      return payload.map((row) => normalizePost(row, clientId));
    },
  });
}

export function useCreatePost(clientId: string | null) {
  const queryClient = useQueryClient();
  const numericClientId = toNumericClientId(clientId);
  const key = postQueryKey(clientId);

  return useMutation({
    mutationFn: async (input: CreatePostInput) => {
      if (!numericClientId || !clientId) throw new Error("Cliente non valido.");
      const response = await portalFetch(`/api/clients/${numericClientId}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: input.title,
          caption: input.caption,
          platform: input.platform,
          status: input.status,
          scheduledDate: input.scheduledDate,
          mediaUrls: input.mediaUrls,
          hashtags: input.hashtags,
          internalNotes: input.internalNotes ?? null,
        }),
      });
      if (!response.ok) throw new Error("Impossibile creare il post.");
      const payload = (await response.json()) as ClientPostDto;
      return normalizePost(payload, clientId);
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<EditorialPost[]>(key);
      const optimistic: EditorialPost = {
        id: `temp-${Date.now()}`,
        clientId: input.clientId,
        title: input.title,
        caption: input.caption,
        platform: input.platform,
        status: input.status,
        scheduledDate: input.scheduledDate,
        mediaUrls: input.mediaUrls,
        hashtags: input.hashtags,
        internalNotes: input.internalNotes,
        createdAt: DEFAULT_DATE(),
        updatedAt: DEFAULT_DATE(),
      };
      queryClient.setQueryData<EditorialPost[]>(key, (old = []) => [
        optimistic,
        ...old,
      ]);
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(key, context.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useUpdatePost(clientId: string | null) {
  const queryClient = useQueryClient();
  const numericClientId = toNumericClientId(clientId);
  const key = postQueryKey(clientId);

  return useMutation({
    mutationFn: async ({
      postId,
      updates,
    }: {
      postId: string;
      updates: UpdatePostInput;
    }) => {
      if (!numericClientId || !clientId) throw new Error("Cliente non valido.");
      const response = await portalFetch(
        `/api/clients/${numericClientId}/posts/${postId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...updates,
            internalNotes:
              updates.internalNotes === undefined ? undefined : updates.internalNotes,
          }),
        },
      );
      if (!response.ok) throw new Error("Impossibile aggiornare il post.");
      const payload = (await response.json()) as ClientPostDto;
      return normalizePost(payload, clientId);
    },
    onMutate: async ({ postId, updates }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<EditorialPost[]>(key);
      queryClient.setQueryData<EditorialPost[]>(key, (old = []) =>
        old.map((post) =>
          post.id === postId ? { ...post, ...updates, updatedAt: DEFAULT_DATE() } : post,
        ),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(key, context.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useDeletePost(clientId: string | null) {
  const queryClient = useQueryClient();
  const numericClientId = toNumericClientId(clientId);
  const key = postQueryKey(clientId);

  return useMutation({
    mutationFn: async (postId: string) => {
      if (!numericClientId || !clientId) throw new Error("Cliente non valido.");
      const response = await portalFetch(
        `/api/clients/${numericClientId}/posts/${postId}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("Impossibile eliminare il post.");
      return postId;
    },
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<EditorialPost[]>(key);
      queryClient.setQueryData<EditorialPost[]>(key, (old = []) =>
        old.filter((post) => post.id !== postId),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(key, context.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
