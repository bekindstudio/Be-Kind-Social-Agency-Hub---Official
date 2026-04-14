import { Router, type IRouter } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { randomUUID } from "node:crypto";

const router: IRouter = Router();

interface CaptionRequest {
  clientId: string;
  brief: {
    toneOfVoice: string;
    brandVoice: string[];
    targetAudience: string;
    objectives: string;
    doNotSay: string;
    hashtags: string[];
  };
  postDetails: {
    theme: string;
    contentType: string;
    objective: string;
    platform: "instagram" | "facebook" | "linkedin" | "tiktok";
    additionalNotes?: string;
    keywords?: string[];
  };
  options: {
    length: "short" | "medium" | "long";
    includeHashtags: boolean;
    includeEmoji: boolean;
    language: "italian" | "english";
    variants: number;
  };
}

interface ImproveRequest {
  originalCaption: string;
  instruction: string;
  platform: "instagram" | "facebook" | "linkedin" | "tiktok";
  brief: CaptionRequest["brief"];
}

interface HashtagRequest {
  theme: string;
  industry: string;
  platform: "instagram" | "facebook" | "linkedin" | "tiktok";
  count?: number;
}

interface IdeasRequest {
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

interface ContentIdea {
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

interface PlanRequest {
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

interface CampaignRequest {
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

interface StoredHistoryItem {
  id: string;
  client_id: string;
  generated_at: Date;
  request_payload: unknown;
  variants_payload: unknown;
  tokens_used: number;
  best_variant_id: string | null;
}

let historyTableEnsured = false;
const PRIVATE_PORTAL_AI_ONLY = !["false", "0", "off", "no"].includes(
  (process.env.PRIVATE_PORTAL_AI_ONLY ?? "true").trim().toLowerCase(),
);

async function ensureCaptionHistoryTable(): Promise<void> {
  if (historyTableEnsured) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_caption_history (
      id text PRIMARY KEY,
      client_id text NOT NULL,
      generated_at timestamptz NOT NULL DEFAULT now(),
      request_payload jsonb NOT NULL,
      variants_payload jsonb NOT NULL,
      tokens_used int NOT NULL DEFAULT 0,
      best_variant_id text
    )
  `);
  historyTableEnsured = true;
}

function getAnthropicClient(): Anthropic {
  if (PRIVATE_PORTAL_AI_ONLY) {
    throw new Error("Modalita privata attiva: chiamate AI esterne disabilitate.");
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY non configurata");
  }
  return new Anthropic({ apiKey });
}

function buildSystemPrompt(brief: CaptionRequest["brief"]): string {
  return `Sei un esperto copywriter per social media che lavora per
un'agenzia di comunicazione italiana. Stai scrivendo per un brand
con queste caratteristiche:

TONE OF VOICE: ${brief.toneOfVoice}
BRAND VOICE (3 aggettivi): ${brief.brandVoice.join(", ")}
TARGET: ${brief.targetAudience}
OBIETTIVI: ${brief.objectives}
IL BRAND NON DEVE MAI: ${brief.doNotSay}
HASHTAG BRAND: ${brief.hashtags.join(" ")}

Genera SOLO le caption richieste, nessun testo introduttivo.
Rispondi SOLO con JSON valido nel formato specificato.`;
}

function buildIdeasSystemPrompt(brief: IdeasRequest["brief"], competitors: IdeasRequest["competitors"]): string {
  const competitorContext = competitors.length > 0
    ? `\nCOMPETITOR DEL CLIENTE:\n${competitors.map((c) =>
      `- ${c.name}: ${c.observedStrategy || "nessuna strategia nota"}`
    ).join("\n")}`
    : "";

  return `Sei un senior social media strategist italiano con 10 anni
di esperienza. Stai sviluppando idee di contenuto per un brand nel
settore ${brief.industry}.

BRIEF CLIENTE:
- Obiettivi: ${brief.objectives}
- Target: ${brief.targetAudience}
- Tone of voice: ${brief.toneOfVoice}
- Brand voice: ${brief.brandVoice.join(", ")}
- Piattaforme attive: ${brief.platforms.join(", ")}
- Argomenti da trattare: ${brief.topicsToTreat.join(", ")}
- Argomenti da evitare: ${brief.topicsToAvoid}
${competitorContext}

ISTRUZIONI:
- Genera idee originali che si differenzino dai competitor
- Ogni idea deve essere concreta e realizzabile dall'agenzia
- Privilegia contenuti che generano engagement reale
- Rispetta sempre il tone of voice del brand
- Rispondi SOLO con JSON valido, nessun testo fuori dal JSON`;
}

function buildIdeasUserPrompt(context: IdeasRequest["context"], options: IdeasRequest["options"]): string {
  const creativityGuide = {
    safe: "contenuti collaudati con basso rischio, format classici",
    balanced: "mix di contenuti sicuri e alcune idee originali",
    bold: "idee creative e originali anche fuori dagli schemi tipici del settore",
  } as const;

  return `Genera ${options.count} idee di contenuto per questo contesto:

PERIODO: ${context.period}
EVENTI STAGIONALI DA SFRUTTARE: ${context.seasonalEvents.join(", ")}
OBIETTIVO CAMPAGNA: ${context.campaignObjective}
${context.focusPlatform ? `PIATTAFORMA FOCUS: ${context.focusPlatform}` : ""}
FREQUENZA: ${context.postsPerWeek} post/settimana per ${context.weekCount} settimane
MIX CONTENUTI DESIDERATO: Reel ${context.contentMix.reels}% /
  Caroselli ${context.contentMix.carousels}% /
  Foto ${context.contentMix.photos}% /
  Stories ${context.contentMix.stories}%
CREATIVITÀ: ${creativityGuide[options.creativityLevel]}
LINGUA: ${options.language === "italian" ? "Italiano" : "Inglese"}
${options.includeCaption ? "INCLUDI: bozza caption per ogni idea" : ""}
${options.includeCTA ? "INCLUDI: call to action per ogni idea" : ""}

Rispondi SOLO con questo JSON:
{
  "ideas": [
    {
      "id": "idea_1",
      "title": "titolo breve e descrittivo",
      "description": "sviluppo dettagliato dell idea",
      "platform": "instagram",
      "format": "Carosello",
      "objective": "obiettivo specifico",
      "hook": "prima frase che cattura l attenzione",
      "captionDraft": "bozza caption se richiesta",
      "cta": "call to action se richiesta",
      "visualSuggestion": "descrizione del visual o video",
      "hashtags": ["tag1", "tag2"],
      "estimatedEngagement": "high",
      "reasoning": "perché funziona per questo brand",
      "tags": ["stagionale", "educativo"]
    }
  ]
}`;
}

function buildUserPrompt(postDetails: CaptionRequest["postDetails"], options: CaptionRequest["options"]): string {
  const lengthGuide: Record<CaptionRequest["options"]["length"], string> = {
    short: "massimo 100 caratteri",
    medium: "100-200 caratteri",
    long: "200-400 caratteri",
  };
  const platformGuide: Record<CaptionRequest["postDetails"]["platform"], string> = {
    instagram: "ottimizzata per Instagram (usa line break, storytelling)",
    facebook: "ottimizzata per Facebook (piu discorsiva, call to action)",
    linkedin: "ottimizzata per LinkedIn (professionale, insight di valore)",
    tiktok: "ottimizzata per TikTok (diretta, hook nei primi 3 secondi)",
  };
  const variants = Math.max(1, Math.min(3, Number(options.variants || 3)));

  return `Genera ${variants} varianti di caption per questo post:

TEMA: ${postDetails.theme}
TIPO CONTENUTO: ${postDetails.contentType}
OBIETTIVO POST: ${postDetails.objective}
PIATTAFORMA: ${platformGuide[postDetails.platform]}
LUNGHEZZA: ${lengthGuide[options.length]}
LINGUA: ${options.language === "italian" ? "Italiano" : "Inglese"}
${options.includeHashtags ? "INCLUDI: hashtag pertinenti (mix brand + generici)" : "NON includere hashtag nel testo"}
${options.includeEmoji ? "INCLUDI: emoji appropriati al tono" : "NON usare emoji"}
${postDetails.additionalNotes ? `NOTE EXTRA: ${postDetails.additionalNotes}` : ""}
${postDetails.keywords?.length ? `PAROLE CHIAVE DA INCLUDERE: ${postDetails.keywords.join(", ")}` : ""}

Rispondi SOLO con questo JSON (nessun testo fuori dal JSON):
{
  "variants": [
    {
      "id": "v1",
      "caption": "testo della caption",
      "hashtags": ["hashtag1", "hashtag2"],
      "characterCount": 123,
      "platform": "${postDetails.platform}",
      "tone": "tono usato",
      "notes": "perche questa variante funziona (1 frase)"
    }
  ]
}`;
}

function extractTextContent(blocks: Anthropic.Messages.Message["content"]): string {
  const textBlock = blocks.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("NO_CONTENT");
  }
  return textBlock.text.replace(/```json/g, "").replace(/```/g, "").trim();
}

function parseJsonPayload<T>(message: Anthropic.Messages.Message): T {
  const text = extractTextContent(message.content);
  return JSON.parse(text) as T;
}

function parseUsage(message: Anthropic.Messages.Message): number {
  return Number((message.usage?.input_tokens ?? 0) + (message.usage?.output_tokens ?? 0));
}

function platformCharLimit(platform: string): number {
  if (platform === "facebook") return 63206;
  if (platform === "linkedin") return 3000;
  return 2200;
}

function scoreVariant(platform: string, variant: { caption: string; hashtags: string[]; characterCount: number }): { score: number; reason: string } {
  let score = 50;
  const reasons: string[] = [];
  const length = variant.characterCount || variant.caption.length;
  const limit = platformCharLimit(platform);
  const ratio = limit > 0 ? length / limit : 0;
  if (ratio <= 0.55) {
    score += 14;
    reasons.push("lunghezza efficace");
  } else if (ratio <= 0.8) {
    score += 8;
    reasons.push("lunghezza equilibrata");
  } else if (ratio > 1) {
    score -= 30;
    reasons.push("troppo lunga");
  }

  const hasCTA = /(scopri|prenota|scrivici|contattaci|clicca|vai|prova|commenta|salva|condividi)/i.test(variant.caption);
  if (hasCTA) {
    score += 10;
    reasons.push("call to action");
  }

  const lineBreaks = (variant.caption.match(/\n/g) ?? []).length;
  if (platform === "instagram" && lineBreaks >= 1) {
    score += 6;
    reasons.push("buona leggibilita instagram");
  }
  if (platform === "linkedin" && lineBreaks >= 1) {
    score += 5;
    reasons.push("struttura professionale");
  }
  if (platform === "tiktok" && length <= 180) {
    score += 6;
    reasons.push("hook rapido");
  }

  const hashtagCount = variant.hashtags.length;
  if (platform === "instagram") {
    if (hashtagCount >= 5 && hashtagCount <= 15) {
      score += 6;
      reasons.push("hashtag bilanciati");
    } else if (hashtagCount > 25) {
      score -= 4;
      reasons.push("troppi hashtag");
    }
  } else if (platform === "facebook" && hashtagCount > 5) {
    score -= 3;
    reasons.push("hashtag elevati per facebook");
  } else if (platform === "tiktok" && hashtagCount <= 5) {
    score += 4;
    reasons.push("hashtag adatti a tiktok");
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), reason: reasons.join(", ") || "equilibrio complessivo" };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeIdeas(rawIdeas: unknown[], options: IdeasRequest["options"]): ContentIdea[] {
  return rawIdeas.map((entry, index) => {
    const value = (entry ?? {}) as Record<string, unknown>;
    const engagement = String(value.estimatedEngagement ?? "medium").toLowerCase();
    return {
      id: String(value.id ?? `idea_${index + 1}`),
      title: String(value.title ?? `Idea ${index + 1}`),
      description: String(value.description ?? ""),
      platform: String(value.platform ?? "instagram"),
      format: String(value.format ?? "Post foto"),
      objective: String(value.objective ?? ""),
      hook: String(value.hook ?? ""),
      captionDraft: options.includeCaption ? String(value.captionDraft ?? "") : undefined,
      cta: options.includeCTA ? String(value.cta ?? "") : undefined,
      visualSuggestion: String(value.visualSuggestion ?? ""),
      hashtags: Array.isArray(value.hashtags) ? value.hashtags.map(String).slice(0, 20) : [],
      estimatedEngagement: (engagement === "low" || engagement === "high" ? engagement : "medium"),
      reasoning: String(value.reasoning ?? ""),
      tags: Array.isArray(value.tags) ? value.tags.map(String).slice(0, 8) : [],
    };
  });
}

function normalizeWeekday(value: string): number {
  const normalized = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  const map: Record<string, number> = {
    lunedi: 1,
    lun: 1,
    monday: 1,
    martedi: 2,
    mar: 2,
    tuesday: 2,
    mercoledi: 3,
    mer: 3,
    wednesday: 3,
    giovedi: 4,
    gio: 4,
    thursday: 4,
    venerdi: 5,
    ven: 5,
    friday: 5,
    sabato: 6,
    sab: 6,
    saturday: 6,
    domenica: 0,
    dom: 0,
    sunday: 0,
  };
  return map[normalized] ?? 1;
}

function toIsoDate(date: Date): string {
  return date.toISOString();
}

function buildPlanSlots(planConfig: PlanRequest["planConfig"]): Array<{
  weekNumber: number;
  date: Date;
  scheduledTime: string;
  platform: string;
}> {
  const start = new Date(planConfig.startDate);
  start.setHours(0, 0, 0, 0);
  const slots: Array<{ weekNumber: number; date: Date; scheduledTime: string; platform: string }> = [];

  for (let weekIndex = 0; weekIndex < planConfig.weekCount; weekIndex += 1) {
    const weekBase = new Date(start);
    weekBase.setDate(start.getDate() + (weekIndex * 7));

    for (const platformConfig of planConfig.platforms) {
      if (platformConfig.postsPerWeek <= 0) continue;
      const fallbackDays = ["lunedi", "mercoledi", "venerdi"];
      const dayList = (platformConfig.preferredDays.length > 0 ? platformConfig.preferredDays : fallbackDays)
        .map(normalizeWeekday);
      const selectedDays = Array.from({ length: platformConfig.postsPerWeek }).map((_, idx) => dayList[idx % dayList.length]);
      for (const weekday of selectedDays) {
        const slotDate = new Date(weekBase);
        const weekDayStart = weekBase.getDay();
        const delta = weekday - weekDayStart;
        slotDate.setDate(weekBase.getDate() + delta);
        const [hour, minute] = String(platformConfig.preferredTime || "09:00").split(":").map((v) => Number(v || 0));
        slotDate.setHours(hour, minute, 0, 0);
        slots.push({
          weekNumber: weekIndex + 1,
          date: slotDate,
          scheduledTime: String(platformConfig.preferredTime || "09:00"),
          platform: platformConfig.platform,
        });
      }
    }
  }

  return slots.sort((a, b) => a.date.getTime() - b.date.getTime());
}

router.post("/ai/ideas", async (req, res): Promise<void> => {
  try {
    const body = req.body as IdeasRequest;
    const anthropic = getAnthropicClient();
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000,
      system: buildIdeasSystemPrompt(body.brief, body.competitors ?? []),
      messages: [{ role: "user", content: buildIdeasUserPrompt(body.context, body.options) }],
    });

    let parsed: { ideas?: unknown[] };
    try {
      parsed = parseJsonPayload(message);
    } catch {
      res.status(500).json({ error: "PARSE_ERROR" });
      return;
    }

    const ideas = normalizeIdeas(Array.isArray(parsed.ideas) ? parsed.ideas : [], body.options);
    const weeklyDistribution = body.options.count >= 10
      ? {
        weekCount: body.context.weekCount,
        postsPerWeek: body.context.postsPerWeek,
      }
      : undefined;

    res.json({
      ideas,
      weeklyDistribution,
      tokensUsed: parseUsage(message),
      generatedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    console.error("AI ideas error:", err);
    res.status(500).json({ error: "AI_ERROR", message: err instanceof Error ? err.message : "Unknown error" });
  }
});

router.post("/ai/plan", async (req, res): Promise<void> => {
  try {
    const body = req.body as PlanRequest;
    const anthropic = getAnthropicClient();
    const totalPosts = body.planConfig.platforms.reduce((sum, platform) => sum + clamp(Number(platform.postsPerWeek || 0), 0, 7), 0) * body.planConfig.weekCount;
    const system = buildIdeasSystemPrompt(body.brief, body.competitors ?? []);
    const userPrompt = `Genera un piano editoriale in JSON.
Durata: ${body.planConfig.weekCount} settimane.
Post totali richiesti: ${totalPosts}.
Tema campagna: ${body.planConfig.campaignTheme || "non specificato"}.
Eventi stagionali: ${(body.planConfig.seasonalEvents ?? []).join(", ")}.
Distribuzione piattaforme: ${body.planConfig.platforms.map((p) => `${p.platform} (${p.postsPerWeek}/settimana)`).join(", ")}.

Rispondi SOLO con JSON:
{
  "weeks": [
    {
      "weekNumber": 1,
      "theme": "tema settimana",
      "posts": [
        {
          "id": "post_1",
          "title": "titolo",
          "caption": "caption",
          "platform": "instagram",
          "format": "Reel",
          "hashtags": ["#tag1"],
          "visualSuggestion": "idea visual"
        }
      ]
    }
  ]
}`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system,
      messages: [{ role: "user", content: userPrompt }],
    });

    let parsed: { weeks?: Array<{ weekNumber?: number; theme?: string; posts?: any[] }> };
    try {
      parsed = parseJsonPayload(message);
    } catch {
      res.status(500).json({ error: "PARSE_ERROR" });
      return;
    }

    const aiWeeks = Array.isArray(parsed.weeks) ? parsed.weeks : [];
    const unscheduledPosts = aiWeeks.flatMap((week, weekIndex) =>
      (Array.isArray(week.posts) ? week.posts : []).map((post, postIndex) => ({
        id: String(post.id ?? `w${weekIndex + 1}_p${postIndex + 1}`),
        title: String(post.title ?? "Post"),
        caption: String(post.caption ?? ""),
        platform: String(post.platform ?? body.planConfig.platforms[0]?.platform ?? "instagram"),
        format: String(post.format ?? "Post foto"),
        hashtags: Array.isArray(post.hashtags) ? post.hashtags.map(String) : [],
        visualSuggestion: String(post.visualSuggestion ?? ""),
      })),
    );

    const slots = buildPlanSlots(body.planConfig);
    const available = [...unscheduledPosts];
    const assigned = slots.map((slot, index) => {
      const platformMatchIndex = available.findIndex((post) => post.platform.toLowerCase() === slot.platform.toLowerCase());
      const selectedIndex = platformMatchIndex >= 0 ? platformMatchIndex : 0;
      const fallback = available[selectedIndex] ?? {
        id: `fallback_${index + 1}`,
        title: `Contenuto ${index + 1}`,
        caption: "",
        platform: slot.platform,
        format: "Post foto",
        hashtags: [],
        visualSuggestion: "",
      };
      if (available.length > 0) available.splice(selectedIndex, 1);
      return {
        ...fallback,
        platform: slot.platform,
        weekNumber: slot.weekNumber,
        scheduledDate: toIsoDate(slot.date),
        scheduledTime: slot.scheduledTime,
        status: "draft" as const,
      };
    });

    const weeks = Array.from({ length: body.planConfig.weekCount }).map((_, index) => {
      const weekNumber = index + 1;
      const weekPosts = assigned.filter((post) => post.weekNumber === weekNumber).sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
      const startDate = new Date(body.planConfig.startDate);
      startDate.setDate(startDate.getDate() + (index * 7));
      const aiTheme = aiWeeks.find((week) => Number(week.weekNumber ?? weekNumber) === weekNumber)?.theme;
      return {
        weekNumber,
        startDate: startDate.toISOString(),
        theme: String(aiTheme ?? body.planConfig.campaignTheme ?? `Settimana ${weekNumber}`),
        posts: weekPosts.map((post) => ({
          id: post.id,
          title: post.title,
          caption: post.caption,
          platform: post.platform,
          format: post.format,
          scheduledDate: post.scheduledDate,
          scheduledTime: post.scheduledTime,
          hashtags: post.hashtags,
          visualSuggestion: post.visualSuggestion,
          status: post.status,
        })),
      };
    });

    const byPlatform = assigned.reduce<Record<string, number>>((acc, post) => {
      acc[post.platform] = (acc[post.platform] ?? 0) + 1;
      return acc;
    }, {});
    const byFormat = assigned.reduce<Record<string, number>>((acc, post) => {
      acc[post.format] = (acc[post.format] ?? 0) + 1;
      return acc;
    }, {});
    const coveredDays = new Set(assigned.map((post) => post.scheduledDate.slice(0, 10))).size;
    const totalDays = Math.max(1, body.planConfig.weekCount * 7);

    res.json({
      weeks,
      summary: {
        totalPosts: assigned.length,
        byPlatform,
        byFormat,
        coveragePercent: Math.round((coveredDays / totalDays) * 100),
      },
      tokensUsed: parseUsage(message),
    });
  } catch (err: unknown) {
    console.error("AI plan error:", err);
    res.status(500).json({ error: "AI_ERROR", message: err instanceof Error ? err.message : "Unknown error" });
  }
});

router.post("/ai/campaign", async (req, res): Promise<void> => {
  try {
    const body = req.body as CampaignRequest;
    const anthropic = getAnthropicClient();
    const system = buildIdeasSystemPrompt(body.brief, []);
    const userPrompt = `Genera una campagna social completa con tre fasi: teaser, lancio, follow-up.
Tema: ${body.campaignDetails.theme}
Durata: ${body.campaignDetails.duration}
Obiettivo principale: ${body.campaignDetails.mainObjective}
Budget indicativo: ${body.campaignDetails.budget || "non indicato"}
Includi organico: ${body.campaignDetails.includeOrganic ? "si" : "no"}
Includi paid: ${body.campaignDetails.includePaid ? "si" : "no"}

Rispondi SOLO con JSON:
{
  "phases": {
    "teaser": {
      "objective": "",
      "keyMessage": "",
      "tone": "",
      "contents": [{ "title": "", "platform": "", "format": "" }]
    },
    "launch": {
      "objective": "",
      "keyMessage": "",
      "heroPost": "",
      "contents": [{ "title": "", "platform": "", "format": "" }]
    },
    "followUp": {
      "objective": "",
      "keyMessage": "",
      "contents": [{ "title": "", "platform": "", "format": "" }],
      "successMetrics": [""]
    }
  },
  "keyMessages": [""],
  "campaignHashtags": [""],
  "metrics": [""],
  "visualSuggestions": [""]
}`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2500,
      system,
      messages: [{ role: "user", content: userPrompt }],
    });

    let parsed: Record<string, unknown>;
    try {
      parsed = parseJsonPayload(message);
    } catch {
      res.status(500).json({ error: "PARSE_ERROR" });
      return;
    }

    res.json({
      ...parsed,
      tokensUsed: parseUsage(message),
      generatedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    console.error("AI campaign error:", err);
    res.status(500).json({ error: "AI_ERROR", message: err instanceof Error ? err.message : "Unknown error" });
  }
});

router.post("/ai/caption", async (req, res): Promise<void> => {
  try {
    const body = req.body as CaptionRequest;
    const anthropic = getAnthropicClient();
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: buildSystemPrompt(body.brief),
      messages: [
        {
          role: "user",
          content: buildUserPrompt(body.postDetails, body.options),
        },
      ],
    });
    const parsed = JSON.parse(extractTextContent(message.content)) as { variants: Array<any> };
    const normalized = (parsed.variants ?? []).map((variant, index) => {
      const caption = String(variant.caption ?? "");
      const hashtags = Array.isArray(variant.hashtags) ? variant.hashtags.map(String) : [];
      const characterCount = Number(variant.characterCount ?? caption.length);
      const score = scoreVariant(body.postDetails.platform, { caption, hashtags, characterCount });
      return {
        id: String(variant.id ?? `v${index + 1}`),
        caption,
        hashtags,
        characterCount,
        platform: String(variant.platform ?? body.postDetails.platform),
        tone: String(variant.tone ?? body.brief.toneOfVoice ?? "brand"),
        notes: String(variant.notes ?? ""),
        score: score.score,
        rankingReason: score.reason,
      };
    });
    const ranked = [...normalized].sort((a, b) => b.score - a.score);
    const bestVariantId = ranked[0]?.id ?? null;
    res.json({
      variants: ranked,
      bestVariantId,
      tokensUsed: parseUsage(message),
      generatedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    console.error("AI caption error:", err);
    if (err instanceof SyntaxError) {
      res.status(500).json({ error: "PARSE_ERROR" });
      return;
    }
    res.status(500).json({ error: "AI_ERROR", message: err instanceof Error ? err.message : "Unknown error" });
  }
});

router.post("/ai/caption/history", async (req, res): Promise<void> => {
  try {
    await ensureCaptionHistoryTable();
    const payload = req.body as {
      id?: string;
      clientId: string;
      generatedAt?: string;
      request: CaptionRequest;
      variants: Array<any>;
      tokensUsed: number;
      bestVariantId?: string | null;
    };
    const id = payload.id || randomUUID();
    await db.execute(sql`
      INSERT INTO ai_caption_history (
        id, client_id, generated_at, request_payload, variants_payload, tokens_used, best_variant_id
      )
      VALUES (
        ${id},
        ${payload.clientId},
        ${payload.generatedAt ? new Date(payload.generatedAt) : new Date()},
        ${JSON.stringify(payload.request)}::jsonb,
        ${JSON.stringify(payload.variants)}::jsonb,
        ${Number(payload.tokensUsed ?? 0)},
        ${payload.bestVariantId ?? null}
      )
      ON CONFLICT (id) DO NOTHING
    `);
    await db.execute(sql`
      DELETE FROM ai_caption_history
      WHERE id IN (
        SELECT id
        FROM ai_caption_history
        WHERE client_id = ${payload.clientId}
        ORDER BY generated_at DESC
        OFFSET 50
      )
    `);
    res.json({ success: true, id });
  } catch (err: unknown) {
    console.error("AI caption history save error:", err);
    res.status(500).json({ error: "HISTORY_SAVE_ERROR" });
  }
});

router.get("/ai/caption/history/:clientId", async (req, res): Promise<void> => {
  try {
    await ensureCaptionHistoryTable();
    const clientId = String(req.params.clientId);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit ?? 50)));
    const result = await db.execute(sql`
      SELECT id, client_id, generated_at, request_payload, variants_payload, tokens_used, best_variant_id
      FROM ai_caption_history
      WHERE client_id = ${clientId}
      ORDER BY generated_at DESC
      LIMIT ${limit}
    `);
    const rows = (Array.isArray((result as any)?.rows) ? (result as any).rows : Array.isArray(result) ? result : []) as StoredHistoryItem[];
    const normalized = rows.map((row) => ({
      id: row.id,
      clientId: row.client_id,
      generatedAt: row.generated_at instanceof Date ? row.generated_at.toISOString() : new Date(row.generated_at).toISOString(),
      request: row.request_payload as CaptionRequest,
      variants: Array.isArray(row.variants_payload) ? (row.variants_payload as any[]) : [],
      tokensUsed: Number(row.tokens_used ?? 0),
      bestVariantId: row.best_variant_id ?? null,
    }));
    res.json(normalized);
  } catch (err: unknown) {
    console.error("AI caption history load error:", err);
    res.status(500).json({ error: "HISTORY_LOAD_ERROR" });
  }
});

router.post("/ai/caption/improve", async (req, res): Promise<void> => {
  try {
    const body = req.body as ImproveRequest;
    const anthropic = getAnthropicClient();
    const prompt = `Migliora questa caption seguendo l'istruzione: ${body.instruction}
Caption originale: ${body.originalCaption}
Piattaforma: ${body.platform}
Mantieni il tone of voice del brand e rispondi solo con JSON:
{
  "variant": {
    "id": "improved",
    "caption": "testo migliorato",
    "hashtags": ["hashtag1"],
    "characterCount": 100,
    "platform": "${body.platform}",
    "tone": "${body.brief.toneOfVoice || "brand"}",
    "notes": "spiega in una frase il miglioramento"
  }
}`;
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      system: buildSystemPrompt(body.brief),
      messages: [{ role: "user", content: prompt }],
    });
    const parsed = JSON.parse(extractTextContent(message.content)) as { variant?: any; variants?: any[] };
    const rawVariant = parsed.variant ?? parsed.variants?.[0] ?? null;
    if (!rawVariant) {
      res.status(500).json({ error: "PARSE_ERROR" });
      return;
    }
    res.json({
      variant: {
        id: String(rawVariant.id ?? "improved"),
        caption: String(rawVariant.caption ?? ""),
        hashtags: Array.isArray(rawVariant.hashtags) ? rawVariant.hashtags.map(String) : [],
        characterCount: Number(rawVariant.characterCount ?? String(rawVariant.caption ?? "").length),
        platform: String(rawVariant.platform ?? body.platform),
        tone: String(rawVariant.tone ?? body.brief.toneOfVoice ?? "brand"),
        notes: String(rawVariant.notes ?? ""),
      },
      tokensUsed: parseUsage(message),
      generatedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    console.error("AI caption improve error:", err);
    if (err instanceof SyntaxError) {
      res.status(500).json({ error: "PARSE_ERROR" });
      return;
    }
    res.status(500).json({ error: "AI_ERROR", message: err instanceof Error ? err.message : "Unknown error" });
  }
});

router.post("/ai/hashtags", async (req, res): Promise<void> => {
  try {
    const body = req.body as HashtagRequest;
    const anthropic = getAnthropicClient();
    const count = Math.max(10, Math.min(30, Number(body.count ?? 20)));
    const prompt = `Genera ${count} hashtag per:
Tema: ${body.theme}
Settore: ${body.industry}
Piattaforma: ${body.platform}

Rispondi solo con JSON:
{
  "hashtags": ["#uno", "#due"],
  "categories": {
    "brand": ["#brand1"],
    "niche": ["#niche1"],
    "medio": ["#medio1"],
    "generico": ["#generico1"]
  }
}`;
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: "Sei un social media strategist. Rispondi solo in JSON valido.",
      messages: [{ role: "user", content: prompt }],
    });
    const parsed = JSON.parse(extractTextContent(message.content)) as { hashtags?: string[]; categories?: Record<string, string[]> };
    res.json({
      hashtags: (parsed.hashtags ?? []).map((tag) => String(tag)),
      categories: {
        brand: parsed.categories?.brand ?? [],
        niche: parsed.categories?.niche ?? [],
        medio: parsed.categories?.medio ?? [],
        generico: parsed.categories?.generico ?? [],
      },
      tokensUsed: parseUsage(message),
      generatedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    console.error("AI hashtags error:", err);
    if (err instanceof SyntaxError) {
      res.status(500).json({ error: "PARSE_ERROR" });
      return;
    }
    res.status(500).json({ error: "AI_ERROR", message: err instanceof Error ? err.message : "Unknown error" });
  }
});

export default router;
