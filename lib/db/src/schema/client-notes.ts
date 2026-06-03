import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";

/**
 * Note libere / idee per cliente. Diverse da `clientBriefs` (struttura fissa,
 * compilazione formale) e da `notes` su `clientsTable` (campo singolo testuale
 * legato all'anagrafica). Qui ogni nota è una "card" indipendente che il PM
 * può creare/modificare/eliminare velocemente — utile per appuntare idee al
 * volo (es. "fare reels sul tema X", "telefonare a Y la prossima settimana").
 */
export const clientNotesTable = pgTable("client_notes", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  color: text("color").notNull().default("#fef3c7"),
  pinned: boolean("pinned").notNull().default(false),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type ClientNote = typeof clientNotesTable.$inferSelect;
export type InsertClientNote = typeof clientNotesTable.$inferInsert;
