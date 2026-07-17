/**
 * Espansione delle serie ricorrenti dell'agenda personale.
 *
 * Le occorrenze NON stanno nel DB: una serie è una riga sola e le sue ripetizioni
 * si calcolano qui a ogni lettura. Isolato in un modulo puro perché è la parte
 * dove è più facile sbagliare (ora legale, finestre, cap) e così è testabile
 * senza database.
 */

export const RECURRENCES = ["weekly"] as const;
export type Recurrence = (typeof RECURRENCES)[number];

export function isRecurrence(v: unknown): v is Recurrence {
  return typeof v === "string" && (RECURRENCES as readonly string[]).includes(v);
}

/** Tetto di occorrenze per serie: difende da una finestra assurda o da un bug. */
export const MAX_OCCURRENCES = 400;

export type SeriesInput = {
  startAt: Date;
  endAt?: Date | null;
  recurrence?: string | null;
  recurrenceUntil?: Date | null;
  recurrenceExceptions?: Date[] | null;
};

export type Occurrence = { startAt: Date; endAt: Date | null };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function sameInstant(a: Date, b: Date): boolean {
  return a.getTime() === b.getTime();
}

/**
 * Genera le occorrenze di una serie che cadono in [windowFrom, windowTo].
 *
 * - Serie non ricorrente → al massimo l'occorrenza originale (se è nella finestra).
 * - La durata (endAt - startAt) viene riportata su ogni occorrenza.
 * - `recurrenceUntil` è inclusivo sul giorno indicato.
 * - Le eccezioni sono confrontate sull'istante esatto di inizio dell'occorrenza.
 *
 * Nota sull'ora legale: si somma una settimana in millisecondi, quindi
 * attraversando il cambio d'ora l'appuntamento resta allo stesso istante UTC e
 * l'ora locale slitta di un'ora. È il compromesso accettato: l'alternativa
 * (ricostruire la data locale ogni volta) richiede una libreria di timezone che
 * il progetto non ha. Va rivisto se l'utente segnala l'ora sballata a fine ottobre.
 */
export function expandSeries(series: SeriesInput, windowFrom: Date, windowTo: Date): Occurrence[] {
  const rawDuration =
    series.endAt instanceof Date && Number.isFinite(series.endAt.getTime())
      ? series.endAt.getTime() - series.startAt.getTime()
      : null;
  // Una durata negativa (fine prima dell'inizio, es. orari incrociati) non deve
  // propagarsi su ogni occorrenza: la scarto e l'occorrenza resta senza fine.
  const durationMs = rawDuration != null && rawDuration >= 0 ? rawDuration : null;

  const makeOcc = (startMs: number): Occurrence => ({
    startAt: new Date(startMs),
    endAt: durationMs != null ? new Date(startMs + durationMs) : null,
  });

  if (!isRecurrence(series.recurrence)) {
    const t = series.startAt.getTime();
    if (t < windowFrom.getTime() || t > windowTo.getTime()) return [];
    return [makeOcc(t)];
  }

  const exceptions = Array.isArray(series.recurrenceExceptions) ? series.recurrenceExceptions : [];
  // `until` è inclusivo sul giorno scelto: chi scrive "fino al 30" si aspetta
  // che l'appuntamento del 30 ci sia ancora.
  const untilMs = series.recurrenceUntil
    ? new Date(series.recurrenceUntil).setHours(23, 59, 59, 999)
    : Number.POSITIVE_INFINITY;

  const hardEnd = Math.min(untilMs, windowTo.getTime());
  const out: Occurrence[] = [];

  // Salto in avanti fino alla finestra invece di iterare dall'inizio della serie:
  // una serie iniziata anni fa altrimenti brucerebbe il cap prima di arrivarci.
  const startMs = series.startAt.getTime();
  let cursor = startMs;
  if (cursor < windowFrom.getTime()) {
    const skipped = Math.floor((windowFrom.getTime() - cursor) / WEEK_MS);
    cursor += skipped * WEEK_MS;
  }

  while (cursor <= hardEnd && out.length < MAX_OCCURRENCES) {
    if (cursor >= windowFrom.getTime()) {
      const occStart = new Date(cursor);
      if (!exceptions.some((ex) => sameInstant(ex, occStart))) out.push(makeOcc(cursor));
    }
    cursor += WEEK_MS;
  }
  return out;
}
