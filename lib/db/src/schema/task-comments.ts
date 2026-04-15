import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { tasksTable } from "./tasks";

export const taskCommentsTable = pgTable("task_comments", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id")
    .notNull()
    .references(() => tasksTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  authorName: text("author_name").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TaskComment = typeof taskCommentsTable.$inferSelect;
