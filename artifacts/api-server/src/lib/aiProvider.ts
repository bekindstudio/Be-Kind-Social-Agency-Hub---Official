import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 30_000,
  maxRetries: 2,
});

export const aiErrors = {
  TIMEOUT: {
    status: 504,
    error: "AI_TIMEOUT",
    message: "Il servizio AI non ha risposto - riprova",
  },
  RATE_LIMIT: {
    status: 429,
    error: "AI_RATE_LIMIT",
    message: "Limite richieste AI raggiunto - riprova tra poco",
  },
  CONTEXT_TOO_LONG: {
    status: 400,
    error: "AI_CONTEXT_TOO_LONG",
    message: "Contenuto troppo lungo - riducilo e riprova",
  },
  OVERLOADED: {
    status: 503,
    error: "AI_OVERLOADED",
    message: "Servizio AI temporaneamente sovraccarico - riprova",
  },
  GENERIC: {
    status: 500,
    error: "AI_ERROR",
    message: "Errore nel servizio AI - riprova",
  },
} as const;

export type AiErrorType = (typeof aiErrors)[keyof typeof aiErrors];

export function mapAiError(err: unknown): AiErrorType {
  if (err instanceof Anthropic.APIError) {
    if (err.status === 429) return aiErrors.RATE_LIMIT;
    if (err.status === 529) return aiErrors.OVERLOADED;
    if (err.status === 400 && err.message?.toLowerCase().includes("too long")) {
      return aiErrors.CONTEXT_TOO_LONG;
    }
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes("timeout") || msg.includes("timed out")) {
      return aiErrors.TIMEOUT;
    }
  }
  return aiErrors.GENERIC;
}

export async function callAi<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const mapped = mapAiError(err);
    const httpError = new Error(mapped.message) as Error & {
      statusCode?: number;
      errorCode?: string;
    };
    httpError.statusCode = mapped.status;
    httpError.errorCode = mapped.error;
    throw httpError;
  }
}
