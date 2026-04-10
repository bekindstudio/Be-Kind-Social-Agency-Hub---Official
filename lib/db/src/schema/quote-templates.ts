import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const QuoteItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
});

export const quoteTemplatesTable = pgTable("quote_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  clientId: integer("client_id"),
  status: text("status").notNull().default("bozza"),
  validityDays: integer("validity_days").notNull().default(30),
  notes: text("notes"),
  items: jsonb("items").notNull().default([]),
  taxRate: integer("tax_rate").notNull().default(22),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertQuoteTemplateSchema = createInsertSchema(quoteTemplatesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQuoteTemplate = z.infer<typeof insertQuoteTemplateSchema>;
export type QuoteTemplate = typeof quoteTemplatesTable.$inferSelect;
