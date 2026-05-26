import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getUserId } from "../lib/access-control";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Marker di build: verifica quale codice gira davvero in produzione.
router.get("/version", (_req, res) => {
  res.json({ marker: "BUILD-MARKER-20260526-B", seedsDisabled: true });
});

router.get("/me", (req, res) => {
  res.json({ userId: getUserId(req as any) });
});

export default router;
