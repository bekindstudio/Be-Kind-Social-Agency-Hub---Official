import { pgTable, text, timestamp, uuid, integer, date, numeric } from "drizzle-orm/pg-core";
import { contractTemplatesTable } from "./contract-templates";

/**
 * Contratti generati da template (testo libero + variabili).
 * Nome tabella: `contract_documents` per non confondersi con `contracts` (contratti cliente legacy).
 */
export const contractDocumentsTable = pgTable("contract_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  contractNumber: text("contract_number").notNull(),
  templateId: integer("template_id").references(() => contractTemplatesTable.id, { onDelete: "set null" }),
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
  signedAt: timestamp("signed_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type ContractDocument = typeof contractDocumentsTable.$inferSelect;
