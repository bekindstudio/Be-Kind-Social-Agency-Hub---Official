import nodemailer from "nodemailer";

/**
 * Mailer condiviso (Wave DP). Stesso transporter e template usati nelle route
 * email esistenti, centralizzati per i nuovi eventi del portale contratti.
 *
 * Le "comunicazioni importanti" dell'agenzia (proposta di modifica contratto,
 * contratto firmato, ...) vanno all'indirizzo AGENCY_NOTIFY_EMAIL — di default
 * balleronicomunicazione@gmail.com, sovrascrivibile via env su Vercel.
 */

export function getEmailTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = parseInt(process.env.SMTP_PORT ?? "587");
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
}

export function agencyNotifyEmail(): string {
  return (process.env.AGENCY_NOTIFY_EMAIL ?? "balleronicomunicazione@gmail.com").trim();
}

export function buildEmailTemplate(title: string, body: string): string {
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

/**
 * Invia una notifica all'indirizzo dell'agenzia. Non lancia mai: se SMTP non è
 * configurato o l'invio fallisce, ritorna { sent: false } e la richiesta
 * principale prosegue (l'email è un effetto collaterale, non un requisito).
 */
export async function notifyAgency(subject: string, title: string, bodyHtml: string): Promise<{ sent: boolean }> {
  const transporter = getEmailTransporter();
  if (!transporter) return { sent: false };
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to: agencyNotifyEmail(),
      subject,
      html: buildEmailTemplate(title, bodyHtml),
    });
    return { sent: true };
  } catch {
    return { sent: false };
  }
}

/** Come notifyAgency, ma verso un destinatario esplicito (es. email del cliente). */
export async function sendEmail(to: string, subject: string, title: string, bodyHtml: string): Promise<{ sent: boolean }> {
  const transporter = getEmailTransporter();
  if (!transporter) return { sent: false };
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to,
      subject,
      html: buildEmailTemplate(title, bodyHtml),
    });
    return { sent: true };
  } catch {
    return { sent: false };
  }
}
