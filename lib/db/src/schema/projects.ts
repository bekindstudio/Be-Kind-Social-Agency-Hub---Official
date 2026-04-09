import { pgTable, text, serial, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id"),
  name: text("name").notNull(),
  description: text("description"),
  typeJson: text("type_json").notNull().default("[]"),
  status: text("status").notNull().default("planning"),
  color: text("color"),
  projectManagerId: integer("project_manager_id"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  progress: integer("progress").notNull().default(0),
  deadline: text("deadline"),
  budget: numeric("budget", { precision: 12, scale: 2 }),
  budgetSpeso: numeric("budget_speso", { precision: 12, scale: 2 }),
  oreStimate: integer("ore_stimate"),
  oreLavorate: integer("ore_lavorate"),
  paymentStructure: text("payment_structure"),
  billingRate: numeric("billing_rate", { precision: 12, scale: 2 }),
  healthStatus: text("health_status").default("on-track"),
  isRecurring: boolean("is_recurring").notNull().default(false),
  recurrenceType: text("recurrence_type"),
  templateId: integer("template_id"),
  notes: text("notes"),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
  category: text("category"),
  isPrivate: boolean("is_private").notNull().default(false),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
