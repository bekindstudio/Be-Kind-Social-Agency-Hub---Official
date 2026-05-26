-- Tabelle definite nello schema Drizzle ma assenti dalle migrazioni precedenti.
-- Allineano il DB live allo schema (lib/db/src/schema/*.ts). Idempotente e additivo.
-- Eseguito su Supabase il 2026-05-26 via pooler; qui registrato per riproducibilità.

CREATE TABLE IF NOT EXISTS "client_competitors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" integer NOT NULL,
  "name" text NOT NULL,
  "profile_url" text DEFAULT '' NOT NULL,
  "platform" text NOT NULL,
  "followers" integer DEFAULT 0 NOT NULL,
  "followers_previous" integer,
  "engagement_rate" real DEFAULT 0 NOT NULL,
  "posts_per_week" integer DEFAULT 0 NOT NULL,
  "is_primary" boolean DEFAULT false NOT NULL,
  "notes" text DEFAULT '' NOT NULL,
  "top_content" text,
  "observed_strategy" text,
  "strengths" text[] DEFAULT '{}' NOT NULL,
  "weaknesses" text[] DEFAULT '{}' NOT NULL,
  "update_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "client_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" integer NOT NULL,
  "title" text NOT NULL,
  "date" timestamp with time zone NOT NULL,
  "end_date" timestamp with time zone,
  "type" text DEFAULT 'other' NOT NULL,
  "priority" text DEFAULT 'medium' NOT NULL,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "client_posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" integer NOT NULL,
  "title" text NOT NULL,
  "caption" text DEFAULT '' NOT NULL,
  "platform" text NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "scheduled_date" timestamp with time zone,
  "media_urls" text[] DEFAULT '{}' NOT NULL,
  "hashtags" text[] DEFAULT '{}' NOT NULL,
  "internal_notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "task_comments" (
  "id" serial PRIMARY KEY NOT NULL,
  "task_id" integer NOT NULL,
  "user_id" text NOT NULL,
  "author_name" text NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "client_competitors" ADD CONSTRAINT "client_competitors_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "client_events" ADD CONSTRAINT "client_events_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "client_posts" ADD CONSTRAINT "client_posts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
