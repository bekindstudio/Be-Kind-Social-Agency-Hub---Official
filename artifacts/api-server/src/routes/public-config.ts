import { Router, type IRouter } from "express";

/**
 * Config Supabase destinata al browser (anon key è già pubblica nel client JS).
 * Evita di dover impostare VITE_SUPABASE_* su Vercel al momento del build.
 */
const router: IRouter = Router();

router.get("/public/supabase-config", (_req, res): void => {
  const url = (process.env.PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "").trim();
  const anonKey = (process.env.PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "").trim();
  if (!url || !anonKey) {
    res.status(404).json({ error: "not_configured" });
    return;
  }
  res.json({ url, anonKey });
});

export default router;
