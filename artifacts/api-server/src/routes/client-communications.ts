import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, clientActivityLogTable, clientsTable } from "@workspace/db";
import { getUserId } from "../lib/access-control";
import { validate } from "../middlewares/validate";
import nodemailer from "nodemailer";

/**
 * Comunicazioni ai clienti via EMAIL, da un unico punto. L'agenzia compone una
 * comunicazione (richiesta materiale / notifica / promemoria), la invia
 * all'email del cliente e ne resta traccia nello storico (client_activity_log,
 * azione "comunicazione"). Se l'SMTP non è configurato, la comunicazione viene
 * comunque registrata ma marcata come non inviata (con anteprima HTML).
 */
const router: IRouter = Router();

const ACTION = "comunicazione";

function getEmailTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = parseInt(process.env.SMTP_PORT ?? "587");
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildEmailHtml(subject: string, message: string): string {
  const bodyHtml = escapeHtml(message).replace(/\n/g, "<br>");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;margin:0;padding:0;background:#f5f5f0}
.container{max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
.header{background:#4a6629;color:#fff;padding:24px 32px;text-align:center}
.header h1{margin:0;font-size:18px;letter-spacing:.5px}
.body{padding:32px}
.body h2{color:#333;font-size:16px;margin:0 0 16px}
.body p{color:#555;font-size:14px;line-height:1.6;margin:0 0 12px}
.footer{padding:16px 32px;border-top:1px solid #eee;text-align:center;color:#999;font-size:11px}
</style></head><body><div class="container"><div class="header"><h1>Be Kind Social Agency</h1></div><div class="body"><h2>${escapeHtml(subject)}</h2><p>${bodyHtml}</p></div><div class="footer">Messaggio inviato da Be Kind Social Agency tramite il portale.</div></div></body></html>`;
}

const TYPES = ["richiesta", "notifica", "promemoria"] as const;

const createSchema = z.object({
  clientId: z.number().int().positive(),
  to: z.string().trim().email(),
  type: z.enum(TYPES),
  subject: z.string().trim().min(1).max(300),
  message: z.string().trim().min(1).max(10000),
}).passthrough();

function requireUserId(req: Request, res: Response): string | null {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Non autenticato" });
    return null;
  }
  return userId;
}

// GET /api/client-communications?clientId=&limit=  → storico comunicazioni.
router.get("/client-communications", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const clientIdRaw = typeof req.query.clientId === "string" ? parseInt(req.query.clientId, 10) : NaN;
  const limit = Math.min(200, Math.max(1, typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) || 100 : 100));

  const conds = [eq(clientActivityLogTable.azione, ACTION)];
  if (Number.isFinite(clientIdRaw) && clientIdRaw > 0) conds.push(eq(clientActivityLogTable.clientId, clientIdRaw));

  const rows = await db
    .select()
    .from(clientActivityLogTable)
    .where(and(...conds))
    .orderBy(desc(clientActivityLogTable.createdAt))
    .limit(limit);

  const clientIds = [...new Set(rows.map((r) => r.clientId))];
  const clientMap = new Map<number, string>();
  if (clientIds.length) {
    for (const c of await db.select({ id: clientsTable.id, name: clientsTable.name }).from(clientsTable).where(inArray(clientsTable.id, clientIds))) {
      clientMap.set(c.id, c.name);
    }
  }

  res.json(rows.map((r) => {
    let d: Record<string, any> = {};
    try { d = JSON.parse(r.dettagliJson || "{}"); } catch { /* ignore */ }
    return {
      id: r.id,
      clientId: r.clientId,
      clientName: clientMap.get(r.clientId) ?? null,
      type: d.type ?? null,
      subject: d.subject ?? null,
      message: d.message ?? null,
      to: d.to ?? null,
      sent: d.sent ?? false,
      createdAt: r.createdAt?.toISOString?.() ?? null,
    };
  }));
});

// POST /api/client-communications  → invia email + registra nello storico.
router.post("/client-communications", validate(createSchema), async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const body = req.body as z.infer<typeof createSchema>;

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, body.clientId));
  if (!client) { res.status(404).json({ error: "Cliente non trovato" }); return; }

  const html = buildEmailHtml(body.subject, body.message);
  const transporter = getEmailTransporter();
  let sent = false;
  let sendError: string | null = null;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
        to: body.to,
        subject: `[Be Kind] ${body.subject}`,
        html,
      });
      sent = true;
    } catch (err: any) {
      sendError = err?.message ?? "Invio fallito";
    }
  }

  // Storico (anche se non inviata: resta traccia di cosa volevi mandare).
  await db.insert(clientActivityLogTable).values({
    clientId: body.clientId,
    userId,
    azione: ACTION,
    dettagliJson: JSON.stringify({
      type: body.type,
      subject: body.subject,
      message: body.message,
      to: body.to,
      sent,
    }),
  });

  if (transporter && !sent) {
    res.status(502).json({ sent: false, error: `Invio email fallito: ${sendError ?? "errore"}` });
    return;
  }
  res.status(201).json({
    sent,
    previewHtml: sent ? undefined : html,
    message: sent ? "Email inviata" : "SMTP non configurato: comunicazione registrata ma non inviata.",
  });
});

export default router;
