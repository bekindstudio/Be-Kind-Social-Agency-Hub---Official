import express, { type Express, type ErrorRequestHandler } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { supabaseAuthMiddleware } from "./middlewares/supabaseAuthMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { isApiAuthBypass, getUserId } from "./lib/access-control";

if (isApiAuthBypass()) {
  logger.warn(
    "API_AUTH_DISABLED attivo: le richieste sono trattate come amministratore senza JWT. Non esporre su internet con dati sensibili.",
  );
} else if (!process.env.SUPABASE_JWT_SECRET?.trim()) {
  logger.warn(
    "SUPABASE_JWT_SECRET non impostato: le richieste senza JWT valido avranno userId null (401) salvo endpoint pubblici.",
  );
}

const app: Express = express();

// Dietro il reverse proxy della piattaforma (Vercel/Render): fidati di un solo
// hop in modo che req.ip e express-rate-limit leggano il client reale da
// X-Forwarded-For. Usare il numero 1 (non `true`) evita il warning permissivo
// di express-rate-limit.
app.set("trust proxy", 1);

app.use(helmet());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "RATE_LIMIT",
      message: "Troppe richieste. Riprova tra qualche minuto.",
    },
  }),
);

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    error: "AI_RATE_LIMIT",
    message: "Limite richieste AI raggiunto. Riprova tra un minuto.",
  },
});
app.use("/api/ai", aiLimiter);
app.use("/api/ai-chat", aiLimiter);
app.use("/api/meta/publish", aiLimiter);

/**
 * Rate limit dedicato per scritture su risorse persistenti, per evitare flood
 * (creazione massiva di clienti/progetti/task/messaggi). Soglia generosa per
 * power user reali ma blocca facilmente bot e bug di doppio-click.
 */
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "WRITE_RATE_LIMIT",
    message: "Troppe richieste di scrittura. Aspetta qualche secondo.",
  },
  skip: (req) => req.method !== "POST" && req.method !== "PUT" && req.method !== "PATCH",
});
app.use("/api/clients", writeLimiter);
app.use("/api/projects", writeLimiter);
app.use("/api/tasks", writeLimiter);
app.use("/api/messages", writeLimiter);
app.use("/api/quotes", writeLimiter);

/**
 * Rate limit più stretto per il public portal (no auth, accesso via token):
 * difende contro bruteforce del token share o flood del brief.
 */
const publicPortalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "PORTAL_RATE_LIMIT",
    message: "Troppe richieste. Riprova tra un minuto.",
  },
});
app.use("/api/public/portal", publicPortalLimiter);

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:5173",
  ...(process.env["FRONTEND_URLS"] ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean),
];

/**
 * Vercel deploy/preview/branch del progetto ufficiale.
 * Accetta:
 *  - hostname principale del progetto (env PRIMARY_DOMAIN o suo fallback)
 *  - sottodomini *.vercel.app SOLO se contengono il prefisso del progetto
 *    (defaultProjectPrefix = "be-kind-social-agency-hub")
 * Bloccato: qualsiasi altro `<repo>.vercel.app` di account terzi che potrebbero
 * essere compromessi (CSRF cross-tenant).
 */
const PROJECT_PREFIXES = (
  process.env.VERCEL_PROJECT_PREFIXES
  ?? "be-kind-social-agency-hub"
)
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function isAllowedVercelOrigin(origin: string): boolean {
  try {
    const { protocol, hostname } = new URL(origin);
    if (protocol !== "https:") return false;
    if (!hostname.endsWith(".vercel.app")) return false;
    const lower = hostname.toLowerCase();
    return PROJECT_PREFIXES.some((prefix) => lower.startsWith(prefix));
  } catch {
    return false;
  }
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin) || isAllowedVercelOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin not allowed: ${origin}`));
    },
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(supabaseAuthMiddleware);

// Le risposte /api dipendono dall'utente autenticato: vietare la cache del browser.
// Senza questo, Express emette ETag + `Cache-Control: public, must-revalidate` anche
// sulle risposte 401/dati → il browser poteva servire un corpo STALE (es. lista clienti
// vuota o "Non autenticato") via 304 anche dopo che l'utente era loggato/abilitato.
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// Gate di autenticazione globale: ogni rotta /api richiede un utente loggato,
// tranne gli endpoint pubblici (path relativi al mount /api):
//  - /healthz            health check
//  - /public/*           config pubblica (es. supabase-config per il browser)
//  - /cron/*             job schedulati (protetti internamente da CRON_SECRET)
//  - /me                 ritorna {userId:null} per il check auth lato client
// Questo chiude in un solo punto tutti gli endpoint dati (difesa centralizzata,
// coerente col login sempre obbligatorio lato frontend).
// /meta/oauth/callback è una redirect top-level da Facebook (niente Bearer):
// va consentita senza login, è protetta dallo `state` firmato.
const PUBLIC_API_PATHS = new Set(["/healthz", "/me", "/version", "/meta/oauth/callback", "/google/oauth/callback"]);
app.use("/api", (req, res, next) => {
  if (req.method === "OPTIONS") { next(); return; }
  const p = req.path;
  if (PUBLIC_API_PATHS.has(p) || p.startsWith("/public/") || p.startsWith("/cron/")) {
    next();
    return;
  }
  if (!getUserId(req)) {
    res.status(401).json({ error: "Non autenticato" });
    return;
  }
  next();
});

app.use("/api", router);

const jsonErrorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  logger.error({ err, path: req.path }, "unhandled error");
  if (res.headersSent) return;
  const message = err instanceof Error ? err.message : "Errore server";
  res.status(500).json({ error: message });
};
app.use(jsonErrorHandler);

export default app;
