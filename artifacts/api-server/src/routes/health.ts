import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getAuth } from "@clerk/express";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/me", (req, res) => {
  try {
    const auth = getAuth(req as any);
    res.json({ userId: auth?.userId ?? null });
  } catch {
    res.json({ userId: null });
  }
});

export default router;
