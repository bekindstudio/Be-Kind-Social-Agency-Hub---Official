import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const userRoles = pgTable("user_roles", {
  id: serial("id").primaryKey(),
  /** UUID Supabase Auth (`sub`); colonna DB legacy `clerk_user_id`. */
  authUserId: text("clerk_user_id").notNull().unique(),
  role: text("role").notNull().default("viewer"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
});
