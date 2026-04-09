import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";

export const clientActivityLogTable = pgTable("client_activity_log", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  userId: text("user_id"),
  azione: text("azione").notNull(),
  dettagliJson: text("dettagli_json").notNull().default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ClientActivityLog = typeof clientActivityLogTable.$inferSelect;
