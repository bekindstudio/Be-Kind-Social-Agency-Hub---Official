import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";

export const contractTemplatesTable = pgTable("contract_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  /** Slug tipo servizio (es. social_mensile, ads) — allineato a `service_type` nei seed. */
  type: text("type").notNull().default("Servizi"),
  content: text("content").notNull().default(""),
  status: text("status").notNull().default("bozza"),
  /** Elenco chiavi variabili es. ["NOME_CLIENTE","IMPORTO_MENSILE"] */
  variables: jsonb("variables").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertContractTemplateSchema = createInsertSchema(contractTemplatesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertContractTemplate = z.infer<typeof insertContractTemplateSchema>;
export type ContractTemplate = typeof contractTemplatesTable.$inferSelect;
