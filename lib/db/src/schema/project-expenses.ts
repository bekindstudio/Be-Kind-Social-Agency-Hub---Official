import { pgTable, serial, integer, text, timestamp, numeric } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const projectExpensesTable = pgTable("project_expenses", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  category: text("category").notNull().default("Other"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  date: text("date").notNull(),
  addedBy: text("added_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ProjectExpense = typeof projectExpensesTable.$inferSelect;
