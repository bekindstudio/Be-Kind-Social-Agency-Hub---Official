import { createHash, timingSafeEqual } from "node:crypto";
import { Router, type IRouter } from "express";

const router: IRouter = Router();
const COOKIE_NAME = "portal_access";

function getPassword(): string {
  return (process.env.PORTAL_ACCESS_PASSWORD ?? "").trim();
}

function isEnabled(): boolean {
  return getPassword().length > 0;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function expectedToken(): string {
  const pwd = getPassword();
  const salt = (process.env.PORTAL_ACCESS_SALT ?? "portal-access-v1").trim();
  return sha256(`${salt}:${pwd}`);
}

function safeEqualString(a: string, b: string): boolean {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  if (aa.length !== bb.length) return false;
  return timingSafeEqual(aa, bb);
}

function hasValidCookie(cookieValue: string | undefined): boolean {
  if (!cookieValue || !isEnabled()) return false;
  return safeEqualString(cookieValue, expectedToken());
}

router.get("/public/access-status", (req, res): void => {
  const enabled = isEnabled();
  if (!enabled) {
    res.json({ enabled: false, granted: true });
    return;
  }
  const cookieValue = req.cookies?.[COOKIE_NAME] as string | undefined;
  res.json({ enabled: true, granted: hasValidCookie(cookieValue) });
});

router.post("/public/unlock", (req, res): void => {
  const enabled = isEnabled();
  if (!enabled) {
    res.json({ ok: true, enabled: false, granted: true });
    return;
  }

  const input = typeof req.body?.password === "string" ? req.body.password : "";
  if (!input) {
    res.status(400).json({ error: "Password mancante" });
    return;
  }

  const ok = safeEqualString(input, getPassword());
  if (!ok) {
    res.status(401).json({ error: "Password non valida" });
    return;
  }

  const secure = process.env.NODE_ENV === "production";
  res.cookie(COOKIE_NAME, expectedToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 14,
  });

  res.json({ ok: true, enabled: true, granted: true });
});

router.post("/public/lock", (_req, res): void => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ ok: true });
});

export default router;
