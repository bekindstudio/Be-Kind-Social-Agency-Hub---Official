import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const projectTemplatesTable = pgTable("project_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("Altro"),
  description: text("description"),
  structureJson: text("structure_json").notNull().default("{}"),
  isSystem: text("is_system").notNull().default("false"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ProjectTemplate = typeof projectTemplatesTable.$inferSelect;
