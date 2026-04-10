import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Log centralizzato per ripristino / eliminazione definitiva (soft delete). */
export const trashLogTable = pgTable("trash_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  tableName: text("table_name").notNull(),
  /** ID record come stringa (serial o uuid). */
  recordId: text("record_id").notNull(),
  recordLabel: text("record_label"),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TrashLogRow = typeof trashLogTable.$inferSelect;
