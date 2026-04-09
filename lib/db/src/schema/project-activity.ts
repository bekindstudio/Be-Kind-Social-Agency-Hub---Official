import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const projectActivityTable = pgTable("project_activity", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  userId: text("user_id"),
  action: text("action").notNull(),
  detailsJson: text("details_json").notNull().default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ProjectActivity = typeof projectActivityTable.$inferSelect;
