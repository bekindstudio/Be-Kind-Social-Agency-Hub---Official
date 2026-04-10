import express, { type Express, type ErrorRequestHandler } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { supabaseAuthMiddleware } from "./middlewares/supabaseAuthMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { isApiAuthBypass } from "./lib/access-control";

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

      if (allowedOrigins.includes(origin)) {
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

app.use("/api", router);

const jsonErrorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  logger.error({ err, path: req.path }, "unhandled error");
  if (res.headersSent) return;
  const message = err instanceof Error ? err.message : "Errore server";
  res.status(500).json({ error: message });
};
app.use(jsonErrorHandler);

export default app;
