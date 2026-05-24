import type { NextFunction, Request, Response } from "express";

/**
 * Interruttore globale delle funzioni AI. Disabilitate di default: si attivano
 * solo con AI_ENABLED="true". Tenere disabilitate evita di dover provisionare
 * l'integrazione AI (Anthropic/OpenAI) per far funzionare il resto del portale.
 */
export function isAiEnabled(): boolean {
  return process.env.AI_ENABLED === "true";
}

/** Guard Express: risponde 503 se l'AI è disabilitata, altrimenti prosegue. */
export function requireAiEnabled(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (isAiEnabled()) {
    next();
    return;
  }
  res.status(503).json({
    error: "AI_DISABLED",
    message: "Le funzioni AI sono temporaneamente disabilitate.",
  });
}
