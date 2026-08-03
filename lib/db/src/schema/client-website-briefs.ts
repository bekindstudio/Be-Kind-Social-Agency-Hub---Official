import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";

/**
 * Brief Sito Web: questionario di discovery per il sito web del cliente.
 * Distinto da client_briefs (brief social/marketing). Una riga per cliente,
 * risposte in parsedJson come oggetto { sezione: { campo: "valore" } }.
 * Il cliente lo compila dal portale, l'agenzia lo legge dal cockpit.
 */
export const clientWebsiteBriefs = pgTable("client_website_briefs", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull()
    .references(() => clientsTable.id, { onDelete: "cascade" }).unique(),
  parsedJson: text("parsed_json").notNull().default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
});

export type ClientWebsiteBrief = typeof clientWebsiteBriefs.$inferSelect;
