import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getUserId } from "../lib/access-control";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Marker di build: verifica quale codice gira davvero in produzione.
// `adminIdsConfigured` espone SOLO se la env ADMIN_SUPABASE_USER_IDS è valorizzata
// (booleano, nessun valore sensibile) per diagnosticare il filtro accessi clienti.
router.get("/version", (_req, res) => {
  const adminRaw = [
    process.env.ADMIN_SUPABASE_USER_IDS ?? "",
    process.env.ADMIN_AUTH_USER_IDS ?? "",
    process.env.ADMIN_CLERK_USER_IDS ?? "",
  ].join(",");
  const adminCount = adminRaw.split(",").map((s) => s.trim()).filter(Boolean).length;
  res.json({
    marker: "BUILD-MARKER-20260604-AY",
    seedsDisabled: true,
    adminIdsConfigured: adminCount,
    metaConfigured: Boolean((process.env.META_APP_ID ?? "").trim() && (process.env.META_APP_SECRET ?? "").trim()),
    tokenEncConfigured: Boolean((process.env.TOKEN_ENCRYPTION_KEY ?? "").trim()),
  });
});

router.get("/me", (req, res) => {
  res.json({ userId: getUserId(req as any) });
});

export default router;
