export interface IdeasRequest {
  clientId: string;
  brief: {
    industry: string;
    objectives: string;
    targetAudience: string;
    toneOfVoice: string;
    brandVoice: string[];
    platforms: string[];
    topicsToAvoid: string;
    topicsToTreat: string[];
  };
  competitors: {
    name: string;
    observedStrategy?: string;
    strengths: string[];
  }[];
  context: {
    period: string;
    seasonalEvents: string[];
    campaignObjective: string;
    focusPlatform?: string;
    contentMix: {
      reels: number;
      carousels: number;
      photos: number;
      stories: number;
    };
    weekCount: number;
    postsPerWeek: number;
  };
  options: {
    count: number;
    includeCaption: boolean;
    includeCTA: boolean;
    language: "italian" | "english";
    creativityLevel: "safe" | "balanced" | "bold";
  };
}

export interface ContentIdea {
  id: string;
  title: string;
  description: string;
  platform: string;
  format: string;
  objective: string;
  hook: string;
  captionDraft?: string;
  cta?: string;
  visualSuggestion: string;
  hashtags: string[];
  estimatedEngagement: "low" | "medium" | "high";
  reasoning: string;
  tags: string[];
}

export interface WeeklyPlan {
  weekCount: number;
  postsPerWeek: number;
}

export interface IdeasResponse {
  ideas: ContentIdea[];
  weeklyDistribution?: WeeklyPlan;
  tokensUsed: number;
  generatedAt: string;
}

export interface PlanRequest {
  clientId: string;
  brief: IdeasRequest["brief"];
  competitors: IdeasRequest["competitors"];
  planConfig: {
    startDate: string;
    weekCount: number;
    postsPerWeek: number;
    platforms: {
      platform: string;
      postsPerWeek: number;
      preferredDays: string[];
      preferredTime: string;
    }[];
    campaignTheme?: string;
    seasonalEvents: string[];
  };
}

export interface PlanResponse {
  weeks: {
    weekNumber: number;
    startDate: string;
    theme: string;
    posts: {
      id: string;
      title: string;
      caption: string;
      platform: string;
      format: string;
      scheduledDate: string;
      scheduledTime: string;
      hashtags: string[];
      visualSuggestion: string;
      status: "draft";
    }[];
  }[];
  summary: {
    totalPosts: number;
    byPlatform: Record<string, number>;
    byFormat: Record<string, number>;
    coveragePercent: number;
  };
  tokensUsed: number;
}

export interface CampaignRequest {
  clientId: string;
  brief: IdeasRequest["brief"];
  campaignDetails: {
    theme: string;
    duration: string;
    mainObjective: string;
    budget?: string;
    includeOrganic: boolean;
    includePaid: boolean;
  };
}

export interface CampaignResponse {
  phases: {
    teaser: {
      objective: string;
      keyMessage: string;
      tone?: string;
      contents: Array<{ title: string; platform: string; format: string }>;
    };
    launch: {
      objective: string;
      keyMessage: string;
      heroPost?: string;
      contents: Array<{ title: string; platform: string; format: string }>;
    };
    followUp: {
      objective: string;
      keyMessage: string;
      contents: Array<{ title: string; platform: string; format: string }>;
      successMetrics: string[];
    };
  };
  keyMessages: string[];
  campaignHashtags: string[];
  metrics: string[];
  visualSuggestions: string[];
  tokensUsed: number;
  generatedAt: string;
}

export interface CampaignToPlanPrefill {
  theme?: string;
  weekCount?: number;
  seasonalEvents?: string[];
  weekThemes?: string[];
  platformSuggestions?: Array<{
    platform: string;
    postsPerWeek: number;
  }>;
}
