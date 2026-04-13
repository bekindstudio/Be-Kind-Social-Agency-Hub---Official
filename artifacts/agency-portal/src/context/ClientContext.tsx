import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { portalFetch } from "@workspace/api-client-react";
import type {
  Client,
  ClientAnalytics,
  ClientBrief,
  ClientContextType,
  Competitor,
  EditorialPost,
} from "@/types/client";

const STORAGE_KEY = "agency_hub_data";

type ClientStore = {
  clients: Client[];
  activeClientId: string | null;
  briefs: Record<string, ClientBrief>;
  posts: Record<string, EditorialPost[]>;
  analytics: Record<string, ClientAnalytics>;
  competitors: Record<string, Competitor[]>;
};

const ClientContext = createContext<ClientContextType | null>(null);

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function startOfMonthIso(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function seedStore(): ClientStore {
  const createdAt = nowIso();
  const ristoranteId = makeId();
  const dentistaId = makeId();
  const modaId = makeId();

  const clients: Client[] = [
    {
      id: ristoranteId,
      name: "Trattoria Da Nino",
      industry: "Ristorazione",
      color: "#4F46E5",
      status: "active",
      createdAt,
    },
    {
      id: dentistaId,
      name: "Studio Dentistico Sorriso",
      industry: "Salute",
      color: "#0EA5E9",
      status: "active",
      createdAt,
    },
    {
      id: modaId,
      name: "Atelier Moda Urbana",
      industry: "Fashion Retail",
      color: "#DB2777",
      status: "paused",
      createdAt,
    },
  ];

  const briefs: Record<string, ClientBrief> = {
    [ristoranteId]: {
      clientId: ristoranteId,
      objectives: "Aumentare prenotazioni serali e brand awareness locale.",
      targetAudience: "25-50 anni, residenti a Pesaro e provincia, food lovers.",
      toneOfVoice: "Caldo, autentico, familiare.",
      brandVoice: "Cucina tradizionale con attenzione ai dettagli moderni.",
      colorPalette: ["#7C3AED", "#F59E0B", "#111827"],
      fonts: ["Inter", "Playfair Display"],
      competitors: ["Osteria del Porto", "Bottega del Gusto"],
      notes: "Focus su reel cucina e stories giornaliere con menù del giorno.",
      updatedAt: createdAt,
    },
    [dentistaId]: {
      clientId: dentistaId,
      objectives: "Incrementare lead per sbiancamento e prima visita.",
      targetAudience: "Famiglie e professionisti 30-60 anni in area urbana.",
      toneOfVoice: "Professionale e rassicurante.",
      brandVoice: "Competenza clinica con approccio empatico.",
      colorPalette: ["#0284C7", "#E0F2FE"],
      fonts: ["Inter"],
      competitors: [],
      notes: "Brief iniziale parziale: in attesa linee guida visual complete.",
      updatedAt: createdAt,
    },
    [modaId]: {
      clientId: modaId,
      objectives: "Mantenere community attiva in vista del rilancio stagionale.",
      targetAudience: "Donne 18-35, interessate a streetwear e capsule collection.",
      toneOfVoice: "Ispirazionale e trendy.",
      brandVoice: "Minimal chic con taglio editoriale.",
      colorPalette: ["#DB2777", "#111827", "#F9A8D4"],
      fonts: ["Inter", "Montserrat"],
      competitors: ["Urban Chic Store", "Capsule District", "Milano Street Lab"],
      notes: "Piano editoriale pronto per riattivazione campagna in 30 giorni.",
      updatedAt: createdAt,
    },
  };

  const posts: Record<string, EditorialPost[]> = {
    [ristoranteId]: [
      {
        id: makeId(),
        clientId: ristoranteId,
        title: "Pasta fresca del giorno",
        caption: "Dietro le quinte della nostra pasta fatta a mano.",
        platform: "instagram",
        status: "published",
        scheduledDate: nowIso(),
        mediaUrls: [],
        hashtags: ["#trattoria", "#pastafresca"],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: makeId(),
        clientId: ristoranteId,
        title: "Promo pranzo business",
        caption: "Menu veloce per pausa pranzo in centro.",
        platform: "facebook",
        status: "approved",
        scheduledDate: nowIso(),
        mediaUrls: [],
        hashtags: ["#pranzo", "#pesaro"],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: makeId(),
        clientId: ristoranteId,
        title: "Reel chef tips",
        caption: "3 consigli dello chef per una carbonara perfetta.",
        platform: "instagram",
        status: "pending_approval",
        scheduledDate: nowIso(),
        mediaUrls: [],
        hashtags: ["#chef", "#cucinaitaliana"],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: makeId(),
        clientId: ristoranteId,
        title: "Evento degustazione vini",
        caption: "Serata speciale con cantine marchigiane.",
        platform: "facebook",
        status: "draft",
        scheduledDate: nowIso(),
        mediaUrls: [],
        hashtags: ["#vino", "#eventi"],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: makeId(),
        clientId: ristoranteId,
        title: "Menu weekend",
        caption: "I piatti speciali del fine settimana.",
        platform: "instagram",
        status: "rejected",
        scheduledDate: nowIso(),
        mediaUrls: [],
        hashtags: ["#weekend", "#food"],
        createdAt,
        updatedAt: createdAt,
      },
    ],
    [dentistaId]: [
      {
        id: makeId(),
        clientId: dentistaId,
        title: "FAQ sbiancamento dentale",
        caption: "Risposte alle domande più frequenti.",
        platform: "instagram",
        status: "draft",
        scheduledDate: nowIso(),
        mediaUrls: [],
        hashtags: ["#sorriso", "#dentista"],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: makeId(),
        clientId: dentistaId,
        title: "Prima visita: cosa aspettarsi",
        caption: "Guida semplice al primo appuntamento.",
        platform: "facebook",
        status: "draft",
        scheduledDate: nowIso(),
        mediaUrls: [],
        hashtags: ["#salutedentale"],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: makeId(),
        clientId: dentistaId,
        title: "Intervista al medico",
        caption: "Focus prevenzione e igiene orale.",
        platform: "linkedin",
        status: "draft",
        scheduledDate: nowIso(),
        mediaUrls: [],
        hashtags: ["#odontoiatria"],
        createdAt,
        updatedAt: createdAt,
      },
    ],
    [modaId]: Array.from({ length: 8 }).map((_, idx) => ({
      id: makeId(),
      clientId: modaId,
      title: `Lookbook capsule #${idx + 1}`,
      caption: "Anteprima collezione con focus texture e styling.",
      platform: idx % 2 === 0 ? "instagram" : "tiktok",
      status: idx < 3 ? "published" : idx < 6 ? "approved" : "draft",
      scheduledDate: nowIso(),
      mediaUrls: [],
      hashtags: ["#fashion", "#style", "#capsule"],
      createdAt,
      updatedAt: createdAt,
    })),
  };

  const analytics: Record<string, ClientAnalytics> = {
    [ristoranteId]: {
      clientId: ristoranteId,
      period: "ultimo_30_giorni",
      followers: 12480,
      followersGrowth: 4.2,
      reach: 86200,
      impressions: 124900,
      engagementRate: 5.4,
      postsPublished: 19,
      updatedAt: createdAt,
    },
    [dentistaId]: {
      clientId: dentistaId,
      period: "ultimo_30_giorni",
      followers: 3210,
      followersGrowth: 1.1,
      reach: 18700,
      impressions: 25100,
      engagementRate: 2.9,
      postsPublished: 6,
      updatedAt: createdAt,
    },
    [modaId]: {
      clientId: modaId,
      period: "ultimo_30_giorni",
      followers: 28100,
      followersGrowth: -0.6,
      reach: 105400,
      impressions: 162700,
      engagementRate: 3.7,
      postsPublished: 12,
      updatedAt: createdAt,
    },
  };

  const competitors: Record<string, Competitor[]> = {
    [ristoranteId]: [
      {
        id: makeId(),
        clientId: ristoranteId,
        name: "Osteria del Porto",
        profileUrl: "https://instagram.com/osteriadelporto",
        platform: "instagram",
        followers: 9400,
        engagementRate: 4.1,
        postsPerWeek: 4,
        notes: "Molto forte su format reel ricette.",
      },
      {
        id: makeId(),
        clientId: ristoranteId,
        name: "Bottega del Gusto",
        profileUrl: "https://facebook.com/bottegadelgusto",
        platform: "facebook",
        followers: 6800,
        engagementRate: 3.5,
        postsPerWeek: 5,
        notes: "Buon livello di community management.",
      },
    ],
    [dentistaId]: [],
    [modaId]: [
      {
        id: makeId(),
        clientId: modaId,
        name: "Urban Chic Store",
        profileUrl: "https://instagram.com/urbanchicstore",
        platform: "instagram",
        followers: 56200,
        engagementRate: 3.4,
        postsPerWeek: 6,
        notes: "Feed molto coerente sul visual.",
      },
      {
        id: makeId(),
        clientId: modaId,
        name: "Capsule District",
        profileUrl: "https://facebook.com/capsuledistrict",
        platform: "facebook",
        followers: 18400,
        engagementRate: 2.1,
        postsPerWeek: 3,
        notes: "Più spinta su promo e ads.",
      },
      {
        id: makeId(),
        clientId: modaId,
        name: "Milano Street Lab",
        profileUrl: "https://linkedin.com/company/milano-street-lab",
        platform: "linkedin",
        followers: 7200,
        engagementRate: 1.8,
        postsPerWeek: 2,
        notes: "Ottimo posizionamento B2B e employer branding.",
      },
    ],
  };

  return {
    clients,
    activeClientId: ristoranteId,
    briefs,
    posts,
    analytics,
    competitors,
  };
}

function loadStore(): ClientStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedStore();
    const parsed = JSON.parse(raw) as ClientStore;
    if (!Array.isArray(parsed.clients) || parsed.clients.length === 0) return seedStore();
    return parsed;
  } catch {
    return seedStore();
  }
}

export function ClientProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<ClientStore>(() => loadStore());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    // TODO: Replace localStorage persistence with backend API persistence.
  }, [store]);

  const activeClient = useMemo(
    () => store.clients.find((client) => client.id === store.activeClientId) ?? null,
    [store.clients, store.activeClientId],
  );
  const activeClientId = activeClient?.id ?? null;

  const brief = activeClientId ? store.briefs[activeClientId] ?? null : null;
  const posts = activeClientId ? store.posts[activeClientId] ?? [] : [];
  const analytics = activeClientId ? store.analytics[activeClientId] ?? null : null;
  const competitors = activeClientId ? store.competitors[activeClientId] ?? [] : [];

  const setActiveClient = useCallback((client: Client) => {
    setStore((prev) => ({ ...prev, activeClientId: client.id }));
  }, []);

  const updateBrief = useCallback((briefUpdates: Partial<ClientBrief>) => {
    setStore((prev) => {
      if (!prev.activeClientId) return prev;
      const current =
        prev.briefs[prev.activeClientId] ??
        ({
          clientId: prev.activeClientId,
          objectives: "",
          targetAudience: "",
          toneOfVoice: "",
          brandVoice: "",
          colorPalette: [],
          fonts: [],
          competitors: [],
          notes: "",
          updatedAt: nowIso(),
        } satisfies ClientBrief);
      return {
        ...prev,
        briefs: {
          ...prev.briefs,
          [prev.activeClientId]: {
            ...current,
            ...briefUpdates,
            clientId: prev.activeClientId,
            updatedAt: nowIso(),
          },
        },
      };
    });
  }, []);

  const addPost = useCallback((postInput: Omit<EditorialPost, "id" | "createdAt" | "updatedAt">): EditorialPost => {
    const timestamp = nowIso();
    const nextPost: EditorialPost = { ...postInput, id: makeId(), createdAt: timestamp, updatedAt: timestamp };
    setStore((prev) => {
      const current = prev.posts[postInput.clientId] ?? [];
      return {
        ...prev,
        posts: {
          ...prev.posts,
          [postInput.clientId]: [nextPost, ...current],
        },
      };
    });
    return nextPost;
  }, []);

  const updatePost = useCallback((id: string, updates: Partial<EditorialPost>) => {
    setStore((prev) => {
      if (!prev.activeClientId) return prev;
      const current = prev.posts[prev.activeClientId] ?? [];
      return {
        ...prev,
        posts: {
          ...prev.posts,
          [prev.activeClientId]: current.map((post) =>
            post.id === id ? { ...post, ...updates, id: post.id, updatedAt: nowIso() } : post,
          ),
        },
      };
    });
  }, []);

  const deletePost = useCallback((id: string) => {
    setStore((prev) => {
      if (!prev.activeClientId) return prev;
      const current = prev.posts[prev.activeClientId] ?? [];
      return {
        ...prev,
        posts: {
          ...prev.posts,
          [prev.activeClientId]: current.filter((post) => post.id !== id),
        },
      };
    });
  }, []);

  const addCompetitor = useCallback((competitorInput: Omit<Competitor, "id">) => {
    const next: Competitor = { ...competitorInput, id: makeId() };
    setStore((prev) => {
      const current = prev.competitors[competitorInput.clientId] ?? [];
      return {
        ...prev,
        competitors: {
          ...prev.competitors,
          [competitorInput.clientId]: [next, ...current],
        },
      };
    });
  }, []);

  const removeCompetitor = useCallback((id: string) => {
    setStore((prev) => {
      if (!prev.activeClientId) return prev;
      const current = prev.competitors[prev.activeClientId] ?? [];
      return {
        ...prev,
        competitors: {
          ...prev.competitors,
          [prev.activeClientId]: current.filter((competitor) => competitor.id !== id),
        },
      };
    });
  }, []);

  const refreshAnalytics = useCallback(async () => {
    if (!activeClientId) return;
    setIsLoading(true);
    try {
      setStore((prev) => {
        const current = prev.analytics[activeClientId];
        if (!current) return prev;
        const delta = Math.round((Math.random() * 2 - 1) * 200);
        const nextFollowers = Math.max(0, current.followers + delta);
        const growth = current.followers > 0 ? Number((((nextFollowers - current.followers) / current.followers) * 100).toFixed(1)) : 0;
        return {
          ...prev,
          analytics: {
            ...prev.analytics,
            [activeClientId]: {
              ...current,
              followers: nextFollowers,
              followersGrowth: growth,
              updatedAt: nowIso(),
            },
          },
        };
      });
      // TODO: Replace mock analytics refresh with backend API request.
      await new Promise((resolve) => setTimeout(resolve, 250));
    } finally {
      setIsLoading(false);
    }
  }, [activeClientId]);

  const createClient = useCallback((input: { name: string; industry: string; color?: string }) => {
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
      activeClientId: newClient.id,
      briefs: {
        ...prev.briefs,
        [newClient.id]: {
          clientId: newClient.id,
          objectives: "",
          targetAudience: "",
          toneOfVoice: "",
          brandVoice: "",
          colorPalette: [],
          fonts: [],
          competitors: [],
          notes: "",
          updatedAt: nowIso(),
        },
      },
      posts: {
        ...prev.posts,
        [newClient.id]: [],
      },
      analytics: {
        ...prev.analytics,
        [newClient.id]: {
          clientId: newClient.id,
          period: "ultimo_30_giorni",
          followers: 0,
          followersGrowth: 0,
          reach: 0,
          impressions: 0,
          engagementRate: 0,
          postsPublished: 0,
          updatedAt: nowIso(),
        },
      },
      competitors: {
        ...prev.competitors,
        [newClient.id]: [],
      },
    }));
    // TODO: Replace local client creation with POST /clients backend endpoint.
  }, []);

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
    let alive = true;
    const loadPortalClients = async () => {
      try {
        const response = await portalFetch("/api/clients", { credentials: "include" });
        if (!response.ok) return;
        const raw = await response.json();
        if (!Array.isArray(raw) || !alive) return;
        const mapped = raw
          .filter((c: any) => c?.id != null && String(c?.name ?? "").trim().length > 0)
          .map((c: any) => ({
            id: String(c.id),
            name: String(c.name),
            logo: c.logoUrl ?? undefined,
            color: c.brandColor ?? c.color ?? "#4F46E5",
            industry: String(c.settore ?? c.company ?? c.industry ?? "Generico"),
            status: "active" as const,
            createdAt: String(c.createdAt ?? nowIso()),
          }));
        importClients(mapped);
      } catch {
        // Keep local-only context if backend is unreachable.
      }
    };
    void loadPortalClients();
    return () => {
      alive = false;
    };
  }, [importClients]);

  const value: ClientContextType = {
    clients: store.clients,
    activeClient,
    brief,
    posts,
    analytics,
    competitors,
    isLoading,
    setActiveClient,
    updateBrief,
    addPost,
    updatePost,
    deletePost,
    addCompetitor,
    removeCompetitor,
    refreshAnalytics,
    createClient,
    importClients,
  };

  return <ClientContext.Provider value={value}>{children}</ClientContext.Provider>;
}

export function useClientContext(): ClientContextType {
  const ctx = useContext(ClientContext);
  if (!ctx) {
    throw new Error("useClientContext must be used within ClientProvider");
  }
  return ctx;
}
