import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";

export const clientServicesTable = pgTable("client_services", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  tipoServizio: text("tipo_servizio").notNull(),
  configurazioneJson: text("configurazione_json").notNull().default("{}"),
  attivo: text("attivo").notNull().default("true"),
  dataInizio: text("data_inizio"),
  dataFine: text("data_fine"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ClientService = typeof clientServicesTable.$inferSelect;
