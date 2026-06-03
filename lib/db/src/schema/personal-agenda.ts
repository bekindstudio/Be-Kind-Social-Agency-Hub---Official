import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Agenda personale dell'utente — appuntamenti call/meeting/in_sede. È DISTINTA
 * da `client_events` (eventi lato cliente, condivisi tra il team) e da
 * `client_meetings` (storico meeting cliente). Qui ogni record è privato
 * all'utente che l'ha creato: nessuna ACL via accessible_client_ids, solo
 * userId match.
 *
 * type:
 *   - "call"    → telefonata / videocall
 *   - "meeting" → riunione interna
 *   - "in_sede" → appuntamento in sede (cliente o ufficio)
 */
export const personalAgendaEventsTable = pgTable("personal_agenda_events", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  type: text("type").notNull(),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }),
  location: text("location"),
  notes: text("notes"),
  attendees: text("attendees"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type PersonalAgendaEvent = typeof personalAgendaEventsTable.$inferSelect;
export type InsertPersonalAgendaEvent = typeof personalAgendaEventsTable.$inferInsert;
