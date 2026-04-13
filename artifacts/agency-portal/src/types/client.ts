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

export interface ClientContextType {
  clients: Client[];
  activeClient: Client | null;
  brief: ClientBrief | null;
  posts: EditorialPost[];
  analytics: ClientAnalytics | null;
  competitors: Competitor[];
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
  refreshAnalytics: (period?: AnalyticsPeriod) => Promise<void>;
  setMetaAccountId: (id: string | null) => void;
  createClient: (input: { name: string; industry: string; color?: string }) => void;
  importClients: (clients: Client[]) => void;
}
