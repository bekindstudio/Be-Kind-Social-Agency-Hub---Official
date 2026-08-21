import { pgTable, text, timestamp, uuid, integer, date, numeric, serial } from "drizzle-orm/pg-core";
import { contractTemplatesTable } from "./contract-templates";
import { clientsTable } from "./clients";

/**
 * Contratti generati da template (testo libero + variabili).
 * Nome tabella: `contract_documents` per non confondersi con `contracts` (contratti cliente legacy).
 * Wave DP: agganciati al cliente del portale (clientId) con firma elettronica
 * semplice + audit trail (nome, IP, user agent, hash del contenuto firmato,
 * accettazione separata delle clausole vessatorie ex artt. 1341-1342 c.c.).
 */
export const contractDocumentsTable = pgTable("contract_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  contractNumber: text("contract_number").notNull(),
  templateId: integer("template_id").references(() => contractTemplatesTable.id, { onDelete: "set null" }),
  clientId: integer("client_id").references(() => clientsTable.id, { onDelete: "set null" }),
  clientName: text("client_name").notNull(),
  clientEmail: text("client_email"),
  clientVat: text("client_vat"),
  clientAddress: text("client_address"),
  serviceType: text("service_type").notNull(),
  content: text("content").notNull(),
  status: text("status").notNull().default("bozza"),
  value: numeric("value", { precision: 14, scale: 2 }),
  startDate: date("start_date"),
  endDate: date("end_date"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  signedAt: timestamp("signed_at", { withTimezone: true }),
  signedName: text("signed_name"),
  signedIp: text("signed_ip"),
  signedUserAgent: text("signed_user_agent"),
  /** SHA-256 del content al momento della firma: prova che il testo firmato non è cambiato. */
  signedHash: text("signed_hash"),
  vexatiousAcceptedAt: timestamp("vexatious_accepted_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type ContractDocument = typeof contractDocumentsTable.$inferSelect;

/**
 * Proposte di modifica del cliente sul contratto (dal portale), con risposta
 * dell'agenzia. status: proposta | accettata | rifiutata.
 */
export const contractChangeRequestsTable = pgTable("contract_change_requests", {
  id: serial("id").primaryKey(),
  contractId: uuid("contract_id").notNull()
    .references(() => contractDocumentsTable.id, { onDelete: "cascade" }),
  clientId: integer("client_id").notNull()
    .references(() => clientsTable.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  status: text("status").notNull().default("proposta"),
  reply: text("reply"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type ContractChangeRequest = typeof contractChangeRequestsTable.$inferSelect;
