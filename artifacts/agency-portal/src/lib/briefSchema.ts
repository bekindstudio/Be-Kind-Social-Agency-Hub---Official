import {
  FileText,
  Users,
  Sparkles,
  Activity,
  Compass,
  MessageSquareQuote,
  Swords,
  HeartHandshake,
  ThumbsUp,
  Megaphone,
  Target,
  Clapperboard,
  Rocket,
  CalendarRange,
  ShieldAlert,
} from "lucide-react";

/* Schema condiviso del Brief cliente: usato sia dalla pagina interna
   (BriefPage) sia dall'area cliente pubblica (ClientPortalPage).

   Ogni campo ha:
   - `help`: una riga di guida SEMPRE VISIBILE sotto l'etichetta, in linguaggio
     semplice e con esempi, così anche un cliente non addetto ai lavori sa cosa
     scrivere (niente gergo tipo "USP" o "value proposition" lasciato lì da solo).
   - `essential`: i campi da cui dipende DAVVERO una strategia. Il "percorso
     essenziale" mostra solo questi (poche domande, ~10 minuti); il resto è
     "Approfondimenti", facoltativo e a un clic di distanza.

   I dati restano un oggetto sezione→campo salvato in client_briefs.parsedJson:
   aggiungere campi/sezioni è retrocompatibile, i brief già compilati non si
   toccano (normalizeBriefData riempie i mancanti con ""). */

export type BriefField = {
  key: string;
  label: string;
  placeholder?: string;
  long?: boolean;
  help?: string;
  essential?: boolean;
};
export type BriefSection = {
  key: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  hint?: string;
  fields: BriefField[];
};
export type BriefData = Record<string, Record<string, string>>;

export const BRIEF_SECTIONS: BriefSection[] = [
  {
    key: "materiale_iniziale",
    label: "Chi siete e dove siete online",
    icon: FileText,
    hint: "Il punto di partenza: chi siete e i vostri canali",
    fields: [
      { key: "nome_referenti", label: "Con chi parliamo?", essential: true,
        help: "Nome e ruolo di chi seguirà il progetto con noi (es. Maria, titolare)." },
      { key: "descrizione_prodotto", label: "Cosa fate, in parole semplici?", long: true, essential: true,
        help: "Spiegatelo come lo direste a un amico. Es. \"Siamo un parrucchiere specializzato in colore\"." },
      { key: "link_instagram", label: "Profilo Instagram", placeholder: "https://instagram.com/…", essential: true,
        help: "Il link al vostro profilo, anche se lo curate poco: ci serve per capire il punto di partenza." },
      { key: "sito_web", label: "Sito web", placeholder: "https://",
        help: "Se ne avete uno. Lasciate vuoto se non c'è." },
      { key: "link_facebook", label: "Pagina Facebook", placeholder: "https://facebook.com/",
        help: "Se avete una pagina Facebook, incollate il link." },
      { key: "link_tiktok", label: "Profilo TikTok", placeholder: "https://tiktok.com/@",
        help: "Se siete su TikTok. Va bene anche se è vuoto." },
      { key: "business_manager", label: "Business Manager Meta",
        help: "Serve a noi per gestire le inserzioni. Se non sapete cos'è, scrivete \"non so\": ci pensiamo noi." },
      { key: "canva_kit", label: "Kit aziendale Canva",
        help: "Se avete un account Canva con loghi e colori. Opzionale." },
      { key: "canva_progetti", label: "Progetti Canva",
        help: "Eventuali grafiche già pronte su Canva. Opzionale." },
      { key: "logo", label: "Logo", help: "Un link al logo in buona qualità, o una nota (es. \"ve lo mando via mail\")." },
    ],
  },
  {
    key: "target_personas",
    label: "A chi vi rivolgete",
    icon: Users,
    hint: "Le persone che vogliamo raggiungere",
    fields: [
      { key: "tipo_persone", label: "Chi sono i vostri clienti ideali?", long: true, essential: true,
        help: "Descrivete le persone che vorreste avere di più. Es. \"donne 30-50 che tengono alla cura di sé\"." },
      { key: "fasce_eta", label: "Che età hanno?", essential: true,
        help: "Anche a spanne. Es. \"soprattutto 25-45 anni\"." },
      { key: "servizio_da_spingere", label: "Cosa volete vendere di più?", essential: true,
        help: "Il servizio o prodotto su cui volete puntare nei prossimi mesi." },
      { key: "clienti_attuali", label: "Com'è il cliente che avete oggi?", long: true,
        help: "Chi entra già da voi ora: assomiglia al cliente ideale o è diverso?" },
      { key: "servizio_piu_richiesto", label: "Qual è il servizio più richiesto oggi?",
        help: "Quello per cui vi cercano di più al momento." },
      { key: "professione_disponibilita", label: "Che disponibilità di spesa hanno?",
        help: "Es. \"fascia media\", \"sono disposti a spendere per la qualità\". Aiuta a scegliere il tono." },
      { key: "locali_o_fuori_zona", label: "Sono della zona o vengono da fuori?",
        help: "Es. \"quasi tutti della città\", \"molti dai paesi vicini\"." },
      { key: "mercato", label: "In che mercato siete?",
        help: "Il vostro settore in una parola o due. Es. \"beauty\", \"edilizia\", \"ristorazione\"." },
    ],
  },
  {
    key: "servizi_chiave",
    label: "Cosa vi rende diversi",
    icon: Sparkles,
    hint: "Il motivo per cui scegliere voi e non un altro",
    fields: [
      { key: "plus_esclusivi", label: "Cosa avete voi che gli altri non hanno?", long: true, essential: true,
        help: "La cosa che i clienti dicono sempre di voi e che i concorrenti non possono dire. Es. \"gli unici aperti la domenica\"." },
      { key: "usp_1", label: "Il vostro punto di forza numero 1", essential: true,
        help: "Una frase secca. Es. \"colore senza ammoniaca\", \"consegna in 24h\"." },
      { key: "usp_2", label: "Punto di forza numero 2",
        help: "Un altro motivo per sceglier vi, se c'è." },
      { key: "usp_3", label: "Punto di forza numero 3",
        help: "Un terzo motivo, se c'è. Va bene lasciarlo vuoto." },
      { key: "servizi_da_comunicare", label: "Quali servizi vogliamo raccontare?", long: true,
        help: "L'elenco dei servizi che volete far conoscere di più con i social." },
      { key: "novita_progetti", label: "Novità o progetti in arrivo?", long: true,
        help: "Nuovi servizi, aperture, eventi: cose che possiamo annunciare nei prossimi mesi." },
    ],
  },
  {
    key: "produzione_contenuti",
    label: "Come produciamo i contenuti",
    icon: Clapperboard,
    hint: "Chi gira, chi appare, ogni quanto: senza queste risposte il piano è un'ipotesi",
    fields: [
      { key: "chi_produce", label: "Chi gira foto e video?", essential: true,
        help: "Voi sul posto, noi che veniamo, un fotografo esterno? Serve a organizzare le riprese." },
      { key: "chi_appare", label: "Chi ci mette la faccia?", essential: true,
        help: "Titolare, dipendenti, nessuno? I contenuti con persone vere funzionano molto meglio." },
      { key: "disponibilita_riprese", label: "Ogni quanto siete disponibili per girare?", essential: true,
        help: "Es. \"mezza giornata al mese\", \"un pomeriggio ogni due settimane\". Anche poco va bene, basta saperlo." },
      { key: "materiali_esistenti", label: "Che materiale avete già pronto?", long: true,
        help: "Foto professionali, video, cataloghi, logo in alta qualità. Tutto ciò che non dobbiamo rifare da zero." },
      { key: "strumenti", label: "Con cosa girate di solito?",
        help: "Smartphone, reflex, niente. Nessun problema se è solo il telefono: si fanno ottime cose." },
    ],
  },
  {
    key: "obiettivi_cta",
    label: "Cosa deve ottenere",
    icon: Rocket,
    hint: "Il risultato concreto che volete dai social",
    fields: [
      { key: "obiettivo_principale", label: "Cosa deve succedere davvero grazie ai social?", long: true, essential: true,
        help: "Il risultato che conta per voi. Es. \"più chiamate\", \"più prenotazioni online\", \"più gente in negozio\", \"più richieste di preventivo\"." },
      { key: "azione_desiderata", label: "Cosa vuoi che faccia chi vede un post?", essential: true,
        help: "L'azione che deve fare. Es. \"scrivermi in DM\", \"chiamare\", \"prenotare dal sito\", \"venire in sede\"." },
      { key: "dove_mandare", label: "Dove mandiamo le persone interessate?", essential: true,
        help: "Il punto di arrivo: sito, WhatsApp, telefono, form di prenotazione. Incollate il link se ce l'avete." },
      { key: "come_misurate", label: "Come capite oggi se sta funzionando?", long: true,
        help: "Es. \"conto le chiamate\", \"chiedo come mi hanno trovato\", \"guardo le prenotazioni del mese\". Anche a intuito va bene." },
    ],
  },
  {
    key: "tone_of_voice",
    label: "Come volete comunicare",
    icon: MessageSquareQuote,
    hint: "Il tono e la personalità del vostro brand",
    fields: [
      { key: "brand_persona", label: "Se il vostro brand fosse una persona, com'è?", essential: true,
        help: "Es. \"un amico competente e alla mano\", \"un professionista serio e rassicurante\". Aiuta a trovare il tono giusto." },
      { key: "stile_comunicazione", label: "Come volete parlare ai clienti?",
        help: "Dando del tu o del lei? Simpatici o istituzionali? Es. \"tu, informali ma professionali\"." },
      { key: "valori_fondamentali", label: "In cosa credete davvero?", long: true,
        help: "I valori che guidano il vostro lavoro. Es. \"onestà, qualità artigianale, attenzione alla persona\"." },
      { key: "percezione_desiderata", label: "Come volete essere percepiti?",
        help: "L'impressione che deve restare. Es. \"i più affidabili della zona\"." },
      { key: "sensazioni", label: "Che emozione volete far provare?",
        help: "Es. \"fiducia\", \"voglia di coccolarsi\", \"sicurezza\"." },
      { key: "value_proposition", label: "La promessa che fate al cliente", long: true,
        help: "In una frase, cosa ottiene chi sceglie voi. Es. \"esci di qui sentendoti al meglio\"." },
      { key: "tono_umano_vs_tecnico", label: "Più umani o più tecnici?",
        help: "Preferite spiegazioni semplici e calde o dettagli tecnici e precisi?" },
      { key: "esempi_comunicazione", label: "Esempi di comunicazione che vi piacciono", long: true,
        help: "Post, pubblicità o brand (anche di altri settori) che vi piacciono come parlano." },
    ],
  },
  {
    key: "stagionalita_zona",
    label: "Stagionalità e zona",
    icon: CalendarRange,
    hint: "Quando lavorate di più e fin dove arrivate",
    fields: [
      { key: "mesi_forti", label: "Quali sono i vostri mesi forti?", essential: true,
        help: "I periodi in cui lavorate di più o fate promozioni. Es. \"primavera e dicembre\"." },
      { key: "zona_servita", label: "Che zona servite?", essential: true,
        help: "Solo la città, la provincia, la regione, oppure online in tutta Italia? Serve a chi mostrare le inserzioni." },
      { key: "mesi_deboli", label: "E i mesi più scarichi?",
        help: "Quando c'è meno lavoro: spesso sono i mesi migliori per farsi trovare in anticipo." },
      { key: "ricorrenze", label: "Eventi o ricorrenze importanti per voi?", long: true,
        help: "Es. fiere di settore, saldi, San Valentino per un fioraio, rientro a scuola, sagre locali." },
    ],
  },
  {
    key: "vincoli_paletti",
    label: "Cose da NON fare",
    icon: ShieldAlert,
    hint: "Paletti e argomenti da evitare: meglio saperli prima",
    fields: [
      { key: "argomenti_vietati", label: "C'è qualcosa che NON possiamo dire o mostrare?", long: true, essential: true,
        help: "Per legge, per il vostro settore o per scelta vostra. Es. promesse di risultato, prezzi in chiaro, certi prodotti, prima/dopo." },
      { key: "persone_da_non_mostrare", label: "Persone che non vogliono comparire?",
        help: "Dipendenti o titolari che preferiscono non apparire in foto e video. Utile saperlo prima di girare." },
      { key: "concorrenti_da_non_nominare", label: "Concorrenti da non nominare mai?",
        help: "Se ci sono nomi che è meglio non citare, scriveteli qui." },
      { key: "vincoli_legali", label: "Vincoli legali o del vostro ordine/settore?",
        help: "Es. professioni sanitarie, avvocati, farmacie hanno regole precise sulla pubblicità." },
    ],
  },
  {
    key: "comportamento_cliente",
    label: "Come si comportano i clienti",
    icon: Activity,
    hint: "Come vi scelgono e come decidono",
    fields: [
      { key: "perche_scelgono", label: "Perché i clienti scelgono proprio voi?", long: true, essential: true,
        help: "Il motivo vero per cui tornano da voi invece che dal concorrente. Chiedetelo a loro se non siete sicuri." },
      { key: "cosa_cercano", label: "Cosa cercano quando vi contattano?", long: true,
        help: "Il bisogno o il problema che li porta da voi." },
      { key: "come_scoprono", label: "Come vi scoprono di solito?",
        help: "Passaparola, Google, Instagram, passando davanti? Il canale principale." },
      { key: "primo_contatto", label: "Come vi contattano la prima volta?",
        help: "Telefono, DM, WhatsApp, di persona?" },
      { key: "feedback_comuni", label: "I complimenti che ricevete più spesso", long: true,
        help: "Cosa vi dicono i clienti soddisfatti: sono oro per i contenuti." },
      { key: "canali_funzionanti", label: "Quali canali funzionano già?",
        help: "Dove arrivano più clienti oggi." },
      { key: "riscontri_social", label: "Cosa vi arriva dai social oggi?",
        help: "Anche poco. Es. \"qualche like ma nessun contatto\"." },
      { key: "ostacoli", label: "Cosa frena chi è indeciso?", long: true,
        help: "I dubbi che bloccano una persona prima di scegliervi." },
      { key: "richieste_confuse", label: "Dubbi o domande ricorrenti", long: true,
        help: "Le cose che vi chiedono sempre: spesso diventano ottimi post." },
    ],
  },
  {
    key: "pain_points_desideri",
    label: "Bisogni, offerte e obiezioni",
    icon: HeartHandshake,
    hint: "Cosa desiderano, cosa offrite, cosa li blocca",
    fields: [
      { key: "pain_points", label: "Quali problemi risolvete ai clienti?", long: true,
        help: "Le frustrazioni che togliete di mezzo. Es. \"non trovano mai posto\", \"hanno paura di sbagliare taglio\"." },
      { key: "desideri_obiettivi", label: "Cosa desiderano davvero?", long: true,
        help: "Il risultato che sognano. Es. \"sentirsi curati\", \"una casa finalmente a posto\"." },
      { key: "benefici", label: "Cosa ottengono scegliendo voi?", long: true,
        help: "I vantaggi concreti, non le caratteristiche. Es. non \"usiamo X\" ma \"risparmi tempo\"." },
      { key: "offerta_principale", label: "La vostra offerta principale", long: true,
        help: "Il servizio/pacchetto di punta che volete spingere." },
      { key: "lista_offerte", label: "Altre offerte o pacchetti", long: true,
        help: "L'elenco delle altre cose che vendete." },
      { key: "garanzie", label: "Che garanzie date?",
        help: "Es. \"soddisfatto o rimborsato\", \"assistenza inclusa\". Se non ne avete, va bene." },
      { key: "obiezioni", label: "Le scuse più comuni per non comprare", long: true,
        help: "Es. \"costa troppo\", \"ci penso\", \"non ho tempo\"." },
      { key: "risposte_obiezioni", label: "Come rispondete a quelle obiezioni?", long: true,
        help: "Cosa dite per rassicurare chi è indeciso." },
      { key: "faq", label: "Domande frequenti", long: true,
        help: "Le domande che vi fanno sempre, con la risposta. Ottime per i contenuti." },
      { key: "trigger_events", label: "Cosa spinge una persona a cercarvi proprio adesso?", long: true,
        help: "L'evento che fa scattare la ricerca. Es. un matrimonio in arrivo, un trasloco, un guasto." },
    ],
  },
  {
    key: "posizionamento",
    label: "Visione e crescita",
    icon: Compass,
    hint: "Dove volete arrivare",
    fields: [
      { key: "visione_2_anni", label: "Dove vi vedete tra 2 anni?", long: true,
        help: "Come immaginate l'attività tra un paio d'anni." },
      { key: "sogno_crescita", label: "Il vostro sogno di crescita", long: true,
        help: "Se andasse tutto benissimo, cosa vorreste? Es. \"aprire un secondo punto\"." },
    ],
  },
  {
    key: "competitor",
    label: "Concorrenti di riferimento",
    icon: Swords,
    hint: "Chi vi piace e chi no",
    fields: [
      { key: "competitor_1", label: "Un concorrente che vi piace",
        help: "Qualcuno che comunica bene e a cui potremmo ispirarci. Mettete il profilo se ce l'avete." },
      { key: "competitor_2", label: "Un altro riferimento positivo",
        help: "Anche di un settore diverso, se il modo di comunicare vi piace." },
      { key: "competitor_3", label: "Un terzo riferimento",
        help: "Facoltativo." },
      { key: "competitor_4_negativo", label: "Un esempio da NON imitare",
        help: "Qualcuno che secondo voi comunica male: ci aiuta a capire cosa evitare." },
    ],
  },
  {
    key: "social_preference",
    label: "Come apparire (e come no)",
    icon: ThumbsUp,
    hint: "I paletti sullo stile",
    fields: [
      { key: "come_non_apparire", label: "Come NON volete apparire mai?", long: true, essential: true,
        help: "Lo stile o il tono da evitare a tutti i costi. Es. \"volgari\", \"troppo commerciali\", \"caotici\"." },
      { key: "come_apparire", label: "Come volete apparire?", long: true,
        help: "L'immagine che volete dare. Es. \"eleganti e curati\", \"genuini e alla mano\"." },
    ],
  },
  {
    key: "budget_adv",
    label: "Budget pubblicitario",
    icon: Megaphone,
    hint: "Quanto investite in inserzioni (facoltativo)",
    fields: [
      { key: "meta_2025", label: "Budget Meta 2025",
        help: "Quanto avete speso (o volete spendere) in inserzioni su Instagram/Facebook nel 2025. Anche a spanne." },
      { key: "meta_2026", label: "Budget Meta 2026",
        help: "Il budget previsto per il 2026, se lo avete in mente." },
      { key: "google_2025", label: "Budget Google 2025",
        help: "Spesa in pubblicità su Google nel 2025, se ne fate." },
      { key: "google_2026", label: "Budget Google 2026",
        help: "Il budget Google previsto per il 2026." },
      { key: "meta_2024", label: "Budget Meta 2024 (storico)",
        help: "Se lo ricordate, aiuta a capire il trend. Altrimenti lasciate vuoto." },
      { key: "google_2024", label: "Budget Google 2024 (storico)",
        help: "Storico dell'anno scorso, se disponibile." },
    ],
  },
  {
    key: "obiettivi",
    label: "Obiettivi dell'anno",
    icon: Target,
    hint: "I traguardi per l'anno in corso",
    fields: [
      { key: "comunicazione_social_2026", label: "Obiettivo di comunicazione per l'anno", long: true,
        help: "Cosa volete ottenere con i contenuti social. Es. \"far conoscere il nuovo servizio\"." },
      { key: "adv_social_2026", label: "Obiettivo delle inserzioni per l'anno", long: true,
        help: "Cosa volete ottenere con la pubblicità a pagamento. Es. \"20 nuovi contatti al mese\"." },
    ],
  },
];

export function emptyBriefData(): BriefData {
  const d: BriefData = {};
  for (const s of BRIEF_SECTIONS) {
    d[s.key] = {};
    for (const f of s.fields) d[s.key][f.key] = "";
  }
  return d;
}

export function normalizeBriefData(parsed: unknown): BriefData {
  const base = emptyBriefData();
  if (!parsed || typeof parsed !== "object") return base;
  for (const s of BRIEF_SECTIONS) {
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

export function briefSectionFilled(data: BriefData, s: BriefSection): number {
  return s.fields.filter((f) => (data[s.key]?.[f.key] ?? "").trim().length > 0).length;
}

/** Una sezione ha almeno un campo essenziale? (→ compare nel percorso essenziale) */
export function sectionHasEssential(s: BriefSection): boolean {
  return s.fields.some((f) => f.essential);
}

/** Avanzamento sui SOLI campi essenziali: è la barra del percorso guidato. */
export function briefEssentialStats(data: BriefData): { filled: number; total: number; pct: number } {
  let filled = 0;
  let total = 0;
  for (const s of BRIEF_SECTIONS) {
    for (const f of s.fields) {
      if (!f.essential) continue;
      total += 1;
      if ((data[s.key]?.[f.key] ?? "").trim().length > 0) filled += 1;
    }
  }
  return { filled, total, pct: total ? Math.round((filled / total) * 100) : 0 };
}

/** Campi da mostrare per una sezione, in base alla modalità scelta. */
export function visibleFields(s: BriefSection, essentialOnly: boolean): BriefField[] {
  return essentialOnly ? s.fields.filter((f) => f.essential) : s.fields;
}
