import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";

export const clientCredentialsTable = pgTable("client_credentials", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  piattaforma: text("piattaforma").notNull(),
  identificativo: text("identificativo"),
  livelloAccesso: text("livello_accesso"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type ClientCredential = typeof clientCredentialsTable.$inferSelect;
