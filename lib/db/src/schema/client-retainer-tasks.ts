import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";

/**
 * Il MODELLO del lavoro mensile di un cliente a retainer — non le task vere.
 * Una riga = "questa cosa si fa ogni mese per questo cliente" (PED, report,
 * programmazione, community). Il job del 1° del mese le materializza in `tasks`.
 *
 * Separare modello e task serve a due cose: cambiare il retainer non riscrive lo
 * storico, e disattivare un cliente non cancella il lavoro già fatto.
 */
export const clientRetainerTasksTable = pgTable("client_retainer_tasks", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  categoria: text("categoria"),
  /** Giorno del mese in cui la task compare. Limitato a 1-28: oltre non esiste a febbraio. */
  dayOfMonth: integer("day_of_month").notNull().default(1),
  estimatedHours: integer("estimated_hours"),
  priority: text("priority").notNull().default("medium"),
  assigneeId: integer("assignee_id"),
  /** Disattivare invece di cancellare: un retainer sospeso torna spesso. */
  active: boolean("active").notNull().default(true),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type ClientRetainerTask = typeof clientRetainerTasksTable.$inferSelect;
