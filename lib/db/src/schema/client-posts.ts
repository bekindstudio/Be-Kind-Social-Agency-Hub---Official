import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";

export const clientPostsTable = pgTable("client_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: integer("client_id")
    .notNull()
    .references(() => clientsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  caption: text("caption").notNull().default(""),
  platform: text("platform").notNull(),
  status: text("status").notNull().default("draft"),
  scheduledDate: timestamp("scheduled_date", { withTimezone: true }),
  mediaUrls: text("media_urls").array().notNull().default([]),
  hashtags: text("hashtags").array().notNull().default([]),
  internalNotes: text("internal_notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type ClientPost = typeof clientPostsTable.$inferSelect;
export type InsertClientPost = typeof clientPostsTable.$inferInsert;
