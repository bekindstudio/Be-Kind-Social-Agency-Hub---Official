import { pgTable, text, serial, timestamp, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";

export const clientReportsTable = pgTable("client_reports", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clientsTable.id, { onDelete: "cascade" }).notNull(),
  tipo: text("tipo").notNull().default("mensile"),
  period: text("period").notNull(),
  periodLabel: text("period_label").notNull(),
  periodoInizio: timestamp("periodo_inizio", { withTimezone: true }),
  periodoFine: timestamp("periodo_fine", { withTimezone: true }),
  status: text("status").notNull().default("bozza"),
  titolo: text("titolo"),
  riepilogoEsecutivo: text("riepilogo_esecutivo"),
  analisiInsights: text("analisi_insights"),
  strategiaProssimoPeriodo: text("strategia_prossimo_periodo"),
  noteAggiuntive: text("note_aggiuntive"),
  aiSummary: text("ai_summary"),
  aiFlag: boolean("ai_flag").default(false),
  aiFlags: jsonb("ai_flags"),
  metricsJson: jsonb("metrics_json"),
  kpiSocialJson: jsonb("kpi_social_json"),
  kpiMetaJson: jsonb("kpi_meta_json"),
  kpiGoogleJson: jsonb("kpi_google_json"),
  topContenutiJson: jsonb("top_contenuti_json"),
  pdfUrl: text("pdf_url"),
  recipientEmail: text("recipient_email"),
  subject: text("subject"),
  inviatoAEmail: text("inviato_a_email"),
  inviatoAt: timestamp("inviato_at", { withTimezone: true }),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const reportApprovalsTable = pgTable("report_approvals", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id").references(() => clientReportsTable.id, { onDelete: "cascade" }).notNull(),
  reviewerId: text("reviewer_id").notNull(),
  azione: text("azione").notNull(),
  nota: text("nota"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertClientReportSchema = createInsertSchema(clientReportsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  approvedAt: true,
  sentAt: true,
  inviatoAt: true,
});
export type InsertClientReport = z.infer<typeof insertClientReportSchema>;
export type ClientReport = typeof clientReportsTable.$inferSelect;
export type ReportApproval = typeof reportApprovalsTable.$inferSelect;
