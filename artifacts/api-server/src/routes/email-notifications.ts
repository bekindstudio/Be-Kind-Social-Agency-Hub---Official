import { Router, type Request, type Response } from "express";
import { db, notifications, teamMembersTable, tasksTable, clientReportsTable, clientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getUserId as resolveUserId } from "../lib/access-control";
import nodemailer from "nodemailer";

const router = Router();

function getEmailTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = parseInt(process.env.SMTP_PORT ?? "587");
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
}

function buildEmailTemplate(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;margin:0;padding:0;background:#f5f5f0}
.container{max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
.header{background:#4a6629;color:#fff;padding:24px 32px;text-align:center}
.header h1{margin:0;font-size:18px;letter-spacing:.5px}
.body{padding:32px}
.body h2{color:#333;font-size:16px;margin:0 0 16px}
.body p{color:#555;font-size:14px;line-height:1.6;margin:0 0 12px}
.cta{display:inline-block;background:#4a6629;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin:16px 0}
.footer{padding:16px 32px;border-top:1px solid #eee;text-align:center;color:#999;font-size:11px}
</style></head><body><div class="container"><div class="header"><h1>Be Kind Social Agency HUB</h1></div><div class="body"><h2>${title}</h2>${body}</div><div class="footer">Questa email è stata generata automaticamente dal portale Be Kind Social Agency HUB.</div></div></body></html>`;
}

router.post("/email-notifications/task-assigned", async (req: Request, res: Response): Promise<void> => {
  const userId = resolveUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }
  const { taskId, assigneeEmail } = req.body;
  if (!taskId || !assigneeEmail) { res.status(400).json({ error: "taskId e assigneeEmail richiesti" }); return; }

  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId));
  if (!task) { res.status(404).json({ error: "Task non trovato" }); return; }

  const transporter = getEmailTransporter();
  const html = buildEmailTemplate(
    "Nuovo task assegnato",
    `<p>Ti è stato assegnato un nuovo task:</p><p><strong>${task.title}</strong></p>${task.description ? `<p>${task.description}</p>` : ""}${task.dueDate ? `<p>Scadenza: <strong>${new Date(task.dueDate).toLocaleDateString("it-IT")}</strong></p>` : ""}<p>Priorità: <strong>${task.priority}</strong></p>`
  );

  if (transporter) {
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
        to: assigneeEmail,
        subject: `[Be Kind HUB] Task assegnato: ${task.title}`,
        html,
      });
      res.json({ sent: true });
    } catch (err: any) {
      res.status(500).json({ error: "Invio email fallito", detail: err.message });
    }
  } else {
    res.json({ sent: false, previewHtml: html, message: "SMTP non configurato. Email non inviata." });
  }
});

router.post("/email-notifications/report-status", async (req: Request, res: Response): Promise<void> => {
  const userId = resolveUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }
  const { reportId, recipientEmail, newStatus } = req.body;
  if (!reportId || !recipientEmail || !newStatus) { res.status(400).json({ error: "Campi richiesti mancanti" }); return; }

  const statusLabels: Record<string, string> = {
    in_revisione: "In Revisione",
    approvato: "Approvato",
    inviato: "Inviato",
    bozza: "Bozza",
  };

  const [report] = await db.select().from(clientReportsTable).where(eq(clientReportsTable.id, reportId));
  if (!report) { res.status(404).json({ error: "Report non trovato" }); return; }

  let clientName = "Cliente";
  if (report.clientId) {
    const [c] = await db.select().from(clientsTable).where(eq(clientsTable.id, report.clientId));
    if (c) clientName = c.name;
  }

  const html = buildEmailTemplate(
    `Report aggiornato: ${statusLabels[newStatus] ?? newStatus}`,
    `<p>Lo stato del report per <strong>${clientName}</strong> è stato aggiornato a <strong>${statusLabels[newStatus] ?? newStatus}</strong>.</p><p>Tipo: ${report.tipo}</p><p>Periodo: ${report.periodLabel}</p>`
  );

  const transporter = getEmailTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
        to: recipientEmail,
        subject: `[Be Kind HUB] Report ${statusLabels[newStatus] ?? newStatus} - ${clientName}`,
        html,
      });
      res.json({ sent: true });
    } catch (err: any) {
      res.status(500).json({ error: "Invio email fallito", detail: err.message });
    }
  } else {
    res.json({ sent: false, previewHtml: html, message: "SMTP non configurato" });
  }
});

router.post("/email-notifications/contract-reminder", async (req: Request, res: Response): Promise<void> => {
  const userId = resolveUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }
  const { recipientEmail, contractName, expiryDate, clientName } = req.body;
  if (!recipientEmail || !contractName) { res.status(400).json({ error: "Campi richiesti mancanti" }); return; }

  const html = buildEmailTemplate(
    "Promemoria scadenza contratto",
    `<p>Il contratto <strong>${contractName}</strong>${clientName ? ` per il cliente <strong>${clientName}</strong>` : ""} è in scadenza${expiryDate ? ` il <strong>${new Date(expiryDate).toLocaleDateString("it-IT")}</strong>` : ""}.</p><p>Verifica lo stato e contatta il cliente per il rinnovo.</p>`
  );

  const transporter = getEmailTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
        to: recipientEmail,
        subject: `[Be Kind HUB] Scadenza contratto: ${contractName}`,
        html,
      });
      res.json({ sent: true });
    } catch (err: any) {
      res.status(500).json({ error: "Invio email fallito", detail: err.message });
    }
  } else {
    res.json({ sent: false, previewHtml: html, message: "SMTP non configurato" });
  }
});

router.get("/email-notifications/smtp-status", async (req: Request, res: Response): Promise<void> => {
  const userId = resolveUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }
  const transporter = getEmailTransporter();
  if (transporter) {
    try {
      await transporter.verify();
      res.json({ configured: true, verified: true });
    } catch {
      res.json({ configured: true, verified: false });
    }
  } else {
    res.json({ configured: false, verified: false });
  }
});

export default router;
