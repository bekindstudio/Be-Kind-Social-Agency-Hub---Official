import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";

export const clientEventsTable = pgTable("client_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: integer("client_id")
    .notNull()
    .references(() => clientsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  date: timestamp("date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }),
  type: text("type").notNull().default("other"),
  priority: text("priority").notNull().default("medium"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type ClientEventRow = typeof clientEventsTable.$inferSelect;
export type InsertClientEvent = typeof clientEventsTable.$inferInsert;
