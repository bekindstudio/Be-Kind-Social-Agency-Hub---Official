import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const projectMilestonesTable = pgTable("project_milestones", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  dueDate: text("due_date"),
  status: text("status").notNull().default("pending"),
  linkedTasksJson: text("linked_tasks_json").notNull().default("[]"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ProjectMilestone = typeof projectMilestonesTable.$inferSelect;
