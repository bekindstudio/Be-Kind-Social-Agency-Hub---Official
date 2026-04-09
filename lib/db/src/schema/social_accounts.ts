import { pgTable, serial, integer, text, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";

export const socialAccountsTable = pgTable("social_accounts", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  provider: text("provider").notNull().default("meta"),
  metaUserId: text("meta_user_id"),
  metaUserName: text("meta_user_name"),
  accessToken: text("access_token"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  pages: jsonb("pages").default("[]"),
  instagramAccounts: jsonb("instagram_accounts").default("[]"),
  adAccounts: jsonb("ad_accounts").default("[]"),
  instagramInsights: jsonb("instagram_insights"),
  facebookInsights: jsonb("facebook_insights"),
  metaAdsInsights: jsonb("meta_ads_insights"),
  isActive: boolean("is_active").notNull().default(true),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type SocialAccount = typeof socialAccountsTable.$inferSelect;
export type InsertSocialAccount = typeof socialAccountsTable.$inferInsert;
