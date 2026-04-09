import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const projectMembersTable = pgTable("project_members", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull(),
  role: text("role").notNull().default("Altro"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ProjectMember = typeof projectMembersTable.$inferSelect;
