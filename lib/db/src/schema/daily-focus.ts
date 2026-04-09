import { pgTable, text, serial, timestamp, integer, jsonb, real } from "drizzle-orm/pg-core";

export const dailyFocusSessionsTable = pgTable("daily_focus_sessions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: text("date").notNull(),
  tasksShownJson: jsonb("tasks_shown_json").default([]),
  tasksCompletedJson: jsonb("tasks_completed_json").default([]),
  tasksSkippedJson: jsonb("tasks_skipped_json").default([]),
  tasksDelegatedJson: jsonb("tasks_delegated_json").default([]),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  completionRate: real("completion_rate").default(0),
});

export const taskFocusActionsTable = pgTable("task_focus_actions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  taskId: integer("task_id").notNull(),
  date: text("date").notNull(),
  action: text("action").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
