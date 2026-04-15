import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";

export const clientCompetitorsTable = pgTable("client_competitors", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: integer("client_id")
    .notNull()
    .references(() => clientsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  profileUrl: text("profile_url").notNull().default(""),
  platform: text("platform").notNull(),
  followers: integer("followers").notNull().default(0),
  followersPrevious: integer("followers_previous"),
  engagementRate: real("engagement_rate").notNull().default(0),
  postsPerWeek: integer("posts_per_week").notNull().default(0),
  isPrimary: boolean("is_primary").notNull().default(false),
  notes: text("notes").notNull().default(""),
  topContent: text("top_content"),
  observedStrategy: text("observed_strategy"),
  strengths: text("strengths").array().notNull().default([]),
  weaknesses: text("weaknesses").array().notNull().default([]),
  updateHistory: jsonb("update_history").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type ClientCompetitor = typeof clientCompetitorsTable.$inferSelect;
export type InsertClientCompetitor = typeof clientCompetitorsTable.$inferInsert;
