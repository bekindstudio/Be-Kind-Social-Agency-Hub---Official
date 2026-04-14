export const MONTH_NAMES_IT = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
] as const;

export const SEASONAL_SUGGESTIONS_BY_MONTH: Record<number, string[]> = {
  1: ["Capodanno", "Saldi invernali"],
  2: ["San Valentino", "Carnevale"],
  3: ["Festa della donna", "Primo giorno primavera"],
  4: ["Pasqua", "Earth Day", "25 Aprile"],
  5: ["Festa della mamma", "Eurovision"],
  6: ["Festa della Repubblica", "Pride Month", "Estate"],
  7: ["Saldi estivi", "Vacanze estive"],
  8: ["Ferragosto", "Travel season"],
  9: ["Back to School", "Primo giorno autunno"],
  10: ["Halloween", "Autumn vibes"],
  11: ["Single Day / 11.11", "Black Friday"],
  12: ["Natale", "Santo Stefano", "Capodanno"],
};

export const ITALIAN_EVENTS: Record<string, { date: string; name: string; relevance: "high" | "medium" | "low" }[]> = {
  "01": [
    { date: "01-01", name: "Capodanno", relevance: "high" },
    { date: "06-01", name: "Epifania", relevance: "medium" },
  ],
  "02": [
    { date: "14-02", name: "San Valentino", relevance: "high" },
  ],
  "03": [
    { date: "08-03", name: "Festa della Donna", relevance: "high" },
    { date: "19-03", name: "Festa del Papà", relevance: "medium" },
    { date: "20-03", name: "Primo giorno di primavera", relevance: "medium" },
  ],
  "04": [
    { date: "22-04", name: "Earth Day", relevance: "medium" },
    { date: "25-04", name: "Festa della Liberazione", relevance: "high" },
  ],
  "05": [
    { date: "01-05", name: "Festa dei Lavoratori", relevance: "medium" },
  ],
  "06": [
    { date: "02-06", name: "Festa della Repubblica", relevance: "high" },
    { date: "21-06", name: "Primo giorno estate", relevance: "high" },
  ],
  "07": [
    { date: "15-07", name: "Saldi estivi", relevance: "high" },
  ],
  "08": [
    { date: "15-08", name: "Ferragosto", relevance: "high" },
  ],
  "09": [
    { date: "22-09", name: "Primo giorno autunno", relevance: "medium" },
  ],
  "10": [
    { date: "31-10", name: "Halloween", relevance: "medium" },
    { date: "04-10", name: "Festa di San Francesco", relevance: "low" },
  ],
  "11": [
    { date: "01-11", name: "Ognissanti", relevance: "medium" },
    { date: "11-11", name: "Single Day / 11.11", relevance: "medium" },
  ],
  "12": [
    { date: "08-12", name: "Immacolata", relevance: "medium" },
    { date: "25-12", name: "Natale", relevance: "high" },
    { date: "26-12", name: "Santo Stefano", relevance: "low" },
    { date: "31-12", name: "Capodanno", relevance: "high" },
  ],
};
