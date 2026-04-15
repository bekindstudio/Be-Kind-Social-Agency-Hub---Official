export interface Client {
  id: string;
  name: string;
  logo?: string;
  color?: string;
  industry: string;
  status: "active" | "paused" | "archived";
  createdAt: string;
}

export interface ClientBrief {
  clientId: string;
  objectives: string;
  targetAudience: string;
  toneOfVoice: string;
  brandVoice: string;
  colorPalette: string[];
  fonts: string[];
  competitors: string[];
  notes: string;
  updatedAt: string;
  companyDescription?: string;
  industryOverride?: string;
  website?: string;
  foundationYear?: string;
  primaryObjective?: string;
  secondaryObjectives?: string;
  kpis?: BriefKpi[];
  targetAge?: string;
  targetGender?: "Misto" | "Prevalentemente maschile" | "Prevalentemente femminile";
  lifestyle?: string;
  interests?: string[];
  geolocation?: string;
  painPoints?: string;
  toneOfVoiceType?: "Professionale" | "Amichevole" | "Ironico" | "Ispirazionale" | "Lusso" | "Educativo";
  toneOfVoiceNotes?: string;
  brandAdjectives?: string[];
  brandDonts?: string;
  colorLabels?: string[];
  fontTitles?: string;
  fontBody?: string;
  activePlatforms?: SocialPlatform[];
  platformFrequencies?: Record<string, string>;
  formatPreferences?: ContentFormat[];
  topicsToCover?: string[];
  topicsToAvoid?: string[];
  brandHashtags?: string[];
  hashtags?: string[];
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  approvalWindow?: string;
  internalNotes?: string;
  usefulLinks?: string[];
}

export interface BriefKpi {
  label: string;
  target: string;
  unit: string;
}

export type SocialPlatform = "instagram" | "facebook" | "linkedin" | "tiktok" | "x" | "youtube";
export type ContentFormat = "Post foto" | "Carosello" | "Reel/Video" | "Stories" | "Live" | "Articoli";
export type AnalyticsPeriod = "7d" | "30d" | "90d" | "custom";

export interface EditorialPost {
  id: string;
  clientId: string;
  title: string;
  caption: string;
  platform: "instagram" | "facebook" | "linkedin" | "tiktok" | "x" | "youtube";
  status: "draft" | "pending_approval" | "approved" | "published" | "rejected";
  scheduledDate: string;
  mediaUrls: string[];
  hashtags: string[];
  internalNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientAnalytics {
  clientId: string;
  accountId?: string;
  period: string;
  followers: number;
  followersPrevious: number;
  followersGrowth: number;
  reach: number;
  reachPrevious: number;
  impressions: number;
  engagementRate: number;
  engagementRatePrevious: number;
  postsPublished: number;
  profileViews?: number;
  dailyData: {
    date: string;
    followers: number;
    reach: number;
    impressions: number;
    engagement: number;
  }[];
  topPosts: {
    id: string;
    caption: string;
    mediaType: string;
    timestamp: string;
    likeCount: number;
    commentsCount: number;
    reach: number;
    engagementRate: number;
    thumbnailUrl?: string;
  }[];
  updatedAt: string;
}

export interface Competitor {
  id: string;
  clientId: string;
  name: string;
  profileUrl: string;
  platform: "instagram" | "facebook" | "linkedin" | "tiktok" | "x";
  followers: number;
  followersPrevious?: number;
  engagementRate: number;
  postsPerWeek: number;
  isPrimary: boolean;
  notes: string;
  topContent?: string;
  observedStrategy?: string;
  strengths: string[];
  weaknesses: string[];
  updateHistory: {
    date: string;
    followers: number;
    engagementRate: number;
    postsPerWeek: number;
    note?: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface ClientEvent {
  id: string;
  clientId: string;
  title: string;
  date: string;
  endDate?: string;
  type: "campaign" | "launch" | "deadline" | "meeting" | "other";
  priority: "low" | "medium" | "high";
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskRow {
  id: number;
  title: string;
  description?: string | null;
  projectId?: number | null;
  projectName?: string | null;
  assigneeId?: number | null;
  assigneeName?: string | null;
  status: string;
  priority: string;
  dueDate?: string | null;
  tipo: string;
  categoria?: string | null;
  checklistJson: string;
  pacchettoContenuti?: string | null;
  meseRiferimento?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskComment {
  id: number;
  taskId: number;
  userId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface TaskActivityItem {
  id: number;
  action: string;
  entityType: string;
  entityId: number;
  entityName: string | null;
  details: string | null;
  userId: string | null;
  userName: string | null;
  createdAt: string;
}

export interface ReportCreateForm {
  clientId: string;
  tipo: string;
  period: string;
  customFrom: string;
  customTo: string;
  title: string;
  riepilogoEsecutivo: string;
  analisiInsights: string;
  strategiaProssimoPeriodo: string;
  noteAggiuntive: string;
}

export interface ReportDetailState {
  id: number;
  clientId: number;
  status: string;
  tipo: string;
  period: string;
  periodLabel: string;
  titolo?: string;
  riepilogoEsecutivo?: string;
  analisiInsights?: string;
  strategiaProssimoPeriodo?: string;
  noteAggiuntive?: string;
  aiSummary?: string;
  aiFlag?: boolean;
  aiFlags?: string[];
  recipientEmail?: string;
  subject?: string;
  sentAt?: string;
  inviatoAt?: string;
  createdAt?: string;
  clientName?: string;
  clientEmail?: string;
  approvals?: Array<{
    azione: string;
    nota?: string | null;
    createdAt?: string;
  }>;
  kpiSocialJson?: {
    summary?: {
      username?: string;
      followers?: number;
      followerGrowth?: number;
      followerGrowthPct?: number;
      reach?: number;
      impressions?: number;
      engagementRate?: number;
    };
    followerTrend?: { labels?: string[]; data?: number[] };
    postEngagement?: { labels?: string[]; likes?: number[]; comments?: number[]; saves?: number[] };
    topPosts?: unknown[];
    featuredPosts?: unknown[];
  } | null;
  kpiMetaJson?: {
    summary?: {
      totalSpend?: number;
      impressions?: number;
      reach?: number;
      ctr?: number;
      cpc?: number;
      roas?: number;
    };
    spendTrend?: { labels?: string[]; spend?: number[]; conversions?: number[] };
  } | null;
  kpiGoogleJson?: {
    summary?: {
      spend?: number;
      impressions?: number;
    };
  } | null;
  metricsJson?: {
    instagram?: unknown;
    metaAds?: unknown;
    googleAds?: unknown;
  } | null;
  topContenutiJson?: unknown[];
}

export interface ClientContextType {
  clients: Client[];
  activeClient: Client | null;
  brief: ClientBrief | null;
  briefsByClient: Record<string, ClientBrief>;
  posts: EditorialPost[];
  postsByClient: Record<string, EditorialPost[]>;
  analytics: ClientAnalytics | null;
  analyticsByClient: Record<string, ClientAnalytics>;
  competitors: Competitor[];
  clientEvents: ClientEvent[];
  allClientEvents: ClientEvent[];
  metaAccountId: string | null;
  isLoading: boolean;
  setActiveClient: (client: Client) => void;
  updateBrief: (brief: Partial<ClientBrief>) => void;
  addPost: (post: Omit<EditorialPost, "id" | "createdAt" | "updatedAt">) => EditorialPost;
  updatePost: (id: string, updates: Partial<EditorialPost>) => void;
  deletePost: (id: string) => void;
  addCompetitor: (competitor: Omit<Competitor, "id">) => void;
  updateCompetitor: (id: string, updates: Partial<Competitor>) => void;
  removeCompetitor: (id: string) => void;
  addClientEvent: (event: Omit<ClientEvent, "id" | "createdAt" | "updatedAt">) => ClientEvent;
  updateClientEvent: (id: string, updates: Partial<ClientEvent>) => void;
  deleteClientEvent: (id: string) => void;
  refreshAnalytics: (period?: AnalyticsPeriod) => Promise<void>;
  setMetaAccountId: (id: string | null) => void;
  createClient: (input: { name: string; industry: string; color?: string }) => void;
  importClients: (clients: Client[]) => void;
}
