import { Router, type IRouter, type Request, type Response } from "express";
import { renewExpiringTokens } from "../jobs/metaTokenRenew";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/**
 * Rinnovo token Meta long-lived — invocato da Vercel Cron (vedi `crons` in
 * vercel.json, schedule giornaliero). Sostituisce il job long-running che su
 * Render girava in-process.
 *
 * Vercel allega `Authorization: Bearer <CRON_SECRET>` solo se CRON_SECRET è
 * impostato sul progetto. Se non lo è, l'endpoint resta chiuso (503) così il
 * job non è esposto pubblicamente finché il segreto non viene configurato.
 */
router.get("/cron/meta-token-renew", async (req: Request, res: Response) => {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    res
      .status(503)
      .json({ error: "CRON_DISABLED", message: "CRON_SECRET non configurato." });
    return;
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return;
  }
  try {
    await renewExpiringTokens();
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "meta-token-renew cron failed");
    res.status(500).json({ error: "CRON_FAILED" });
  }
});

export default router;
