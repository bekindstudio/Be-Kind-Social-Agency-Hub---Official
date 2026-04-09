import { pgTable, serial, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";

export const clientBriefs = pgTable("client_briefs", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }).unique(),
  rawText: text("raw_text").notNull().default(""),
  parsedJson: text("parsed_json").notNull().default("{}"),
  strategyHtml: text("strategy_html").notNull().default(""),
  strategyStatus: text("strategy_status").notNull().default("empty"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
});

export type ClientBrief = typeof clientBriefs.$inferSelect;
