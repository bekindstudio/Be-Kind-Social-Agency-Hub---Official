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
