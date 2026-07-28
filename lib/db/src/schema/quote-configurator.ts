import { pgTable, serial, integer, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

/**
 * Configuratore preventivo self-service. Il prospect apre un link personale,
 * compone il pacchetto, vede il totale con lo sconto bundle e può bloccare la
 * data pagando il primo mese. Ogni preventivo composto resta come lead.
 */

/** Catalogo servizi: il menu che il prospect vede e compone. */
export const quoteServicesTable = pgTable("quote_services", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("Servizi"),
  /** 'monthly' = ricorrente (× mesi). 'oneoff' = una tantum. */
  billing: text("billing").notNull().default("monthly"),
  /** 'fixed' | 'tiered' | 'per_unit'. */
  pricing: text("pricing").notNull().default("fixed"),
  basePrice: integer("base_price").notNull().default(0),
  unitLabel: text("unit_label"),
  unitPrice: integer("unit_price"),
  minQty: integer("min_qty").notNull().default(0),
  maxQty: integer("max_qty").notNull().default(20),
  tiers: jsonb("tiers").notNull().default([]),
  options: jsonb("options").notNull().default([]),
  sort: integer("sort").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const quoteDiscountCodesTable = pgTable("quote_discount_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  percent: integer("percent").notNull().default(0),
  active: boolean("active").notNull().default(true),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Link personale generato per un prospect. Il token è la chiave d'accesso. */
export const quoteLinksTable = pgTable("quote_links", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  prospectName: text("prospect_name").notNull(),
  note: text("note"),
  /** Chiavi servizi pre-selezionate all'apertura. */
  preset: jsonb("preset").notNull().default([]),
  /** Override di prezzo per questo cliente, per chiave servizio. {} = catalogo globale. */
  priceOverrides: jsonb("price_overrides").notNull().default({}),
  createdBy: text("created_by"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Preventivo composto = lead. Salvato anche se il prospect non paga. */
export const quoteRequestsTable = pgTable("quote_requests", {
  id: serial("id").primaryKey(),
  linkToken: text("link_token"),
  prospectName: text("prospect_name"),
  email: text("email"),
  phone: text("phone"),
  selection: jsonb("selection").notNull().default([]),
  months: integer("months").notNull().default(4),
  monthlySubtotal: integer("monthly_subtotal").notNull().default(0),
  oneoffSubtotal: integer("oneoff_subtotal").notNull().default(0),
  discountPct: integer("discount_pct").notNull().default(0),
  discountCode: text("discount_code"),
  contractTotal: integer("contract_total").notNull().default(0),
  deposit: integer("deposit").notNull().default(0),
  status: text("status").notNull().default("composed"),
  stripeSessionId: text("stripe_session_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type QuoteService = typeof quoteServicesTable.$inferSelect;
export type QuoteDiscountCode = typeof quoteDiscountCodesTable.$inferSelect;
export type QuoteLink = typeof quoteLinksTable.$inferSelect;
export type QuoteRequest = typeof quoteRequestsTable.$inferSelect;
