import { Router, type IRouter, type Request, type Response } from "express";
import { renewExpiringTokens } from "../jobs/metaTokenRenew";
import { generateMonthlyReportDrafts } from "../jobs/monthlyReports";
import { runRetainerRollover } from "../jobs/retainerRollover";
import { logger } from "../lib/logger";

function checkCronAuth(req: Request, res: Response): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    res.status(503).json({ error: "CRON_DISABLED", message: "CRON_SECRET non configurato." });
    return false;
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return false;
  }
  return true;
}

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
  if (!checkCronAuth(req, res)) return;
  try {
    await renewExpiringTokens();
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "meta-token-renew cron failed");
    res.status(500).json({ error: "CRON_FAILED" });
  }
});

/**
 * Genera bozze di report mensili per tutti i clienti attivi. Schedule Vercel
 * suggerito: il 1° del mese alle 04:00 UTC ("0 4 1 * *"). Idempotente.
 * Manualmente invocabile dall'agenzia (es. dopo aver aggiunto un cliente
 * a metà mese) tramite GET con header Authorization Bearer CRON_SECRET.
 */
router.get("/cron/monthly-reports", async (req: Request, res: Response) => {
  if (!checkCronAuth(req, res)) return;
  try {
    // Il 1° del mese servono due cose: la bozza report del mese CHIUSO e le task
    // del retainer del mese CHE INIZIA. Girano insieme in questo cron invece che
    // in due, perché Vercel limita il numero di cron per progetto.
    // Indipendenti: se il rollover fallisce, le bozze report restano valide.
    const reports = await generateMonthlyReportDrafts();
    let retainer: Awaited<ReturnType<typeof runRetainerRollover>> | { error: string };
    try {
      retainer = await runRetainerRollover();
    } catch (err) {
      logger.error({ err }, "retainer-rollover fallito dentro monthly-reports cron");
      retainer = { error: "ROLLOVER_FAILED" };
    }
    res.json({ ok: true, reports, retainer });
  } catch (err) {
    logger.error({ err }, "monthly-reports cron failed");
    res.status(500).json({ error: "CRON_FAILED" });
  }
});

export default router;
