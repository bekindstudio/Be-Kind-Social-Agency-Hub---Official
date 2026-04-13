import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { portalFetch } from "@workspace/api-client-react";
import type {
  AnalyticsPeriod,
  Client,
  ClientAnalytics,
  ClientBrief,
  ClientEvent,
  ClientContextType,
  Competitor,
  EditorialPost,
} from "@/types/client";

const STORAGE_KEY = "agency_hub_data";

type ClientStore = {
  clients: Client[];
  activeClientId: string | null;
  metaAccountIds: Record<string, string | null>;
  briefs: Record<string, ClientBrief>;
  posts: Record<string, EditorialPost[]>;
  analytics: Record<string, ClientAnalytics>;
  competitors: Record<string, Competitor[]>;
  events: Record<string, ClientEvent[]>;
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

function getLastNDates(days: number): string[] {
  return Array.from({ length: days }, (_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - idx));
    return d.toISOString().slice(0, 10);
  });
}

function generateDailyData(baseFollowers: number, baseReach: number, baseImpressions: number, baseEngagement: number): ClientAnalytics["dailyData"] {
  const dates = getLastNDates(30);
  return dates.map((date, idx) => ({
    date,
    followers: Math.max(0, baseFollowers - (30 - idx) * 6 + Math.round(Math.random() * 18)),
    reach: Math.max(0, baseReach + Math.round(Math.sin(idx / 4) * 1200) + Math.round(Math.random() * 900)),
    impressions: Math.max(0, baseImpressions + Math.round(Math.cos(idx / 5) * 1800) + Math.round(Math.random() * 1300)),
    engagement: Math.max(0, Number((baseEngagement + Math.sin(idx / 6) * 0.6 + Math.random() * 0.4).toFixed(2))),
  }));
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
      accountId: "ig_demo_ristorante",
      period: "ultimo_30_giorni",
      followers: 12480,
      followersPrevious: 11980,
      followersGrowth: 4.2,
      reach: 86200,
      reachPrevious: 80300,
      impressions: 124900,
      engagementRate: 5.4,
      engagementRatePrevious: 4.8,
      postsPublished: 19,
      profileViews: 4220,
      dailyData: generateDailyData(12200, 2600, 4100, 4.6),
      topPosts: [
        {
          id: makeId(),
          caption: "Reel carbonara originale",
          mediaType: "VIDEO",
          timestamp: nowIso(),
          likeCount: 740,
          commentsCount: 63,
          reach: 13400,
          engagementRate: 6.9,
        },
        {
          id: makeId(),
          caption: "Carosello menu degustazione",
          mediaType: "CAROUSEL_ALBUM",
          timestamp: nowIso(),
          likeCount: 610,
          commentsCount: 41,
          reach: 10110,
          engagementRate: 5.8,
        },
      ],
      updatedAt: createdAt,
    },
    [dentistaId]: {
      clientId: dentistaId,
      accountId: "ig_demo_dentista",
      period: "ultimo_30_giorni",
      followers: 3210,
      followersPrevious: 3175,
      followersGrowth: 1.1,
      reach: 18700,
      reachPrevious: 17550,
      impressions: 25100,
      engagementRate: 2.9,
      engagementRatePrevious: 2.6,
      postsPublished: 6,
      profileViews: 940,
      dailyData: generateDailyData(3150, 620, 880, 2.5),
      topPosts: [
        {
          id: makeId(),
          caption: "FAQ igiene orale",
          mediaType: "IMAGE",
          timestamp: nowIso(),
          likeCount: 141,
          commentsCount: 12,
          reach: 2210,
          engagementRate: 3.4,
        },
      ],
      updatedAt: createdAt,
    },
    [modaId]: {
      clientId: modaId,
      accountId: "ig_demo_moda",
      period: "ultimo_30_giorni",
      followers: 28100,
      followersPrevious: 28280,
      followersGrowth: -0.6,
      reach: 105400,
      reachPrevious: 110200,
      impressions: 162700,
      engagementRate: 3.7,
      engagementRatePrevious: 4.1,
      postsPublished: 12,
      profileViews: 8100,
      dailyData: generateDailyData(27900, 3300, 5100, 3.9),
      topPosts: [
        {
          id: makeId(),
          caption: "Reel lookbook urbano",
          mediaType: "VIDEO",
          timestamp: nowIso(),
          likeCount: 980,
          commentsCount: 77,
          reach: 18800,
          engagementRate: 4.9,
        },
        {
          id: makeId(),
          caption: "Post capsule nero/rosa",
          mediaType: "IMAGE",
          timestamp: nowIso(),
          likeCount: 650,
          commentsCount: 28,
          reach: 12600,
          engagementRate: 3.8,
        },
      ],
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
        followersPrevious: 9100,
        engagementRate: 4.1,
        postsPerWeek: 4,
        isPrimary: true,
        notes: "Molto forte su format reel ricette.",
        topContent: "Reel con preparazione primi piatti e audio trend.",
        observedStrategy: "Pubblicazione costante su format video brevi.",
        strengths: ["Video coinvolgenti", "Community attiva"],
        weaknesses: ["Call to action deboli"],
        updateHistory: [
          {
            date: createdAt,
            followers: 9400,
            engagementRate: 4.1,
            postsPerWeek: 4,
            note: "Baseline iniziale",
          },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: makeId(),
        clientId: ristoranteId,
        name: "Bottega del Gusto",
        profileUrl: "https://facebook.com/bottegadelgusto",
        platform: "facebook",
        followers: 6800,
        followersPrevious: 6700,
        engagementRate: 3.5,
        postsPerWeek: 5,
        isPrimary: false,
        notes: "Buon livello di community management.",
        topContent: "Foto piatti con promozioni weekend.",
        observedStrategy: "Mix tra promozioni e contenuti educational.",
        strengths: ["Calendario regolare"],
        weaknesses: ["Visual poco distintivo"],
        updateHistory: [
          {
            date: createdAt,
            followers: 6800,
            engagementRate: 3.5,
            postsPerWeek: 5,
            note: "Baseline iniziale",
          },
        ],
        createdAt,
        updatedAt: createdAt,
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
        followersPrevious: 55000,
        engagementRate: 3.4,
        postsPerWeek: 6,
        isPrimary: true,
        notes: "Feed molto coerente sul visual.",
        topContent: "Reel transizioni outfit con creator locali.",
        observedStrategy: "Spinta su collaborazioni micro influencer.",
        strengths: ["Coerenza visual", "Video trend"],
        weaknesses: ["Copy poco approfonditi"],
        updateHistory: [
          {
            date: createdAt,
            followers: 56200,
            engagementRate: 3.4,
            postsPerWeek: 6,
            note: "Baseline iniziale",
          },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: makeId(),
        clientId: modaId,
        name: "Capsule District",
        profileUrl: "https://facebook.com/capsuledistrict",
        platform: "facebook",
        followers: 18400,
        followersPrevious: 18100,
        engagementRate: 2.1,
        postsPerWeek: 3,
        isPrimary: false,
        notes: "Più spinta su promo e ads.",
        topContent: "Post carosello promo bundle stagionali.",
        observedStrategy: "Contenuti orientati a conversione diretta.",
        strengths: ["Offerte chiare"],
        weaknesses: ["Bassa retention organica"],
        updateHistory: [
          {
            date: createdAt,
            followers: 18400,
            engagementRate: 2.1,
            postsPerWeek: 3,
            note: "Baseline iniziale",
          },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: makeId(),
        clientId: modaId,
        name: "Milano Street Lab",
        profileUrl: "https://linkedin.com/company/milano-street-lab",
        platform: "linkedin",
        followers: 7200,
        followersPrevious: 7000,
        engagementRate: 1.8,
        postsPerWeek: 2,
        isPrimary: false,
        notes: "Ottimo posizionamento B2B e employer branding.",
        topContent: "Case study visual merchandising retail.",
        observedStrategy: "Approccio thought leadership e brand authority.",
        strengths: ["Contenuti verticali"],
        weaknesses: ["Frequenza ridotta"],
        updateHistory: [
          {
            date: createdAt,
            followers: 7200,
            engagementRate: 1.8,
            postsPerWeek: 2,
            note: "Baseline iniziale",
          },
        ],
        createdAt,
        updatedAt: createdAt,
      },
    ],
  };

  const events: Record<string, ClientEvent[]> = {
    [ristoranteId]: [
      {
        id: makeId(),
        clientId: ristoranteId,
        title: "Degustazione vini primaverile",
        date: new Date(new Date().getFullYear(), new Date().getMonth(), 18, 18, 30).toISOString(),
        type: "campaign",
        priority: "high",
        note: "Reminder: preparare stories teaser 5 giorni prima.",
        createdAt,
        updatedAt: createdAt,
      },
    ],
    [dentistaId]: [
      {
        id: makeId(),
        clientId: dentistaId,
        title: "Open day prevenzione",
        date: new Date(new Date().getFullYear(), new Date().getMonth(), 24, 9, 0).toISOString(),
        type: "launch",
        priority: "medium",
        note: "Confermare materiale promo e CTA.",
        createdAt,
        updatedAt: createdAt,
      },
    ],
    [modaId]: [
      {
        id: makeId(),
        clientId: modaId,
        title: "Lancio capsule summer",
        date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 5, 10, 0).toISOString(),
        type: "campaign",
        priority: "high",
        note: "Allineare shooting, ads e countdown.",
        createdAt,
        updatedAt: createdAt,
      },
    ],
  };

  return {
    clients,
    activeClientId: ristoranteId,
    metaAccountIds: {
      [ristoranteId]: "ig_demo_ristorante",
      [dentistaId]: "ig_demo_dentista",
      [modaId]: "ig_demo_moda",
    },
    briefs,
    posts,
    analytics,
    competitors,
    events,
  };
}

function loadStore(): ClientStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedStore();
    const parsed = JSON.parse(raw) as ClientStore;
    if (!Array.isArray(parsed.clients) || parsed.clients.length === 0) return seedStore();
    return {
      ...parsed,
      metaAccountIds: parsed.metaAccountIds ?? {},
      events: parsed.events ?? {},
    };
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
  const clientEvents = activeClientId ? store.events[activeClientId] ?? [] : [];
  const allClientEvents = useMemo(
    () => Object.values(store.events ?? {}).flat().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [store.events],
  );
  const metaAccountId = activeClientId ? store.metaAccountIds[activeClientId] ?? null : null;

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

  const updateCompetitor = useCallback((id: string, updates: Partial<Competitor>) => {
    setStore((prev) => {
      if (!prev.activeClientId) return prev;
      const current = prev.competitors[prev.activeClientId] ?? [];
      return {
        ...prev,
        competitors: {
          ...prev.competitors,
          [prev.activeClientId]: current.map((competitor) =>
            competitor.id === id
              ? { ...competitor, ...updates, id: competitor.id, clientId: competitor.clientId, updatedAt: nowIso() }
              : competitor,
          ),
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

  const addClientEvent = useCallback((eventInput: Omit<ClientEvent, "id" | "createdAt" | "updatedAt">): ClientEvent => {
    const timestamp = nowIso();
    const nextEvent: ClientEvent = {
      ...eventInput,
      id: makeId(),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    setStore((prev) => {
      const current = prev.events[eventInput.clientId] ?? [];
      return {
        ...prev,
        events: {
          ...prev.events,
          [eventInput.clientId]: [...current, nextEvent].sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
          ),
        },
      };
    });
    return nextEvent;
  }, []);

  const updateClientEvent = useCallback((id: string, updates: Partial<ClientEvent>) => {
    setStore((prev) => {
      if (!prev.activeClientId) return prev;
      const current = prev.events[prev.activeClientId] ?? [];
      return {
        ...prev,
        events: {
          ...prev.events,
          [prev.activeClientId]: current
            .map((event) => (event.id === id ? { ...event, ...updates, id: event.id, updatedAt: nowIso() } : event))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
        },
      };
    });
  }, []);

  const deleteClientEvent = useCallback((id: string) => {
    setStore((prev) => {
      if (!prev.activeClientId) return prev;
      const current = prev.events[prev.activeClientId] ?? [];
      return {
        ...prev,
        events: {
          ...prev.events,
          [prev.activeClientId]: current.filter((event) => event.id !== id),
        },
      };
    });
  }, []);

  const setMetaAccountId = useCallback((id: string | null) => {
    setStore((prev) => {
      if (!prev.activeClientId) return prev;
      return {
        ...prev,
        metaAccountIds: {
          ...prev.metaAccountIds,
          [prev.activeClientId]: id,
        },
      };
    });
  }, []);

  const refreshAnalytics = useCallback(async (period: AnalyticsPeriod = "30d") => {
    if (!activeClientId) return;
    setIsLoading(true);
    try {
      const rangeToPeriod: Record<AnalyticsPeriod, string> = {
        "7d": "day",
        "30d": "month",
        "90d": "month",
        custom: "month",
      };
      const activeAccountId = store.metaAccountIds[activeClientId] ?? null;
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
          const insights = (await insightsRes.json()) as Array<any>;
          const postsPayload = (await postsRes.json()) as Array<any>;
          setStore((prev) => {
            const current = prev.analytics[activeClientId];
            if (!current) return prev;
            const followers = insights.at(-1)?.followerCount ?? current.followers;
            const followersPrevious = insights.at(0)?.followerCount ?? current.followersPrevious;
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
            const growthBase = followersPrevious > 0 ? ((followers - followersPrevious) / followersPrevious) * 100 : 0;
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
                    date: item.date,
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
              period,
              updatedAt: nowIso(),
            },
          },
        };
      });
      // TODO: Replace fallback mock analytics refresh with a dedicated backend endpoint.
      await new Promise((resolve) => setTimeout(resolve, 250));
    } finally {
      setIsLoading(false);
    }
  }, [activeClientId, store.metaAccountIds]);

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
          dailyData: generateDailyData(0, 0, 0, 0),
          topPosts: [],
          updatedAt: nowIso(),
        },
      },
      metaAccountIds: {
        ...prev.metaAccountIds,
        [newClient.id]: null,
      },
      competitors: {
        ...prev.competitors,
        [newClient.id]: [],
      },
      events: {
        ...prev.events,
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
    clientEvents,
    allClientEvents,
    metaAccountId,
    isLoading,
    setActiveClient,
    updateBrief,
    addPost,
    updatePost,
    deletePost,
    addCompetitor,
    updateCompetitor,
    removeCompetitor,
    addClientEvent,
    updateClientEvent,
    deleteClientEvent,
    refreshAnalytics,
    setMetaAccountId,
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
