import { pgTable, text, serial, timestamp, integer, boolean, real } from "drizzle-orm/pg-core";

export const timeEntriesTable = pgTable("time_entries", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  clientId: integer("client_id"),
  projectId: integer("project_id"),
  taskId: integer("task_id"),
  description: text("description"),
  activityType: text("activity_type"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  pausedSeconds: integer("paused_seconds").notNull().default(0),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  isBillable: boolean("is_billable").notNull().default(true),
  isManual: boolean("is_manual").notNull().default(false),
  hourlyRate: real("hourly_rate"),
  amount: real("amount"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const timerSessionsTable = pgTable("timer_sessions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  clientId: integer("client_id"),
  projectId: integer("project_id"),
  taskId: integer("task_id"),
  description: text("description"),
  activityType: text("activity_type"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  pausedAt: timestamp("paused_at", { withTimezone: true }),
  resumedAt: timestamp("resumed_at", { withTimezone: true }),
  totalPausedSeconds: integer("total_paused_seconds").notNull().default(0),
  status: text("status").notNull().default("running"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const timesheetsTable = pgTable("timesheets", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  weekStart: text("week_start").notNull(),
  weekEnd: text("week_end").notNull(),
  status: text("status").notNull().default("draft"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  totalHours: real("total_hours").notNull().default(0),
  billableHours: real("billable_hours").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const billingRatesTable = pgTable("billing_rates", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id"),
  userId: text("user_id"),
  activityType: text("activity_type"),
  hourlyRate: real("hourly_rate").notNull(),
  validFrom: text("valid_from"),
  validTo: text("valid_to"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
