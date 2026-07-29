import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  authorId: integer("author_id"),
  authorName: text("author_name").notNull(),
  authorColor: text("author_color").notNull().default("#6366f1"),
  projectId: integer("project_id"),
  /** Filo diretto cliente↔agenzia (chat del portale). NULL = messaggio di progetto/team. */
  clientId: integer("client_id"),
  /** 'agency' o 'client': chi ha scritto, per allineare le bolle nella chat. */
  source: text("source").notNull().default("agency"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true, createdAt: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;
