import { pgTable, text, serial, timestamp, date, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const teamMembersTable = pgTable("team_members", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id"),
  name: text("name").notNull(),
  surname: text("surname").notNull().default(""),
  email: text("email").notNull(),
  phone: text("phone").default(""),
  role: text("role").notNull().default("Collaboratore"),
  department: text("department").default(""),
  birthDate: date("birth_date"),
  hireDate: date("hire_date"),
  photoUrl: text("photo_url").default(""),
  avatarColor: text("avatar_color").notNull().default("#6366f1"),
  linkedin: text("linkedin").default(""),
  notes: text("notes").default(""),
  isActive: text("is_active").notNull().default("true"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const teamClientAccessTable = pgTable("team_client_access", {
  id: serial("id").primaryKey(),
  teamMemberId: integer("team_member_id").notNull(),
  clientId: integer("client_id").notNull(),
  grantedBy: text("granted_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTeamMemberSchema = createInsertSchema(teamMembersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type TeamMember = typeof teamMembersTable.$inferSelect;
