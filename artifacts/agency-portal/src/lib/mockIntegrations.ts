// Dati mock realistici per Meta (Facebook/Instagram) e Google Ads
// Struttura pronta per essere sostituita con chiamate API reali

export type DateRange = "7d" | "30d" | "90d" | "custom";

function generateDates(days: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" }));
  }
  return dates;
}

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateTrend(base: number, days: number, volatility = 0.05): number[] {
  const values: number[] = [];
  let current = base;
  for (let i = 0; i < days; i++) {
    const change = current * volatility * (Math.random() - 0.4);
    current = Math.max(0, current + change);
    values.push(Math.round(current));
  }
  return values;
}

// ── Instagram/Facebook mock ──────────────────────────────────────

export function getInstagramData(range: DateRange) {
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const labels = generateDates(days);

  const followerBase = 12400;
  const followers = generateTrend(followerBase, days, 0.008);

  return {
    accountName: "modamilano_official",
    platform: "Instagram",
    summary: {
      followers: 12847,
      followerGrowth: 447,
      followerGrowthPct: 3.6,
      reach: 89340,
      impressions: 134200,
      engagementRate: 4.2,
      totalEngagements: 3752,
    },
    followerTrend: {
      labels,
      data: followers,
    },
    reachTrend: {
      labels,
      data: generateTrend(89340 / days, days, 0.15),
    },
    topPosts: [
      {
        id: "p1",
        description: "Lancio nuova collezione primavera 🌸",
        date: "02 apr 2026",
        likes: 842,
        comments: 67,
        shares: 34,
        saves: 211,
        reach: 8400,
        engagement: 1154,
        type: "carosello",
      },
      {
        id: "p2",
        description: "Behind the scenes shooting Milano",
        date: "28 mar 2026",
        likes: 634,
        comments: 42,
        shares: 18,
        saves: 98,
        reach: 6200,
        engagement: 792,
        type: "video",
      },
      {
        id: "p3",
        description: "Outfit del giorno — total look verde",
        date: "25 mar 2026",
        likes: 512,
        comments: 29,
        shares: 12,
        saves: 76,
        reach: 4800,
        engagement: 629,
        type: "foto",
      },
      {
        id: "p4",
        description: "Intervista con la stylist Giulia Neri",
        date: "20 mar 2026",
        likes: 397,
        comments: 53,
        shares: 22,
        saves: 44,
        reach: 3900,
        engagement: 516,
        type: "reels",
      },
    ],
    postEngagement: {
      labels: ["Lancio collezione", "Behind scenes", "Outfit OOTD", "Intervista", "Stories Q&A", "Giveaway"],
      likes: [842, 634, 512, 397, 289, 731],
      comments: [67, 42, 29, 53, 38, 94],
      saves: [211, 98, 76, 44, 31, 145],
    },
    stories: {
      views: 4830,
      replies: 127,
      exits: 340,
      completionRate: 68,
    },
  };
}

// ── Meta Ads mock ────────────────────────────────────────────────

export function getMetaAdsData(range: DateRange) {
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const labels = generateDates(days);

  const dailySpend = generateTrend(120, days, 0.18);
  const dailyConversions = generateTrend(8, days, 0.22);

  const totalSpend = dailySpend.reduce((a, b) => a + b, 0);
  const totalConversions = dailyConversions.reduce((a, b) => a + b, 0);

  return {
    summary: {
      totalSpend,
      impressions: randomBetween(180000, 220000),
      reach: randomBetween(95000, 115000),
      clicks: randomBetween(4200, 5800),
      ctr: 2.8,
      cpm: 5.4,
      cpc: 0.92,
      conversions: totalConversions,
      roas: 4.2,
      conversionValue: Math.round(totalSpend * 4.2),
    },
    spendTrend: {
      labels,
      spend: dailySpend,
      conversions: dailyConversions,
    },
    budgetDistribution: {
      labels: ["Brand Awareness", "Retargeting", "Conversioni", "Lead Gen"],
      data: [35, 25, 30, 10],
      colors: ["#7a8f5c", "#a4b87a", "#4a6741", "#c8d9a0"],
    },
    campaigns: [
      {
        id: "mc1",
        name: "Primavera 2026 — Brand Awareness",
        status: "active",
        budget: 50,
        spend: 1840,
        impressions: 87200,
        reach: 54300,
        clicks: 1840,
        ctr: 2.11,
        cpm: 4.9,
        cpc: 0.76,
        conversions: 42,
        roas: 3.8,
      },
      {
        id: "mc2",
        name: "Retargeting Visitatori Sito",
        status: "active",
        budget: 30,
        spend: 892,
        impressions: 34100,
        reach: 18900,
        clicks: 1124,
        ctr: 3.3,
        cpm: 3.8,
        cpc: 0.55,
        conversions: 87,
        roas: 6.1,
      },
      {
        id: "mc3",
        name: "Conversioni E-commerce",
        status: "active",
        budget: 70,
        spend: 2240,
        impressions: 52000,
        reach: 31400,
        clicks: 1890,
        ctr: 3.63,
        cpm: 6.2,
        cpc: 1.18,
        conversions: 134,
        roas: 5.2,
      },
      {
        id: "mc4",
        name: "Lead Generation Newsletter",
        status: "paused",
        budget: 20,
        spend: 310,
        impressions: 8900,
        reach: 6700,
        clicks: 218,
        ctr: 2.45,
        cpm: 5.1,
        cpc: 1.42,
        conversions: 31,
        roas: 2.1,
      },
    ],
  };
}

// ── Google Ads mock ──────────────────────────────────────────────

export function getGoogleAdsData(range: DateRange) {
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const labels = generateDates(days);

  const dailyClicks = generateTrend(95, days, 0.2);
  const dailyConversions = generateTrend(6, days, 0.25);

  const totalClicks = dailyClicks.reduce((a, b) => a + b, 0);
  const totalConversions = dailyConversions.reduce((a, b) => a + b, 0);
  const totalSpend = totalClicks * 1.24;

  return {
    summary: {
      impressions: randomBetween(95000, 130000),
      clicks: totalClicks,
      ctr: 3.1,
      avgCpc: 1.24,
      totalSpend,
      conversions: totalConversions,
      convRate: 6.3,
      qualityScore: 7.4,
    },
    clicksTrend: {
      labels,
      clicks: dailyClicks,
      conversions: dailyConversions,
    },
    campaigns: [
      {
        id: "gc1",
        name: "Brand Search — Moda Milano",
        type: "Rete di ricerca",
        status: "active",
        budget: 25,
        spend: 712,
        impressions: 34200,
        clicks: 1840,
        ctr: 5.38,
        avgCpc: 0.87,
        conversions: 124,
        convRate: 6.7,
        qualityScore: 9,
      },
      {
        id: "gc2",
        name: "Shopping — Collezione Primavera",
        type: "Shopping",
        status: "active",
        budget: 40,
        spend: 1340,
        impressions: 54100,
        clicks: 2100,
        ctr: 3.88,
        avgCpc: 0.64,
        conversions: 89,
        convRate: 4.2,
        qualityScore: 8,
      },
      {
        id: "gc3",
        name: "Display Remarketing",
        type: "Display",
        status: "active",
        budget: 15,
        spend: 430,
        impressions: 87000,
        clicks: 940,
        ctr: 1.08,
        avgCpc: 0.46,
        conversions: 34,
        convRate: 3.6,
        qualityScore: 7,
      },
      {
        id: "gc4",
        name: "Performance Max",
        type: "Performance Max",
        status: "active",
        budget: 60,
        spend: 1890,
        impressions: 43200,
        clicks: 1560,
        ctr: 3.61,
        avgCpc: 1.21,
        conversions: 98,
        convRate: 6.3,
        qualityScore: 8,
      },
    ],
  };
}
