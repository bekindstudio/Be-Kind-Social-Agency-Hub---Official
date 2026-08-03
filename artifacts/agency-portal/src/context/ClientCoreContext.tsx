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
import type {
  AnalyticsPeriod,
  Client,
  ClientAnalytics,
} from "@/types/client";
import {
  useClientMetaAccount,
  useLinkMetaAccount,
  useUnlinkMetaAccount,
} from "@/hooks/useClientMetaAccount";
import { useSupabaseAuth } from "@/auth/SupabaseAuthContext";

const ACTIVE_CLIENT_ID_KEY = "active_client_id";
const LEGACY_BLOB_KEY = ["agency", "hub", "data"].join("_");
const LEGACY_MIGRATED_KEY = "agency_hub_migrated_v1";

interface ClientCoreStore {
  clients: Client[];
  analytics: Record<string, ClientAnalytics>;
}

export interface ClientCoreContextType {
  clients: Client[];
  clientsLoading: boolean;
  clientsError: Error | null;
  activeClient: Client | null;
  activeClientId: string | null;
  setActiveClient: (client: Client) => void;
  metaAccountId: string | null;
  setMetaAccountId: (id: string | null) => void;
  createClient: (input: { name: string; industry: string; color?: string }) => void;
  importClients: (clients: Client[]) => void;
  analytics: ClientAnalytics | null;
  analyticsByClient: Record<string, ClientAnalytics>;
  refreshAnalytics: (period?: AnalyticsPeriod) => Promise<void>;
  isLoading: boolean;
}

const ClientCoreContext = createContext<ClientCoreContextType | null>(null);

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function seedStore(): ClientCoreStore {
  // Nessun cliente demo: lo store parte VUOTO e viene popolato solo dai clienti
  // reali caricati da /api/clients (vedi loadPortalClients più sotto).
  return { clients: [], analytics: {} };
}

export function ClientCoreProvider({ children }: { children: ReactNode }) {
  // Stato auth: serve a non chiamare /api/clients PRIMA che il token Supabase
  // sia pronto (altrimenti 401 → lista vuota silenziosa che non si ripristina).
  const { session, loading: authLoading, authDisabled: authIsDisabled } = useSupabaseAuth();
  const accessToken = session?.access_token ?? null;
  const [store, setStore] = useState<ClientCoreStore>(() => seedStore());
  const [activeClientId, setActiveClientId] = useState<string | null>(() =>
    localStorage.getItem(ACTIVE_CLIENT_ID_KEY),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsError, setClientsError] = useState<Error | null>(null);

  useEffect(() => {
    if (localStorage.getItem(LEGACY_MIGRATED_KEY)) return;
    let cancelled = false;

    const migrateLegacyStore = async () => {
      try {
        const raw = localStorage.getItem(LEGACY_BLOB_KEY);
        if (!raw) {
          localStorage.setItem(LEGACY_MIGRATED_KEY, "true");
          return;
        }

        const legacy = JSON.parse(raw) as {
          activeClientId?: unknown;
          metaAccountIds?: Record<string, string | null>;
        };

        if (!localStorage.getItem(ACTIVE_CLIENT_ID_KEY)) {
          const legacyActive =
            typeof legacy.activeClientId === "string" ? legacy.activeClientId : null;
          if (legacyActive) {
            localStorage.setItem(ACTIVE_CLIENT_ID_KEY, legacyActive);
            if (!cancelled) setActiveClientId(legacyActive);
          }
        }

        if (legacy.metaAccountIds && typeof legacy.metaAccountIds === "object") {
          await Promise.all(
            Object.entries(legacy.metaAccountIds).map(async ([clientId, accountId]) => {
              const numericClientId = Number(clientId);
              if (
                !Number.isFinite(numericClientId) ||
                numericClientId <= 0 ||
                typeof accountId !== "string" ||
                accountId.trim().length === 0
              ) {
                return;
              }
              try {
                await portalFetch(`/api/clients/${numericClientId}/meta-account`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ metaAccountId: accountId }),
                });
              } catch {
                // Best effort migration.
              }
            }),
          );
        }

        localStorage.setItem(LEGACY_MIGRATED_KEY, "true");
        localStorage.removeItem(LEGACY_BLOB_KEY);
      } catch {
        localStorage.setItem(LEGACY_MIGRATED_KEY, "true");
      }
    };

    void migrateLegacyStore();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeClientId) {
      localStorage.setItem(ACTIVE_CLIENT_ID_KEY, activeClientId);
    } else {
      localStorage.removeItem(ACTIVE_CLIENT_ID_KEY);
    }
  }, [activeClientId]);

  useEffect(() => {
    if (!activeClientId && store.clients.length > 0) {
      setActiveClientId(store.clients[0]?.id ?? null);
    }
  }, [activeClientId, store.clients]);

  useEffect(() => {
    if (
      activeClientId &&
      !store.clients.some((client) => client.id === activeClientId)
    ) {
      setActiveClientId(store.clients[0]?.id ?? null);
    }
  }, [activeClientId, store.clients]);

  const activeClient = useMemo(
    () => store.clients.find((client) => client.id === activeClientId) ?? null,
    [store.clients, activeClientId],
  );

  const activeClientNumericId =
    activeClientId && Number.isFinite(Number(activeClientId))
      ? Number(activeClientId)
      : null;

  const { data: remoteMetaAccount } = useClientMetaAccount(activeClientId);
  const linkMetaAccountMutation = useLinkMetaAccount(activeClientId);
  const unlinkMetaAccountMutation = useUnlinkMetaAccount(activeClientId);
  const metaAccountId = remoteMetaAccount?.metaAccountId ?? null;

  const setActiveClient = useCallback((client: Client) => {
    localStorage.setItem(ACTIVE_CLIENT_ID_KEY, client.id);
    setActiveClientId(client.id);
  }, []);

  const setMetaAccountId = useCallback(
    (id: string | null) => {
      if (!activeClientId) return;
      if (id && id.trim().length > 0) {
        linkMetaAccountMutation.mutate({ metaAccountId: id });
        return;
      }
      unlinkMetaAccountMutation.mutate();
    },
    [activeClientId, linkMetaAccountMutation, unlinkMetaAccountMutation],
  );

  const createClient = useCallback(
    (input: { name: string; industry: string; color?: string }) => {
      const newClient: Client = {
        id: makeId(),
        name: input.name.trim(),
        industry: input.industry.trim(),
        color: input.color?.trim() || "#4F46E5",
        status: "active",
        createdAt: nowIso(),
      };
      if (!newClient.name || !newClient.industry) return;
      setStore((prev) => ({
        ...prev,
        clients: [newClient, ...prev.clients],
        analytics: {
          ...prev.analytics,
          [newClient.id]: {
            clientId: newClient.id,
            accountId: undefined,
            period: "ultimo_30_giorni",
            followers: 0,
            followersPrevious: 0,
            followersGrowth: 0,
            reach: 0,
            reachPrevious: 0,
            impressions: 0,
            engagementRate: 0,
            engagementRatePrevious: 0,
            postsPublished: 0,
            profileViews: 0,
            dailyData: [],
            topPosts: [],
            updatedAt: nowIso(),
          },
        },
      }));
      setActiveClientId(newClient.id);
    },
    [],
  );

  const importClients = useCallback((incomingClients: Client[]) => {
    if (!Array.isArray(incomingClients) || incomingClients.length === 0) return;
    setStore((prev) => {
      const existing = prev.clients;
      const byName = new Map(existing.map((c) => [c.name.trim().toLowerCase(), c]));
      const byId = new Map(existing.map((c) => [c.id, c]));
      const merged = [...existing];

      for (const candidate of incomingClients) {
        const normalizedName = candidate.name.trim().toLowerCase();
        const existingById = byId.get(candidate.id);
        const existingByName = byName.get(normalizedName);

        if (existingById) {
          const next = { ...existingById, ...candidate, id: existingById.id };
          const idx = merged.findIndex((c) => c.id === existingById.id);
          if (idx >= 0) merged[idx] = next;
          continue;
        }
        if (existingByName) {
          const next = { ...existingByName, ...candidate, id: existingByName.id };
          const idx = merged.findIndex((c) => c.id === existingByName.id);
          if (idx >= 0) merged[idx] = next;
          continue;
        }
        merged.push(candidate);
      }

      return { ...prev, clients: merged };
    });
  }, []);

  useEffect(() => {
    // Aspetta solo che l'auth sia RISOLTA (se il login è attivo). Una volta risolta,
    // proviamo a caricare: il token viene attaccato dal getter globale. NON blocchiamo
    // sul valore esatto del token (evita edge-case che lasciano il selettore vuoto):
    // se arriva un 401 transitorio mentre il token si assesta, riproviamo con backoff.
    if (!authIsDisabled && authLoading) return;

    let alive = true;
    const mapRows = (raw: unknown) =>
      (Array.isArray(raw) ? raw : [])
        .filter((c: Record<string, unknown>) => c?.id != null && String(c?.name ?? "").trim().length > 0)
        .map((c: Record<string, unknown>) => ({
          id: String(c.id),
          name: String(c.name),
          logo: c.logoUrl ? String(c.logoUrl) : undefined,
          color: String(c.brandColor ?? c.color ?? "#4F46E5"),
          industry: String(c.settore ?? c.company ?? c.industry ?? "Generico"),
          status: "active" as const,
          createdAt: String(c.createdAt ?? nowIso()),
        }));

    const loadPortalClients = async () => {
      setClientsLoading(true);
      // Fino a 4 tentativi: il token Supabase può non essere ancora pronto al primo colpo.
      for (let attempt = 0; attempt < 4 && alive; attempt++) {
        try {
          const response = await portalFetch("/api/clients", { credentials: "include" });
          if (response.ok) {
            const raw = await response.json();
            if (!alive) return;
            importClients(mapRows(raw));
            setClientsError(null);
            setClientsLoading(false);
            return;
          }
          if (alive) setClientsError(new Error(`clients_http_${response.status}`));
          // Solo 401/403 sono transitori (token non ancora valido): per altri errori, stop.
          if (response.status !== 401 && response.status !== 403) break;
        } catch (error) {
          if (alive) setClientsError(error instanceof Error ? error : new Error("Errore caricamento clienti"));
        }
        await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
      }
      if (alive) setClientsLoading(false);
    };

    void loadPortalClients();
    // Ricarica quando la tab torna in primo piano (es. dopo il login in un'altra scheda).
    const onFocus = () => { void loadPortalClients(); };
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      window.removeEventListener("focus", onFocus);
    };
  }, [importClients, authIsDisabled, authLoading, accessToken]);

  const analytics = activeClientId ? store.analytics[activeClientId] ?? null : null;

  const refreshAnalytics = useCallback(
    async (period: AnalyticsPeriod = "30d") => {
      if (!activeClientId) return;
      setIsLoading(true);
      try {
        const rangeToPeriod: Record<AnalyticsPeriod, string> = {
          "7d": "day",
          "30d": "month",
          "90d": "month",
          custom: "month",
        };
        const activeAccountId = metaAccountId;
        if (activeAccountId) {
          const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
          const until = new Date();
          const since = new Date();
          since.setDate(until.getDate() - (days - 1));
          const params = new URLSearchParams({
            period: rangeToPeriod[period],
            since: since.toISOString().slice(0, 10),
            until: until.toISOString().slice(0, 10),
          });
          const insightsRes = await portalFetch(`/api/meta/insights/${activeAccountId}?${params.toString()}`);
          const postsRes = await portalFetch(
            `/api/meta/posts/${activeAccountId}?${new URLSearchParams({
              since: since.toISOString().slice(0, 10),
              until: until.toISOString().slice(0, 10),
              limit: "40",
            }).toString()}`,
          );
          if (insightsRes.ok && postsRes.ok) {
            const insights = (await insightsRes.json()) as Array<Record<string, unknown>>;
            const postsPayload = (await postsRes.json()) as Array<Record<string, unknown>>;
            setStore((prev) => {
              const current = prev.analytics[activeClientId];
              if (!current) return prev;
              const followers = Number(insights.at(-1)?.followerCount ?? current.followers);
              const followersPrevious = Number(insights.at(0)?.followerCount ?? current.followersPrevious);
              const reach = insights.reduce((acc, item) => acc + Number(item.reach ?? 0), 0);
              const reachPrevious = current.reach;
              const impressions = insights.reduce((acc, item) => acc + Number(item.impressions ?? 0), 0);
              const engagementRate =
                postsPayload.length > 0
                  ? Number(
                      (
                        postsPayload.reduce((acc, post) => acc + Number(post.engagementRate ?? 0), 0) /
                        postsPayload.length
                      ).toFixed(2),
                    )
                  : current.engagementRate;
              const growthBase =
                followersPrevious > 0
                  ? ((followers - followersPrevious) / followersPrevious) * 100
                  : 0;
              return {
                ...prev,
                analytics: {
                  ...prev.analytics,
                  [activeClientId]: {
                    ...current,
                    accountId: activeAccountId,
                    period,
                    followers,
                    followersPrevious,
                    followersGrowth: Number(growthBase.toFixed(2)),
                    reach,
                    reachPrevious,
                    impressions,
                    engagementRate,
                    engagementRatePrevious: current.engagementRate,
                    postsPublished: postsPayload.length,
                    profileViews: insights.reduce((acc, item) => acc + Number(item.profileViews ?? 0), 0),
                    dailyData: insights.map((item) => ({
                      date: String(item.date),
                      followers: Number(item.followerCount ?? followers),
                      reach: Number(item.reach ?? 0),
                      impressions: Number(item.impressions ?? 0),
                      engagement: Number(item.engagement ?? 0),
                    })),
                    topPosts: postsPayload
                      .sort((a, b) => Number(b.engagementRate ?? 0) - Number(a.engagementRate ?? 0))
                      .slice(0, 6)
                      .map((post) => ({
                        id: String(post.id),
                        caption: String(post.caption ?? ""),
                        mediaType: String(post.mediaType ?? "IMAGE"),
                        timestamp: String(post.timestamp ?? nowIso()),
                        likeCount: Number(post.likeCount ?? 0),
                        commentsCount: Number(post.commentsCount ?? 0),
                        reach: Number(post.reach ?? 0),
                        engagementRate: Number(post.engagementRate ?? 0),
                        thumbnailUrl: post.thumbnailUrl ? String(post.thumbnailUrl) : undefined,
                      })),
                    updatedAt: nowIso(),
                  },
                },
              };
            });
            return;
          }
        }

        // Senza un account Meta collegato non ci sono dati reali da mostrare:
        // NON fabbrichiamo numeri. Le analytics restano quelle vere (o vuote).
      } finally {
        setIsLoading(false);
      }
    },
    [activeClientId, metaAccountId],
  );

  const value: ClientCoreContextType = {
    clients: store.clients,
    clientsLoading,
    clientsError,
    activeClient,
    activeClientId,
    setActiveClient,
    metaAccountId,
    setMetaAccountId,
    createClient,
    importClients,
    analytics,
    analyticsByClient: store.analytics,
    refreshAnalytics,
    isLoading,
  };

  return (
    <ClientCoreContext.Provider value={value}>{children}</ClientCoreContext.Provider>
  );
}

export function useClientCore(): ClientCoreContextType {
  const ctx = useContext(ClientCoreContext);
  if (!ctx) {
    throw new Error("useClientCore must be used within ClientCoreProvider");
  }
  return ctx;
}
