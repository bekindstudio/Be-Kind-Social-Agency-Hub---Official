import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clientsTable = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  color: text("color").notNull().default("#7a8f5c"),
  logoUrl: text("logo_url"),
  // Dati di fatturazione
  ragioneSociale: text("ragione_sociale"),
  piva: text("piva"),
  codiceFiscale: text("codice_fiscale"),
  indirizzo: text("indirizzo"),
  cap: text("cap"),
  citta: text("citta"),
  provincia: text("provincia"),
  paese: text("paese").default("Italia"),
  website: text("website"),
  notes: text("notes"),
  // Social / integrazioni
  instagramHandle: text("instagram_handle"),
  metaPageId: text("meta_page_id"),
  metaIgAccountId: text("meta_ig_account_id"),
  metaAdAccountId: text("meta_ad_account_id"),
  googleAdsId: text("google_ads_id"),
  driveUrl: text("drive_url"),
  // Report automatici
  autoReportEnabled: text("auto_report_enabled").default("false"),
  autoReportDay: text("auto_report_day").default("1"),
  reportRecipientEmail: text("report_recipient_email"),
  // Client management v2
  nomeCommerciale: text("nome_commerciale"),
  settore: text("settore"),
  dimensione: text("dimensione"),
  brandColor: text("brand_color").default("#7a8f5c"),
  descrizione: text("descrizione"),
  comeAcquisito: text("come_acquisito"),
  clienteDal: text("cliente_dal"),
  noteInterne: text("note_interne"),
  healthScore: integer("health_score").default(50),
  tagsJson: text("tags_json").notNull().default("[]"),
  accountManagerId: integer("account_manager_id"),
  contractStatus: text("contract_status").default("nessuno"),
  monthlyValue: integer("monthly_value").default(0),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertClientSchema = createInsertSchema(clientsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clientsTable.$inferSelect;
