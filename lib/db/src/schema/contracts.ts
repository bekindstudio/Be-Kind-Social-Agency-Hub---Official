import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";

export const contractsTable = pgTable("contracts", {
  id: serial("id").primaryKey(),
  numero: text("numero").notNull(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  referenteCliente: text("referente_cliente"),
  oggetto: text("oggetto").notNull().default("Contratto Gestione Social e ADV"),
  dataStipula: text("data_stipula").notNull(),
  dataInizio: text("data_inizio").notNull(),
  dataFine: text("data_fine").notNull(),
  preavvisoGiorni: integer("preavviso_giorni").notNull().default(30),
  serviziJson: text("servizi_json").notNull().default("[]"),
  tranchePagamentoJson: text("tranche_pagamento_json").notNull().default("[]"),
  importoTotale: integer("importo_totale").notNull().default(0),
  clausoleJson: text("clausole_json").notNull().default("{}"),
  noteIva: text("note_iva").default("Importi non soggetti a IVA ai sensi dell'art. 1, commi 54-89, Legge n. 190/2014"),
  iban: text("iban"),
  marcaDaBollo: integer("marca_da_bollo").notNull().default(0),
  stato: text("stato").notNull().default("bozza"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Contract = typeof contractsTable.$inferSelect;
