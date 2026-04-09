import { pgTable, text, serial, timestamp, integer, jsonb, boolean, date, time } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";

export const contentCategoriesTable = pgTable("content_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#7a8f5c"),
  icon: text("icon").notNull().default("Tag"),
  description: text("description"),
  clientId: integer("client_id").references(() => clientsTable.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const editorialPlansTable = pgTable("editorial_plans", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clientsTable.id, { onDelete: "cascade" }).notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  status: text("status").notNull().default("bozza"),
  platformsJson: jsonb("platforms_json").notNull().default("[]"),
  packageType: text("package_type").notNull().default("standard"),
  notesInternal: text("notes_internal"),
  createdBy: text("created_by"),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  sentToClientAt: timestamp("sent_to_client_at", { withTimezone: true }),
  confirmedByClientAt: timestamp("confirmed_by_client_at", { withTimezone: true }),
  pdfUrl: text("pdf_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const editorialSlotsTable = pgTable("editorial_slots", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").references(() => editorialPlansTable.id, { onDelete: "cascade" }).notNull(),
  platform: text("platform").notNull(),
  contentType: text("content_type").notNull().default("post"),
  categoryId: integer("category_id").references(() => contentCategoriesTable.id, { onDelete: "set null" }),
  publishDate: date("publish_date"),
  publishTime: time("publish_time"),
  title: text("title"),
  caption: text("caption"),
  hashtagsJson: jsonb("hashtags_json").default("[]"),
  callToAction: text("call_to_action"),
  linkInBio: text("link_in_bio"),
  visualUrl: text("visual_url"),
  visualDescription: text("visual_description"),
  notesInternal: text("notes_internal"),
  notesClient: text("notes_client"),
  status: text("status").notNull().default("da_creare"),
  position: integer("position").notNull().default(0),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const slotCommentsTable = pgTable("slot_comments", {
  id: serial("id").primaryKey(),
  slotId: integer("slot_id").references(() => editorialSlotsTable.id, { onDelete: "cascade" }).notNull(),
  authorId: text("author_id").notNull(),
  content: text("content").notNull(),
  isResolved: boolean("is_resolved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const editorialTemplatesTable = pgTable("editorial_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  packageType: text("package_type").notNull().default("standard"),
  slotsJson: jsonb("slots_json").notNull().default("[]"),
  createdBy: text("created_by"),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertContentCategorySchema = createInsertSchema(contentCategoriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertContentCategory = z.infer<typeof insertContentCategorySchema>;
export type ContentCategory = typeof contentCategoriesTable.$inferSelect;

export const insertEditorialPlanSchema = createInsertSchema(editorialPlansTable).omit({ id: true, createdAt: true, updatedAt: true, approvedAt: true, sentToClientAt: true, confirmedByClientAt: true });
export type InsertEditorialPlan = z.infer<typeof insertEditorialPlanSchema>;
export type EditorialPlan = typeof editorialPlansTable.$inferSelect;

export const insertEditorialSlotSchema = createInsertSchema(editorialSlotsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEditorialSlot = z.infer<typeof insertEditorialSlotSchema>;
export type EditorialSlot = typeof editorialSlotsTable.$inferSelect;

export const insertSlotCommentSchema = createInsertSchema(slotCommentsTable).omit({ id: true, createdAt: true });
export type InsertSlotComment = z.infer<typeof insertSlotCommentSchema>;
export type SlotComment = typeof slotCommentsTable.$inferSelect;

export const insertEditorialTemplateSchema = createInsertSchema(editorialTemplatesTable).omit({ id: true, createdAt: true });
export type InsertEditorialTemplate = z.infer<typeof insertEditorialTemplateSchema>;
export type EditorialTemplate = typeof editorialTemplatesTable.$inferSelect;
