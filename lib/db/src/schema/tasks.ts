import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id"),
  title: text("title").notNull(),
  description: text("description"),
  projectId: integer("project_id"),
  assigneeId: integer("assignee_id"),
  status: text("status").notNull().default("todo"),
  priority: text("priority").notNull().default("medium"),
  dueDate: text("due_date"),
  tipo: text("tipo").notNull().default("semplice"),
  categoria: text("categoria"),
  checklistJson: text("checklist_json").notNull().default("[]"),
  pacchettoContenuti: text("pacchetto_contenuti"),
  meseRiferimento: text("mese_riferimento"),
  monthReference: text("month_reference"),
  contentPackage: text("content_package"),
  position: integer("position").default(0),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdBy: text("created_by"),
  estimatedHours: integer("estimated_hours"),
  focusScore: integer("focus_score"),
  lastPostponedAt: timestamp("last_postponed_at", { withTimezone: true }),
  postponedCount: integer("postponed_count").notNull().default(0),
  completedFromFocus: boolean("completed_from_focus").notNull().default(false),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
