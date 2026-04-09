import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";

export const clientBillingTable = pgTable("client_billing", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  partitaIva: text("partita_iva"),
  codiceFiscale: text("codice_fiscale"),
  sdi: text("sdi"),
  pec: text("pec"),
  indirizzoFatturazione: text("indirizzo_fatturazione"),
  metodoPagamento: text("metodo_pagamento"),
  terminiPagamento: text("termini_pagamento"),
  iban: text("iban"),
  valoreMensile: integer("valore_mensile").default(0),
  noteFatturazione: text("note_fatturazione"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ClientBilling = typeof clientBillingTable.$inferSelect;
