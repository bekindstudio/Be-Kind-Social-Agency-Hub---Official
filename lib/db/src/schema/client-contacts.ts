import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";

export const clientContactsTable = pgTable("client_contacts", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  nome: text("nome").notNull(),
  cognome: text("cognome").notNull(),
  ruolo: text("ruolo"),
  email: text("email").notNull(),
  telefono: text("telefono"),
  whatsapp: text("whatsapp"),
  linkedin: text("linkedin"),
  isPrimary: text("is_primary").notNull().default("false"),
  metodoContattoPreferito: text("metodo_contatto_preferito"),
  orarioPreferito: text("orario_preferito"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ClientContact = typeof clientContactsTable.$inferSelect;
