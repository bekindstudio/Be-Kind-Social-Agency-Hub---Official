import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";

export const clientMeetingsTable = pgTable("client_meetings", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  data: text("data").notNull(),
  durataMinuti: integer("durata_minuti"),
  tipo: text("tipo"),
  partecipantiJson: text("partecipanti_json").notNull().default("[]"),
  note: text("note"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ClientMeeting = typeof clientMeetingsTable.$inferSelect;
