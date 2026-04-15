import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { portalFetch } from "@workspace/api-client-react";

export interface ClientMetaAccountDto {
  clientId: number;
  metaAccountId: string;
  platform: string;
  tokenExpiresAt: string | null;
}

const metaAccountQueryKey = (clientId: string | null) =>
  ["clients", clientId ?? "none", "meta-account"] as const;

function toNumericClientId(clientId: string | null): number | null {
  if (!clientId) return null;
  const value = Number(clientId);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function useClientMetaAccount(clientId: string | null) {
  const numericClientId = toNumericClientId(clientId);
  return useQuery<ClientMetaAccountDto | null>({
    queryKey: metaAccountQueryKey(clientId),
    enabled: numericClientId != null,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      if (!numericClientId) return null;
      const response = await portalFetch(
        `/api/clients/${numericClientId}/meta-account`,
      );
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new Error("Impossibile caricare l'account Meta collegato.");
      }
      return (await response.json()) as ClientMetaAccountDto;
    },
  });
}

export function useLinkMetaAccount(clientId: string | null) {
  const queryClient = useQueryClient();
  const numericClientId = toNumericClientId(clientId);
  const key = metaAccountQueryKey(clientId);
  return useMutation({
    mutationFn: async (data: { metaAccountId: string; platform?: string }) => {
      if (!numericClientId) throw new Error("Cliente non valido.");
      const response = await portalFetch(
        `/api/clients/${numericClientId}/meta-account`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            metaAccountId: data.metaAccountId,
            platform: data.platform ?? "instagram",
          }),
        },
      );
      if (!response.ok) {
        throw new Error("Impossibile collegare l'account Meta.");
      }
      return (await response.json()) as ClientMetaAccountDto;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useUnlinkMetaAccount(clientId: string | null) {
  const queryClient = useQueryClient();
  const numericClientId = toNumericClientId(clientId);
  const key = metaAccountQueryKey(clientId);
  return useMutation({
    mutationFn: async () => {
      if (!numericClientId) throw new Error("Cliente non valido.");
      const response = await portalFetch(
        `/api/clients/${numericClientId}/meta-account`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        throw new Error("Impossibile scollegare l'account Meta.");
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
