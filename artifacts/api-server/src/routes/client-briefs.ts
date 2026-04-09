import { Router, type IRouter, type Request, type Response } from "express";
import { db, clientBriefs, clientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getUserId, getAccessibleClientIds } from "../lib/access-control";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router: IRouter = Router();

function parseClientId(raw: string): number | null {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function checkClientAccess(req: Request, res: Response): Promise<{ userId: string; clientId: number } | null> {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return null; }

  const clientId = parseClientId(req.params.clientId as string);
  if (!clientId) { res.status(400).json({ error: "ID cliente non valido" }); return null; }

  const accessible = await getAccessibleClientIds(userId);
  if (accessible !== "all" && !accessible.includes(clientId)) {
    res.status(403).json({ error: "Accesso non autorizzato a questo cliente" });
    return null;
  }

  return { userId, clientId };
}

const ALLOWED_TAGS = new Set(["h2", "h3", "h4", "p", "strong", "em", "ul", "ol", "li", "blockquote", "br", "table", "thead", "tbody", "tr", "th", "td"]);

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/on\w+\s*=\s*[^\s>]*/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/<iframe[\s\S]*?(<\/iframe>|\/?>)/gi, "")
    .replace(/<embed[\s\S]*?(\/?>)/gi, "")
    .replace(/<object[\s\S]*?(<\/object>|\/?>)/gi, "")
    .replace(/<link[\s\S]*?(\/?>)/gi, "")
    .replace(/<form[\s\S]*?(<\/form>|\/?>)/gi, "");
}

router.get("/clients/:clientId/brief", async (req, res): Promise<void> => {
  const ctx = await checkClientAccess(req, res);
  if (!ctx) return;

  try {
    const rows = await db.select().from(clientBriefs).where(eq(clientBriefs.clientId, ctx.clientId));
    res.json(rows[0] ?? null);
  } catch (err: any) {
    res.status(500).json({ error: "Errore nel caricamento del brief" });
  }
});

router.put("/clients/:clientId/brief", async (req, res): Promise<void> => {
  const ctx = await checkClientAccess(req, res);
  if (!ctx) return;

  const { rawText } = req.body;
  if (typeof rawText !== "string") { res.status(400).json({ error: "rawText richiesto" }); return; }

  try {
    const existing = await db.select().from(clientBriefs).where(eq(clientBriefs.clientId, ctx.clientId));

    if (existing.length > 0) {
      const updated = await db.update(clientBriefs)
        .set({ rawText, strategyStatus: existing[0].strategyHtml ? "ready" : "empty" })
        .where(eq(clientBriefs.clientId, ctx.clientId))
        .returning();
      res.json(updated[0]);
    } else {
      const created = await db.insert(clientBriefs)
        .values({ clientId: ctx.clientId, rawText })
        .returning();
      res.status(201).json(created[0]);
    }
  } catch (err: any) {
    res.status(500).json({ error: "Errore nel salvataggio del brief" });
  }
});

router.post("/clients/:clientId/brief/parse", async (req, res): Promise<void> => {
  const ctx = await checkClientAccess(req, res);
  if (!ctx) return;

  try {
    const brief = await db.select().from(clientBriefs).where(eq(clientBriefs.clientId, ctx.clientId));
    if (!brief.length || !brief[0].rawText.trim()) {
      res.status(400).json({ error: "Nessun testo del brief trovato" }); return;
    }

    const client = await db.select().from(clientsTable).where(eq(clientsTable.id, ctx.clientId));
    const clientName = client[0]?.name ?? "Cliente";

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: `Sei un esperto di marketing digitale. Ti viene fornito il testo grezzo di un questionario compilato da un cliente di un'agenzia social/marketing. Il cliente si chiama "${clientName}".

Analizza il testo e restituisci un JSON strutturato con le seguenti sezioni (usa esattamente queste chiavi):
{
  "materiale_iniziale": { "nome_referenti": "", "logo": "", "instagram": "", "business_manager": "", "canva_kit": "", "canva_progetti": "", "sito_web": "", "link_instagram": "", "link_facebook": "", "link_tiktok": "", "descrizione_prodotto": "" },
  "target_personas": { "clienti_attuali": "", "tipo_persone": "", "fasce_eta": "", "professione_disponibilita": "", "locali_o_fuori_zona": "", "mercato": "", "servizio_piu_richiesto": "", "servizio_da_spingere": "" },
  "servizi_chiave": { "servizi_da_comunicare": "", "plus_esclusivi": "", "usp_1": "", "usp_2": "", "usp_3": "", "novita_progetti": "" },
  "comportamento_cliente": { "cosa_cercano": "", "perche_scelgono": "", "feedback_comuni": "", "come_scoprono": "", "canali_funzionanti": "", "primo_contatto": "", "riscontri_social": "", "ostacoli": "", "richieste_confuse": "" },
  "posizionamento": { "visione_2_anni": "", "sogno_crescita": "" },
  "tone_of_voice": { "valori_fondamentali": "", "value_proposition": "", "percezione_desiderata": "", "brand_persona": "", "stile_comunicazione": "", "tono_umano_vs_tecnico": "", "sensazioni": "", "esempi_comunicazione": "" },
  "competitor": { "competitor_1": "", "competitor_2": "", "competitor_3": "", "competitor_4_negativo": "" },
  "pain_points_desideri": { "pain_points": "", "desideri_obiettivi": "", "benefici": "", "offerta_principale": "", "lista_offerte": "", "garanzie": "", "obiezioni": "", "risposte_obiezioni": "", "faq": "", "trigger_events": "" },
  "social_preference": { "come_apparire": "", "come_non_apparire": "" },
  "budget_adv": { "meta_2024": "", "meta_2025": "", "meta_2026": "", "google_2024": "", "google_2025": "", "google_2026": "" },
  "obiettivi": { "comunicazione_social_2026": "", "adv_social_2026": "" }
}

Se un campo non ha risposta, lascia stringa vuota. Rispondi SOLO con il JSON, senza markdown o testo aggiuntivo.

Testo del questionario:
${brief[0].rawText}`
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    await db.update(clientBriefs)
      .set({ parsedJson: JSON.stringify(parsed) })
      .where(eq(clientBriefs.clientId, ctx.clientId));

    res.json({ parsed });
  } catch (err: any) {
    res.status(500).json({ error: "Errore AI: " + (err.message ?? "sconosciuto") });
  }
});

router.post("/clients/:clientId/brief/generate-strategy", async (req, res): Promise<void> => {
  const ctx = await checkClientAccess(req, res);
  if (!ctx) return;

  try {
    const brief = await db.select().from(clientBriefs).where(eq(clientBriefs.clientId, ctx.clientId));
    if (!brief.length) { res.status(400).json({ error: "Nessun brief trovato" }); return; }

    const client = await db.select().from(clientsTable).where(eq(clientsTable.id, ctx.clientId));
    const clientName = client[0]?.name ?? "Cliente";

    const parsedData = brief[0].parsedJson !== "{}" ? brief[0].parsedJson : null;
    const rawText = brief[0].rawText;

    if (!parsedData && !rawText.trim()) {
      res.status(400).json({ error: "Brief vuoto" }); return;
    }

    await db.update(clientBriefs)
      .set({ strategyStatus: "generating" })
      .where(eq(clientBriefs.clientId, ctx.clientId));

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [{
        role: "user",
        content: `Sei un Senior Digital Strategist di un'agenzia di marketing e comunicazione digitale italiana. Devi creare una STRATEGIA COMPLETA dalla A alla Z per il cliente "${clientName}" basandoti sul brief compilato.

${parsedData ? `Dati strutturati del brief:\n${parsedData}` : `Testo grezzo del brief:\n${rawText}`}

Genera una strategia completa e dettagliata in HTML ben formattato (senza tag html/head/body, solo contenuto). Usa questo formato:

<h2>1. Analisi del Brand e Posizionamento</h2>
<p>Analisi dettagliata del brand, del mercato e del posizionamento attuale...</p>

<h2>2. Target Personas</h2>
<p>Definizione dettagliata delle buyer personas con profili completi...</p>

<h2>3. Unique Selling Proposition</h2>
<p>USP chiari e differenzianti, messaggi chiave...</p>

<h2>4. Tone of Voice e Identita Comunicativa</h2>
<p>Definizione del tono, stile, personalita del brand nella comunicazione...</p>

<h2>5. Strategia di Contenuto</h2>
<h3>5.1 Pilastri di Contenuto</h3>
<p>I macro-temi su cui basare la comunicazione...</p>
<h3>5.2 Tipologie di Contenuto</h3>
<p>Post, stories, reel, caroselli... con frequenza suggerita</p>
<h3>5.3 Piano Editoriale Tipo</h3>
<p>Esempio di settimana tipo con rubriche...</p>

<h2>6. Strategia ADV (Meta & Google)</h2>
<h3>6.1 Funnel Pubblicitario</h3>
<p>TOFU / MOFU / BOFU con obiettivi e budget allocation...</p>
<h3>6.2 Campagne Meta Ads</h3>
<p>Struttura campagne, target, creativita...</p>
<h3>6.3 Campagne Google Ads</h3>
<p>Keywords, struttura, budget...</p>

<h2>7. KPI e Metriche di Successo</h2>
<p>Obiettivi misurabili, metriche da monitorare, reporting...</p>

<h2>8. Roadmap Operativa</h2>
<p>Timeline con fasi, milestone, attivita mese per mese...</p>

<h2>9. Gestione Obiezioni e FAQ</h2>
<p>Risposte alle obiezioni principali dei clienti, FAQ strategiche...</p>

<h2>10. Raccomandazioni Finali</h2>
<p>Suggerimenti aggiuntivi, opportunita, next steps...</p>

Scrivi in italiano professionale. Sii estremamente dettagliato e specifico per questo cliente. Usa <strong>, <em>, <ul>, <li>, <blockquote> per formattare. Non usare emoji.`
      }],
    });

    let fullHtml = "";
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        fullHtml += event.delta.text;
        res.write(`data: ${JSON.stringify({ type: "delta", text: event.delta.text })}\n\n`);
      }
    }

    const sanitized = sanitizeHtml(fullHtml);
    await db.update(clientBriefs)
      .set({ strategyHtml: sanitized, strategyStatus: "ready" })
      .where(eq(clientBriefs.clientId, ctx.clientId));

    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end();
  } catch (err: any) {
    await db.update(clientBriefs)
      .set({ strategyStatus: "error" })
      .where(eq(clientBriefs.clientId, ctx.clientId));

    res.write(`data: ${JSON.stringify({ type: "error", message: err.message ?? "Errore sconosciuto" })}\n\n`);
    res.end();
  }
});

router.delete("/clients/:clientId/brief", async (req, res): Promise<void> => {
  const ctx = await checkClientAccess(req, res);
  if (!ctx) return;

  try {
    await db.delete(clientBriefs).where(eq(clientBriefs.clientId, ctx.clientId));
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: "Errore nell'eliminazione del brief" });
  }
});

export default router;
