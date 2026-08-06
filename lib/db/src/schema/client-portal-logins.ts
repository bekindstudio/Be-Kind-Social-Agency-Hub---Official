import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";

/**
 * Credenziali di accesso del cliente alla sua area portale (email + password).
 * La password è salvata come hash HMAC calcolato dall'API (mai in chiaro).
 * Una riga per cliente; l'email è la chiave di login (univoca).
 */
export const clientPortalLogins = pgTable("client_portal_logins", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull()
    .references(() => clientsTable.id, { onDelete: "cascade" }).unique(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
});

export type ClientPortalLogin = typeof clientPortalLogins.$inferSelect;
