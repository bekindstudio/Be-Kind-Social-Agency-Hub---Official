import { Router, type IRouter } from "express";
import { eq, desc, and, or, inArray, sql } from "drizzle-orm";
import { db, clientReportsTable, reportApprovalsTable, clientsTable } from "@workspace/db";
import OpenAI from "openai";
import nodemailer from "nodemailer";
import { getUserId, getAccessibleClientIds } from "../lib/access-control";

const router: IRouter = Router();

function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY!,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL!,
  });
}

function getEmailTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = parseInt(process.env.SMTP_PORT ?? "587");
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
}

const THRESHOLDS = { engagementRate: 1.5, followerGrowthRate: 0, roas: 1.0, clickThroughRate: 0.5 };

function detectPoorPerformance(metrics: any): string[] {
  const flags: string[] = [];
  if (!metrics) return flags;
  const igRaw = metrics.instagram ?? {};
  const adsRaw = metrics.metaAds ?? {};
  const ig = igRaw.summary ?? igRaw;
  const ads = adsRaw.summary ?? adsRaw;
  if (ig.engagementRate != null && ig.engagementRate < THRESHOLDS.engagementRate)
    flags.push(`Tasso di engagement basso: ${ig.engagementRate.toFixed(1)}% (soglia: ${THRESHOLDS.engagementRate}%)`);
  if (ig.followerGrowth != null && ig.followerGrowth < THRESHOLDS.followerGrowthRate)
    flags.push(`Perdita follower: ${ig.followerGrowth} nuovi follower nel periodo`);
  if (ads.roas != null && ads.roas < THRESHOLDS.roas)
    flags.push(`ROAS sotto soglia: ${ads.roas.toFixed(2)}x (soglia: ${THRESHOLDS.roas}x)`);
  if (ads.ctr != null && ads.ctr < THRESHOLDS.clickThroughRate)
    flags.push(`CTR basso sulle campagne: ${ads.ctr.toFixed(2)}% (soglia: ${THRESHOLDS.clickThroughRate}%)`);
  return flags;
}

async function generateAISummary(clientName: string, period: string, metrics: any, performanceFlags: string[], isRealData = false): Promise<string> {
  const openai = getOpenAIClient();
  const igRaw = metrics?.instagram ?? {};
  const adsRaw = metrics?.metaAds ?? {};
  const googleRaw = metrics?.googleAds ?? {};
  const ig = igRaw.summary ?? igRaw;
  const ads = adsRaw.summary ?? adsRaw;
  const google = googleRaw.summary ?? googleRaw;

  const metricsText = `
Instagram:
- Follower: ${ig.followers?.toLocaleString("it-IT") ?? "N/D"} (crescita: ${ig.followerGrowth ?? 0})
- Reach: ${ig.reach?.toLocaleString("it-IT") ?? "N/D"}
- Engagement rate: ${ig.engagementRate?.toFixed(1) ?? "N/D"}%
- Impression: ${ig.impressions?.toLocaleString("it-IT") ?? "N/D"}
- Visite profilo: ${ig.profileViews?.toLocaleString("it-IT") ?? "N/D"}

Meta Ads:
- Spesa totale: EUR ${ads.totalSpend?.toLocaleString("it-IT") ?? "N/D"}
- Impression: ${ads.impressions?.toLocaleString("it-IT") ?? "N/D"}
- Reach: ${ads.reach?.toLocaleString("it-IT") ?? "N/D"}
- CTR: ${ads.ctr?.toFixed(2) ?? "N/D"}%
- CPC: EUR ${ads.cpc?.toFixed(2) ?? "N/D"}
- ROAS: ${ads.roas?.toFixed(2) ?? "N/D"}x
- Conversioni: ${ads.conversions?.toLocaleString("it-IT") ?? "N/D"}

Google Ads:
- Budget speso: EUR ${google.spend?.toLocaleString("it-IT") ?? "N/D"}
- Conversioni: ${google.conversions?.toLocaleString("it-IT") ?? "N/D"}`.trim();

  const flagText = performanceFlags.length > 0 ? `\n\nPROBLEMI RILEVATI:\n${performanceFlags.map(f => `- ${f}`).join("\n")}` : "";
  const dataNote = isRealData ? "" : "\n\nNOTA: I dati forniti sono dati di esempio, non dati reali. Indica che si tratta di una stima indicativa.";

  const prompt = `Sei un esperto di marketing digitale per "Be Kind Social Agency HUB".

Genera un riassunto professionale delle performance di "${clientName}" per "${period}".

Dati:
${metricsText}${flagText}${dataNote}

Il riassunto deve:
1. Valutazione generale dell'andamento
2. Punti di forza
3. Aree di miglioramento
4. 2-3 raccomandazioni strategiche
5. Conclusione con prospettiva

Italiano, tono professionale, massimo 350 parole. Testo semplice senza markdown.`;

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });
  return response.choices[0]?.message?.content ?? "Analisi non disponibile.";
}

function buildEmailHTML(clientName: string, period: string, tipo: string, summary: string, metrics: any): string {
  const igRaw = metrics?.instagram ?? {};
  const adsRaw = metrics?.metaAds ?? {};
  const ig = igRaw.summary ?? igRaw;
  const ads = adsRaw.summary ?? adsRaw;
  const tipoLabel = tipo === "settimanale" ? "Settimanale" : tipo === "trimestrale" ? "Trimestrale" : "Mensile";
  const statBox = (label: string, value: string) => `
    <td style="padding:16px;text-align:center;background:#f8faf6;border-radius:8px;margin:4px">
      <div style="font-size:22px;font-weight:700;color:#5a7a3a">${value}</div>
      <div style="font-size:12px;color:#666;margin-top:4px">${label}</div>
    </td>`;

  return `<!DOCTYPE html>
<html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 20px"><tr><td>
<table width="600" align="center" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
<tr><td style="background:linear-gradient(135deg,#5a7a3a,#7a9a5a);padding:40px 40px 30px;text-align:center">
  <div style="font-size:28px;font-weight:700;color:white;letter-spacing:-0.5px">Be Kind Social Agency HUB</div>
  <div style="font-size:14px;color:rgba(255,255,255,0.8);margin-top:6px">Report ${tipoLabel} · ${period}</div>
</td></tr>
<tr><td style="padding:32px 40px 16px">
  <p style="font-size:18px;font-weight:600;color:#1a1a1a;margin:0">Ciao ${clientName},</p>
  <p style="font-size:14px;color:#555;line-height:1.6;margin:12px 0 0">ecco il report ${tipoLabel.toLowerCase()} sull'andamento della tua attivita di marketing digitale per ${period}.</p>
</td></tr>
<tr><td style="padding:16px 40px"><table width="100%" cellpadding="8" cellspacing="8"><tr>
  ${statBox("Follower", ig.followers?.toLocaleString("it-IT") ?? "—")}
  ${statBox("Engagement", ig.engagementRate != null ? `${ig.engagementRate.toFixed(1)}%` : "—")}
  ${statBox("Spesa Ads", ads.totalSpend != null ? `EUR ${ads.totalSpend.toFixed(0)}` : "—")}
  ${statBox("ROAS", ads.roas != null ? `${ads.roas.toFixed(2)}x` : "—")}
</tr></table></td></tr>
<tr><td style="padding:8px 40px 24px">
  <div style="background:#f8faf6;border-left:3px solid #7a9a5a;border-radius:0 8px 8px 0;padding:20px 24px">
    <div style="font-size:12px;font-weight:700;color:#7a9a5a;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px">Riepilogo</div>
    <div style="font-size:14px;color:#333;line-height:1.7;white-space:pre-line">${summary}</div>
  </div>
</td></tr>
<tr><td style="padding:8px 40px 32px;text-align:center">
  <p style="font-size:13px;color:#777;margin:0 0 16px">Per domande o per pianificare la prossima strategia, non esitare a contattarci.</p>
  <a href="mailto:info@bekind.agency" style="display:inline-block;background:#7a9a5a;color:white;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600">Contatta il team Be Kind</a>
</td></tr>
<tr><td style="background:#f8faf6;padding:20px 40px;text-align:center;border-top:1px solid #eee">
  <p style="font-size:12px;color:#999;margin:0">Be Kind Social Agency HUB · Michael Balleroni · info@bekind.agency</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

function serializeReport(r: any) {
  return {
    ...r,
    periodoInizio: r.periodoInizio?.toISOString() ?? null,
    periodoFine: r.periodoFine?.toISOString() ?? null,
    approvedAt: r.approvedAt?.toISOString() ?? null,
    sentAt: r.sentAt?.toISOString() ?? null,
    inviatoAt: r.inviatoAt?.toISOString() ?? null,
    scheduledFor: r.scheduledFor?.toISOString() ?? null,
    createdAt: r.createdAt?.toISOString() ?? null,
    updatedAt: r.updatedAt?.toISOString() ?? null,
  };
}

// ─── LIST ALL reports (global dashboard) ─────────────────────────────────────

router.get("/reports", async (req, res): Promise<void> => {
  try {
    res.set("Cache-Control", "no-cache, no-store");
    const userId = getUserId(req);
    const clientId = req.query.clientId ? parseInt(req.query.clientId as string) : undefined;
    const status = req.query.status as string | undefined;
    const tipo = req.query.tipo as string | undefined;
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    const author = req.query.author as string | undefined;

    // Seed demo reports when table is empty
    const countRows = await db.select({ count: sql<number>`count(*)::int` }).from(clientReportsTable);
    if ((countRows[0]?.count ?? 0) === 0) {
      const clients = await db.select().from(clientsTable).limit(3);
      const now = new Date();
      const monthLabel = now.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
      if (clients[0]) {
        await db.insert(clientReportsTable).values({
          clientId: clients[0].id,
          tipo: "mensile",
          period: `${now.getFullYear()}-${String(now.getMonth() || 12).padStart(2, "0")}`,
          periodLabel: `Marzo ${now.getFullYear()}`,
          status: "inviato",
          titolo: `Report Mensile — ${clients[0].name} — Marzo ${now.getFullYear()}`,
          riepilogoEsecutivo: "Ottima crescita organica e stabilità delle campagne paid.",
          analisiInsights: "I reel hanno generato il miglior rapporto reach/engagement.",
          strategiaProssimoPeriodo: "Incrementare contenuti educational e testare nuove audience lookalike.",
          noteAggiuntive: "Cliente molto collaborativo sulle approvazioni.",
          kpiSocialJson: { summary: { followers: 12450, followerGrowth: 312, followerGrowthPct: 2.6, reach: 98500, engagementRate: 4.2, impressions: 180400, profileViews: 4220 } } as any,
          kpiMetaJson: { summary: { totalSpend: 4200, conversions: 172, roas: 2.7, ctr: 1.9, cpc: 0.62, impressions: 342000, reach: 171000 } } as any,
          topContenutiJson: [
            { type: "Post", date: "12/03", caption: "Lookbook primavera", likes: 820, comments: 48, saves: 112, reach: 14400, mediaType: "IMAGE" },
            { type: "Reel", date: "18/03", caption: "Behind the scenes", likes: 1240, comments: 63, saves: 154, reach: 21200, mediaType: "VIDEO" },
            { type: "Carousel", date: "25/03", caption: "5 outfit tips", likes: 980, comments: 40, saves: 188, reach: 16800, mediaType: "CAROUSEL_ALBUM" },
          ] as any,
          createdBy: "michael.balleroni",
          sentAt: new Date(),
          inviatoAt: new Date(),
        });
      }
      if (clients[1]) {
        await db.insert(clientReportsTable).values({
          clientId: clients[1].id,
          tipo: "mensile",
          period: `${now.getFullYear()}-${String(now.getMonth() || 12).padStart(2, "0")}`,
          periodLabel: `Marzo ${now.getFullYear()}`,
          status: "in_revisione",
          titolo: `Report Mensile — ${clients[1].name} — Marzo ${now.getFullYear()}`,
          riepilogoEsecutivo: "Buona trazione paid, necessario migliorare CTR creativo.",
          analisiInsights: "La campagna search brand ha sovraperformato.",
          strategiaProssimoPeriodo: "Ribilanciare budget su asset ad alto ROAS.",
          kpiMetaJson: { summary: { totalSpend: 8600, conversions: 210, roas: 1.8, ctr: 1.3, cpc: 1.12 } } as any,
          createdBy: "team.account",
        });
      }
      if (clients[2]) {
        await db.insert(clientReportsTable).values({
          clientId: clients[2].id,
          tipo: "settimanale",
          period: `W14-${now.getFullYear()}`,
          periodLabel: `Settimana 14 ${now.getFullYear()}`,
          status: "bozza",
          titolo: `Report Settimanale — ${clients[2].name} — Settimana 14`,
          riepilogoEsecutivo: "",
          analisiInsights: "",
          strategiaProssimoPeriodo: "",
          noteAggiuntive: "Sezioni da completare.",
          createdBy: "team.creative",
          aiFlag: true,
          aiFlags: ["Sezioni incomplete: riepilogo, insights, strategia"] as any,
        });
      }
    }

    let query = db.select({
      report: clientReportsTable,
      clientName: clientsTable.name,
      clientEmail: clientsTable.email,
    })
      .from(clientReportsTable)
      .leftJoin(clientsTable, eq(clientReportsTable.clientId, clientsTable.id))
      .orderBy(desc(clientReportsTable.createdAt))
      .$dynamic();

    const conditions: any[] = [];
    if (clientId) conditions.push(eq(clientReportsTable.clientId, clientId));
    if (status) conditions.push(eq(clientReportsTable.status, status));
    if (tipo) conditions.push(eq(clientReportsTable.tipo, tipo));
    if (author) conditions.push(eq(clientReportsTable.createdBy, author));
    if (from) conditions.push(sql`${clientReportsTable.createdAt} >= ${from}`);
    if (to) conditions.push(sql`${clientReportsTable.createdAt} <= ${to}`);
    if (conditions.length > 0) query = query.where(and(...conditions));

    const rows = await query;
    let result = rows.map((r) => ({
      ...serializeReport(r.report),
      clientName: r.clientName,
      clientEmail: r.clientEmail,
    }));

    if (userId) {
      const accessible = await getAccessibleClientIds(userId);
      if (accessible !== "all") {
        result = result.filter((r) => accessible.includes(r.clientId));
      }
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/detail/:id
router.get("/reports/detail/:id", async (req, res): Promise<void> => {
  try {
    res.set("Cache-Control", "no-cache, no-store");
    const id = parseInt(req.params.id);
    const rows = await db.select({
      report: clientReportsTable,
      clientName: clientsTable.name,
      clientEmail: clientsTable.email,
    })
      .from(clientReportsTable)
      .leftJoin(clientsTable, eq(clientReportsTable.clientId, clientsTable.id))
      .where(eq(clientReportsTable.id, id));

    if (!rows.length) { res.status(404).json({ error: "Report non trovato" }); return; }
    const r = rows[0];

    const approvals = await db.select()
      .from(reportApprovalsTable)
      .where(eq(reportApprovalsTable.reportId, id))
      .orderBy(desc(reportApprovalsTable.createdAt));

    res.json({
      ...serializeReport(r.report),
      clientName: r.clientName,
      clientEmail: r.clientEmail,
      approvals: approvals.map((a) => ({ ...a, createdAt: a.createdAt?.toISOString() })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/client/:clientId
router.get("/reports/client/:clientId", async (req, res): Promise<void> => {
  try {
    res.set("Cache-Control", "no-cache, no-store");
    const clientId = parseInt(req.params.clientId);
    const reports = await db.select()
      .from(clientReportsTable)
      .where(eq(clientReportsTable.clientId, clientId))
      .orderBy(desc(clientReportsTable.createdAt));
    res.json(reports.map(serializeReport));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reports — create new report (manual or auto)
router.post("/reports", async (req, res): Promise<void> => {
  try {
    const authUserId = getUserId(req as any);
    const body = req.body;
    const clientId = parseInt(body.clientId);

    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
    if (!client) { res.status(404).json({ error: "Cliente non trovato" }); return; }

    const tipo = body.tipo ?? "mensile";
    const period = body.period ?? "";
    const periodLabel = body.periodLabel ?? period;

    let periodoInizio: Date | null = null;
    let periodoFine: Date | null = null;
    if (body.periodoInizio) periodoInizio = new Date(body.periodoInizio);
    if (body.periodoFine) periodoFine = new Date(body.periodoFine);

    const metrics = body.metrics ?? null;
    const flags = detectPoorPerformance(metrics);

    let aiSummary = "";
    try {
      aiSummary = await generateAISummary(client.name, periodLabel, metrics, flags, !!body.isRealData);
    } catch { aiSummary = "Analisi AI non disponibile."; }

    const tipoLabel = tipo === "settimanale" ? "Settimanale" : tipo === "trimestrale" ? "Trimestrale" : "Mensile";
    const titolo = body.titolo ?? `Report ${tipoLabel} — ${client.name} — ${periodLabel}`;

    const [saved] = await db.insert(clientReportsTable).values({
      clientId,
      tipo,
      period,
      periodLabel,
      periodoInizio,
      periodoFine,
      status: "bozza",
      titolo,
      riepilogoEsecutivo: body.riepilogoEsecutivo ?? aiSummary,
      analisiInsights: body.analisiInsights ?? "",
      strategiaProssimoPeriodo: body.strategiaProssimoPeriodo ?? "",
      noteAggiuntive: body.noteAggiuntive ?? "",
      aiSummary,
      aiFlag: flags.length > 0,
      aiFlags: flags as any,
      metricsJson: metrics as any,
      kpiSocialJson: body.kpiSocialJson ?? (metrics?.instagram ? metrics.instagram : null),
      kpiMetaJson: body.kpiMetaJson ?? (metrics?.metaAds ? metrics.metaAds : null),
      kpiGoogleJson: body.kpiGoogleJson ?? (metrics?.googleAds ? metrics.googleAds : null),
      topContenutiJson: body.topContenutiJson ?? (metrics?.instagram?.topPosts ?? null),
      recipientEmail: body.recipientEmail ?? client.email,
      subject: `Report ${tipoLabel} - ${client.name} - ${periodLabel}`,
      createdBy: authUserId ?? "system",
    }).returning();

    res.json(serializeReport(saved));
  } catch (err: any) {
    console.error("Create report error:", err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/reports/:id — update report text sections and other fields
router.patch("/reports/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const body = req.body;

    const allowed: Record<string, any> = {};
    const textFields = ["titolo", "riepilogoEsecutivo", "analisiInsights", "strategiaProssimoPeriodo", "noteAggiuntive", "recipientEmail", "subject"];
    for (const f of textFields) {
      if (body[f] !== undefined) allowed[f] = body[f];
    }
    const jsonFields = ["kpiSocialJson", "kpiMetaJson", "kpiGoogleJson", "topContenutiJson", "metricsJson"];
    for (const f of jsonFields) {
      if (body[f] !== undefined) allowed[f] = body[f];
    }

    if (Object.keys(allowed).length === 0) { res.status(400).json({ error: "Nessun campo da aggiornare" }); return; }

    const [updated] = await db.update(clientReportsTable).set(allowed).where(eq(clientReportsTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Report non trovato" }); return; }
    res.json(serializeReport(updated));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reports/:id/submit-review — move to in_revisione
router.post("/reports/:id/submit-review", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const [updated] = await db.update(clientReportsTable)
      .set({ status: "in_revisione" })
      .where(eq(clientReportsTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Report non trovato" }); return; }
    res.json(serializeReport(updated));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reports/:id/approve
router.post("/reports/:id/approve", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const authUserId = getUserId(req as any);
    const nota = req.body.nota ?? "";

    await db.insert(reportApprovalsTable).values({
      reportId: id,
      reviewerId: authUserId ?? "unknown",
      azione: "approvato",
      nota,
    });

    const [updated] = await db.update(clientReportsTable)
      .set({ status: "approvato", approvedBy: authUserId ?? "unknown", approvedAt: new Date() })
      .where(eq(clientReportsTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Report non trovato" }); return; }
    res.json(serializeReport(updated));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reports/:id/reject — back to bozza with note
router.post("/reports/:id/reject", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const authUserId = getUserId(req as any);
    const nota = req.body.nota ?? "";

    await db.insert(reportApprovalsTable).values({
      reportId: id,
      reviewerId: authUserId ?? "unknown",
      azione: "modifiche_richieste",
      nota,
    });

    const [updated] = await db.update(clientReportsTable)
      .set({ status: "bozza" })
      .where(eq(clientReportsTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Report non trovato" }); return; }
    res.json(serializeReport(updated));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reports/:id/send — send email
router.post("/reports/:id/send", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);

    const [report] = await db.select().from(clientReportsTable).where(eq(clientReportsTable.id, id));
    if (!report) { res.status(404).json({ error: "Report non trovato" }); return; }

    if (report.status !== "approvato") {
      res.status(400).json({ error: "Il report deve essere approvato prima dell'invio." });
      return;
    }

    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, report.clientId));
    const to = req.body.recipientEmail ?? report.recipientEmail ?? client?.email;
    if (!to) { res.status(400).json({ error: "Nessun indirizzo email destinatario specificato." }); return; }

    const summary = report.riepilogoEsecutivo ?? report.aiSummary ?? "";
    const htmlBody = buildEmailHTML(client?.name ?? "Cliente", report.periodLabel, report.tipo, summary, report.metricsJson ?? {});

    const transporter = getEmailTransporter();
    if (transporter) {
      await transporter.sendMail({
        from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
        to,
        subject: report.subject ?? `Report ${report.periodLabel}`,
        html: htmlBody,
      });

      const [updated] = await db.update(clientReportsTable)
        .set({ status: "inviato", sentAt: new Date(), inviatoAt: new Date(), inviatoAEmail: to, recipientEmail: to })
        .where(eq(clientReportsTable.id, id))
        .returning();

      res.json({ ...serializeReport(updated!), sent: true, to });
    } else {
      res.json({ sent: false, previewHtml: htmlBody, error: "Email non configurata. Aggiungi SMTP_HOST, SMTP_USER, SMTP_PASS.", report: serializeReport(report), to });
    }
  } catch (err: any) {
    console.error("Send report error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reports/:id/confirm-client
router.post("/reports/:id/confirm-client", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const [updated] = await db.update(clientReportsTable)
      .set({ status: "confermato_cliente" })
      .where(eq(clientReportsTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Report non trovato" }); return; }
    res.json(serializeReport(updated));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/reports/:id
router.delete("/reports/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(clientReportsTable).where(eq(clientReportsTable.id, id));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/counts — badge counts for sidebar
router.get("/reports/counts", async (_req, res): Promise<void> => {
  try {
    res.set("Cache-Control", "no-cache, no-store");
    const rows = await db.select({ status: clientReportsTable.status, count: sql<number>`count(*)::int` })
      .from(clientReportsTable)
      .groupBy(clientReportsTable.status);
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.status] = r.count;
    res.json(counts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Legacy generate endpoint (kept for backward compatibility)
router.post("/reports/generate/:clientId", async (req, res): Promise<void> => {
  try {
    const clientId = parseInt(req.params.clientId);
    const { period, periodLabel, metrics, recipientEmail, isRealData } = req.body;
    const authUserId = getUserId(req as any);

    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
    if (!client) { res.status(404).json({ error: "Cliente non trovato" }); return; }

    const flags = detectPoorPerformance(metrics);
    let aiSummary = "Analisi non disponibile.";
    try { aiSummary = await generateAISummary(client.name, periodLabel ?? period, metrics, flags, !!isRealData); } catch { }

    const [saved] = await db.insert(clientReportsTable).values({
      clientId,
      tipo: "mensile",
      period,
      periodLabel: periodLabel ?? period,
      status: "bozza",
      titolo: `Report Mensile — ${client.name} — ${periodLabel ?? period}`,
      riepilogoEsecutivo: aiSummary,
      aiSummary,
      aiFlag: flags.length > 0,
      aiFlags: flags as any,
      metricsJson: metrics as any,
      kpiSocialJson: metrics?.instagram ?? null,
      kpiMetaJson: metrics?.metaAds ?? null,
      kpiGoogleJson: metrics?.googleAds ?? null,
      recipientEmail: recipientEmail ?? client.email,
      subject: `Report mensile ${periodLabel ?? period} — Be Kind Social Agency HUB`,
      createdBy: authUserId ?? "system",
    }).returning();

    res.json({ ...serializeReport(saved), flagged: flags.length > 0, flags });
  } catch (err: any) {
    console.error("Report generation error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
