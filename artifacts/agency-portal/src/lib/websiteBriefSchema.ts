import {
  Target,
  LayoutGrid,
  Palette,
  GraduationCap,
  CalendarDays,
  Newspaper,
  Wrench,
} from "lucide-react";

/* Schema del Brief Sito Web: il questionario di discovery che il cliente
   compila dalla sua area portale per farci capire che sito vuole.

   Tutto su UNA pagina (non a step). Alcune sezioni sono a checkbox con una
   riga di descrizione ("cos'è") sotto ogni voce, così anche chi non è del
   mestiere capisce. I dati restano un oggetto sezione→campo salvato in
   client_website_briefs.parsedJson: aggiungere campi è retrocompatibile
   (normalizeWebsiteBriefData riempie i mancanti con "").

   Tipi campo:
   - text / textarea → stringa libera
   - url_list        → un link per riga (stringa con "\n")
   - single_choice   → scelta singola (radio), opzioni con descrizione opzionale
   - multi_choice    → scelta multipla (checkbox), selezioni salvate come stringa
                       con le voci separate da "\n" */

export type WBFieldType = "text" | "textarea" | "url_list" | "single_choice" | "multi_choice";
export type WBOption = { v: string; d?: string };
export type WBField = {
  key: string;
  label: string;
  type: WBFieldType;
  help?: string;
  placeholder?: string;
  options?: WBOption[];
};
export type WBSection = {
  key: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  hint?: string;
  fields: WBField[];
};
export type WebsiteBriefData = Record<string, Record<string, string>>;

const PAGINE: WBOption[] = [
  { v: "Homepage", d: "La prima pagina: chi sei, cosa offri e l'invito ad agire" },
  { v: "Chi sono / Studio", d: "La tua storia, il tuo metodo e le foto dello studio" },
  { v: "Servizi", d: "L'elenco dei trattamenti/servizi con descrizioni ed eventuali prezzi" },
  { v: "Video-corsi (shop)", d: "Il negozio dove vendi i tuoi corsi online" },
  { v: "Eventi & formazione", d: "Le date di corsi ed eventi, con iscrizione" },
  { v: "Blog", d: "Articoli e guide di valore (li scriviamo noi per te)" },
  { v: "Contatti", d: "Modulo, telefono, email, WhatsApp" },
  { v: "Dove siamo", d: "Mappa e indirizzo dello studio" },
  { v: "Recensioni", d: "Le testimonianze delle tue clienti" },
  { v: "FAQ", d: "Le domande frequenti con le risposte" },
  { v: "Area riservata", d: "Accesso personale per chi acquista i corsi" },
];

export const WEBSITE_BRIEF_SECTIONS: WBSection[] = [
  {
    key: "obiettivi_tono",
    label: "Obiettivo & tono",
    icon: Target,
    hint: "A cosa serve il sito e come deve “parlare”",
    fields: [
      { key: "obiettivo_sito", label: "A cosa serve il tuo sito, prima di tutto?", type: "single_choice",
        options: [
          { v: "Vendere video-corsi" }, { v: "Farmi trovare in zona" },
          { v: "Prendere prenotazioni e contatti" }, { v: "Raccontare il mio brand" },
          { v: "Vendere eventi e formazione" }, { v: "Un mix di questi" },
        ] },
      { key: "azione_visitatore", label: "Cosa vuoi che faccia chi arriva sul sito?", type: "single_choice",
        options: [
          { v: "Acquistare un corso" }, { v: "Prenotare un appuntamento" },
          { v: "Iscriversi a un evento" }, { v: "Lasciare i suoi contatti" },
          { v: "Leggere e informarsi" },
        ] },
      { key: "obiettivo_dettaglio", label: "Se il sito riuscisse in UNA sola cosa, quale sarebbe?", type: "textarea",
        help: "La cosa più importante in assoluto. Scrivila con parole tue." },
      { key: "descrizione_attivita", label: "Cosa fai, in parole semplici?", type: "textarea",
        help: "Come lo diresti a un'amica. Se abbiamo già una descrizione te la proponiamo qui sotto." },
      { key: "tono_voce", label: "Come deve “parlare” il sito?", type: "multi_choice",
        help: "Scegli tutte le sensazioni giuste.",
        options: [
          { v: "Caldo e accogliente" }, { v: "Elegante e curato" }, { v: "Diretto e pratico" },
          { v: "Ispirazionale" }, { v: "Professionale" }, { v: "Giovane e informale" },
        ] },
      { key: "sensazioni_desiderate", label: "Che emozione deve dare appena si apre?", type: "textarea",
        help: "Es. calore, fiducia, esclusività." },
      { key: "differenziatori", label: "Cosa hai tu che gli altri non hanno? (da mettere in prima pagina)", type: "textarea",
        help: "Il motivo per cui una cliente sceglie te e non un'altra." },
    ],
  },
  {
    key: "struttura_pagine",
    label: "Struttura & pagine",
    icon: LayoutGrid,
    hint: "Quali pagine vuoi. Spunta tutte quelle che ti servono",
    fields: [
      { key: "pagine_volute", label: "Quali pagine vuoi nel sito?", type: "multi_choice",
        help: "Spunta quelle che ti servono: sotto ogni voce c'è cosa contiene.", options: PAGINE },
      { key: "pagina_prioritaria", label: "Se dovessi curarne solo UNA benissimo, quale?", type: "single_choice",
        options: PAGINE.map((p) => ({ v: p.v })) },
      { key: "contenuti_home", label: "Cosa deve vedere subito chi apre la homepage?", type: "textarea",
        help: "Le 2-3 cose più importanti da mostrare per prime." },
      { key: "info_locali", label: "Indirizzo, orari e zona che servi", type: "textarea",
        help: "Servono per la pagina “Dove siamo” e per farti trovare in zona." },
      { key: "funzionalita_extra", label: "Che funzioni particolari ti servono?", type: "multi_choice",
        help: "Spunta quelle utili: te le spieghiamo sotto ognuna.",
        options: [
          { v: "Prenotazione online", d: "Le clienti prenotano l'appuntamento dal sito" },
          { v: "Pagamenti online", d: "Incassi corsi ed eventi con carta o PayPal" },
          { v: "Newsletter", d: "Raccogli le email per inviare aggiornamenti" },
          { v: "Area membri / login", d: "Accesso riservato a chi acquista i corsi" },
          { v: "Calendario eventi", d: "Le prossime date sempre aggiornate" },
          { v: "Chat / WhatsApp", d: "Un bottone per scriverti su WhatsApp" },
          { v: "Mappa", d: "Google Maps con la tua posizione" },
          { v: "Recensioni Google", d: "Le tue recensioni Google in vetrina" },
          { v: "Feed Instagram", d: "Gli ultimi post del tuo profilo mostrati nel sito" },
        ] },
    ],
  },
  {
    key: "ispirazione_competitor",
    label: "Ispirazione & riferimenti",
    icon: Palette,
    hint: "Siti che ti piacciono e concorrenti da emulare (solo a livello estetico)",
    fields: [
      { key: "siti_ispirazione", label: "Siti che ti piacciono (un link per riga)", type: "url_list",
        help: "Anche di altri settori: conta lo stile, l'ordine, le sensazioni.", placeholder: "https://…" },
      { key: "ispirazione_perche", label: "Cosa ti piace di quei siti?", type: "textarea",
        help: "Colori, ordine, foto, come ti fanno sentire." },
      { key: "competitor_estetici", label: "Concorrenti da emulare (solo estetica) — un link per riga", type: "url_list",
        help: "Chi comunica bene e a cui potremmo ispirarci. Se ce li abbiamo già te li proponiamo.", placeholder: "https://…" },
      { key: "competitor_perche", label: "Cosa fanno bene esteticamente che vorresti anche tu?", type: "textarea" },
      { key: "da_evitare", label: "Stili o siti che NON ti piacciono per niente", type: "textarea",
        help: "Ci aiuta a capire cosa evitare." },
      { key: "preferenze_visive", label: "Colori, font o immagini a cui tieni", type: "textarea",
        help: "Logo e font del brand li abbiamo già: aggiungi qui eventuali preferenze in più." },
    ],
  },
  {
    key: "video_corsi",
    label: "Video-corsi & vendita online",
    icon: GraduationCap,
    hint: "Se vuoi vendere corsi dal sito, qui i dettagli",
    fields: [
      { key: "vende_corsi", label: "Vuoi vendere video-corsi dal sito?", type: "single_choice",
        options: [{ v: "Sì, è centrale" }, { v: "Sì, ma non subito" }, { v: "No" }] },
      { key: "corsi_quali", label: "Che corsi vuoi vendere? (temi, livelli)", type: "textarea",
        help: "Anche solo le idee: es. “corso base di piega a onde”." },
      { key: "corsi_quanti", label: "Quanti corsi al lancio, più o meno?", type: "single_choice",
        options: [{ v: "1" }, { v: "2-5" }, { v: "6-10" }, { v: "Più di 10" }] },
      { key: "corsi_prezzo", label: "Fascia di prezzo indicativa a corso", type: "text", placeholder: "es. 49-99 €" },
      { key: "corsi_erogazione", label: "Come consegni i corsi?", type: "single_choice",
        options: [
          { v: "In streaming dentro il sito" }, { v: "Da scaricare" },
          { v: "Su una piattaforma esterna (con link)" }, { v: "Non lo so ancora" },
        ] },
      { key: "corsi_accesso", label: "L'accesso ai corsi è…", type: "single_choice",
        options: [{ v: "A pagamento singolo" }, { v: "In abbonamento" }, { v: "Gratis con iscrizione" }, { v: "Misto" }] },
      { key: "corsi_certificato", label: "Serve un attestato a fine corso?", type: "single_choice",
        options: [{ v: "Sì" }, { v: "No" }, { v: "Forse" }] },
      { key: "pagamenti_strumento", label: "Come vuoi incassare online?", type: "multi_choice",
        options: [
          { v: "Carta (Stripe)", d: "Pagamento con carta, commissioni basse" },
          { v: "PayPal", d: "Il classico PayPal" },
          { v: "Bonifico", d: "Pagamento manuale via bonifico" },
          { v: "Non so, consigliami", d: "Ci pensiamo noi a proporti il migliore" },
        ] },
      { key: "paypal_business", label: "Hai già un account PayPal Business?", type: "single_choice",
        help: "Serve per incassare i pagamenti online con PayPal.",
        options: [{ v: "Sì, ce l'ho" }, { v: "No" }, { v: "Non so cos'è" }] },
    ],
  },
  {
    key: "eventi_formazione",
    label: "Eventi & formazione",
    icon: CalendarDays,
    hint: "Corsi in presenza, live, workshop",
    fields: [
      { key: "fa_eventi", label: "Organizzi eventi o corsi in presenza/live?", type: "single_choice",
        options: [{ v: "Sì, spesso" }, { v: "Ogni tanto" }, { v: "In futuro" }, { v: "No" }] },
      { key: "eventi_tipo", label: "Che tipo di eventi?", type: "multi_choice",
        options: [
          { v: "In studio / presenza" }, { v: "Online / live" }, { v: "Workshop" },
          { v: "Masterclass" }, { v: "Open day" },
        ] },
      { key: "eventi_biglietti", label: "I posti si prenotano o si pagano dal sito?", type: "single_choice",
        options: [
          { v: "Prenotazione gratuita" }, { v: "Biglietto a pagamento" }, { v: "Solo info, nessuna prenotazione" },
        ] },
      { key: "eventi_ricorrenza", label: "Ogni quanto, più o meno?", type: "text", placeholder: "es. una volta al mese" },
      { key: "eventi_esempi", label: "Un esempio di evento che vuoi pubblicare per primo", type: "textarea" },
    ],
  },
  {
    key: "blog_contenuti",
    label: "Blog & contenuti",
    icon: Newspaper,
    hint: "Al blog pensiamo noi: scriveremo circa 10 articoli per riempirlo al lancio",
    fields: [
      { key: "vuole_blog", label: "Vuoi un blog / sezione contenuti?", type: "single_choice",
        help: "Ci pensiamo noi: scriveremo circa 10 articoli di valore per riempirlo al lancio.",
        options: [{ v: "Sì" }, { v: "Forse" }, { v: "No" }] },
      { key: "blog_temi", label: "Di cosa ti piacerebbe si parlasse?", type: "textarea",
        help: "Temi, consigli, guide utili alle tue clienti. Se abbiamo già qualche spunto te lo proponiamo." },
    ],
  },
  {
    key: "aspetti_pratici",
    label: "Dominio, tempi e budget",
    icon: Wrench,
    hint: "Gli ultimi dettagli pratici",
    fields: [
      { key: "dominio_stato", label: "Hai già un dominio (es. www.tuonome.it)?", type: "single_choice",
        options: [{ v: "Sì, ce l'ho" }, { v: "No, mi serve" }, { v: "Non so cos'è" }] },
      { key: "dominio_quale", label: "Se sì, qual è?", type: "text", placeholder: "www.…" },
      { key: "hosting_stato", label: "Hai già un hosting/spazio dove tenere il sito?", type: "single_choice",
        options: [{ v: "Sì" }, { v: "No" }, { v: "Non so" }] },
      { key: "lingue_sito", label: "In che lingue deve essere il sito?", type: "multi_choice",
        options: [{ v: "Italiano" }, { v: "Inglese" }, { v: "Altro" }] },
      { key: "scadenza", label: "C'è una data o un'occasione per cui deve essere online?", type: "text",
        placeholder: "es. entro settembre, per un evento…" },
      { key: "budget_indicativo", label: "Hai un budget indicativo in mente per il sito?", type: "single_choice",
        options: [{ v: "Da definire" }, { v: "Contenuto" }, { v: "Medio" }, { v: "Ampio" }, { v: "Preferisco parlarne" }] },
      { key: "note_libere", label: "Altro che dovremmo sapere?", type: "textarea" },
    ],
  },
];

export function emptyWebsiteBriefData(): WebsiteBriefData {
  const d: WebsiteBriefData = {};
  for (const s of WEBSITE_BRIEF_SECTIONS) {
    d[s.key] = {};
    for (const f of s.fields) d[s.key][f.key] = "";
  }
  return d;
}

export function normalizeWebsiteBriefData(parsed: unknown): WebsiteBriefData {
  const base = emptyWebsiteBriefData();
  if (!parsed || typeof parsed !== "object") return base;
  for (const s of WEBSITE_BRIEF_SECTIONS) {
    const sec = (parsed as Record<string, unknown>)[s.key];
    if (sec && typeof sec === "object") {
      for (const f of s.fields) {
        const v = (sec as Record<string, unknown>)[f.key];
        if (typeof v === "string") base[s.key][f.key] = v;
      }
    }
  }
  return base;
}

/** Quanti campi (noti allo schema) sono compilati: per la barra di stato. */
export function websiteBriefStats(data: WebsiteBriefData): { filled: number; total: number; pct: number } {
  let filled = 0;
  let total = 0;
  for (const s of WEBSITE_BRIEF_SECTIONS) {
    for (const f of s.fields) {
      total += 1;
      if ((data[s.key]?.[f.key] ?? "").trim().length > 0) filled += 1;
    }
  }
  return { filled, total, pct: total ? Math.round((filled / total) * 100) : 0 };
}
