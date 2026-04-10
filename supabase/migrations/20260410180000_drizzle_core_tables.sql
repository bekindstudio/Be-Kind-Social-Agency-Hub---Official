CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"company" text,
	"color" text DEFAULT '#7a8f5c' NOT NULL,
	"logo_url" text,
	"ragione_sociale" text,
	"piva" text,
	"codice_fiscale" text,
	"indirizzo" text,
	"cap" text,
	"citta" text,
	"provincia" text,
	"paese" text DEFAULT 'Italia',
	"website" text,
	"notes" text,
	"instagram_handle" text,
	"meta_page_id" text,
	"meta_ig_account_id" text,
	"meta_ad_account_id" text,
	"google_ads_id" text,
	"drive_url" text,
	"auto_report_enabled" text DEFAULT 'false',
	"auto_report_day" text DEFAULT '1',
	"report_recipient_email" text,
	"nome_commerciale" text,
	"settore" text,
	"dimensione" text,
	"brand_color" text DEFAULT '#7a8f5c',
	"descrizione" text,
	"come_acquisito" text,
	"cliente_dal" text,
	"note_interne" text,
	"health_score" integer DEFAULT 50,
	"tags_json" text DEFAULT '[]' NOT NULL,
	"account_manager_id" integer,
	"contract_status" text DEFAULT 'nessuno',
	"monthly_value" integer DEFAULT 0,
	"last_activity_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer,
	"name" text NOT NULL,
	"description" text,
	"type_json" text DEFAULT '[]' NOT NULL,
	"status" text DEFAULT 'planning' NOT NULL,
	"color" text,
	"project_manager_id" integer,
	"start_date" text,
	"end_date" text,
	"progress" integer DEFAULT 0 NOT NULL,
	"deadline" text,
	"budget" numeric(12, 2),
	"budget_speso" numeric(12, 2),
	"ore_stimate" integer,
	"ore_lavorate" integer,
	"payment_structure" text,
	"billing_rate" numeric(12, 2),
	"health_status" text DEFAULT 'on-track',
	"is_recurring" boolean DEFAULT false NOT NULL,
	"recurrence_type" text,
	"template_id" integer,
	"notes" text,
	"last_activity_at" timestamp with time zone,
	"category" text,
	"is_private" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer,
	"title" text NOT NULL,
	"description" text,
	"project_id" integer,
	"assignee_id" integer,
	"status" text DEFAULT 'todo' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"due_date" text,
	"tipo" text DEFAULT 'semplice' NOT NULL,
	"categoria" text,
	"checklist_json" text DEFAULT '[]' NOT NULL,
	"pacchetto_contenuti" text,
	"mese_riferimento" text,
	"month_reference" text,
	"content_package" text,
	"position" integer DEFAULT 0,
	"completed_at" timestamp with time zone,
	"created_by" text,
	"estimated_hours" integer,
	"focus_score" integer,
	"last_postponed_at" timestamp with time zone,
	"postponed_count" integer DEFAULT 0 NOT NULL,
	"completed_from_focus" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "team_client_access" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_member_id" integer NOT NULL,
	"client_id" integer NOT NULL,
	"granted_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "team_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" text,
	"name" text NOT NULL,
	"surname" text DEFAULT '' NOT NULL,
	"email" text NOT NULL,
	"phone" text DEFAULT '',
	"role" text DEFAULT 'Collaboratore' NOT NULL,
	"department" text DEFAULT '',
	"birth_date" date,
	"hire_date" date,
	"photo_url" text DEFAULT '',
	"avatar_color" text DEFAULT '#6366f1' NOT NULL,
	"linkedin" text DEFAULT '',
	"notes" text DEFAULT '',
	"is_active" text DEFAULT 'true' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"author_id" integer,
	"author_name" text NOT NULL,
	"author_color" text DEFAULT '#6366f1' NOT NULL,
	"project_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "files" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"type" text NOT NULL,
	"size" integer,
	"project_id" integer,
	"uploaded_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "quote_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"client_id" integer,
	"status" text DEFAULT 'bozza' NOT NULL,
	"validity_days" integer DEFAULT 30 NOT NULL,
	"notes" text,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tax_rate" integer DEFAULT 22 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"numero" text NOT NULL,
	"client_id" integer NOT NULL,
	"referente_cliente" text,
	"oggetto" text DEFAULT 'Contratto Gestione Social e ADV' NOT NULL,
	"data_stipula" text NOT NULL,
	"data_inizio" text NOT NULL,
	"data_fine" text NOT NULL,
	"preavviso_giorni" integer DEFAULT 30 NOT NULL,
	"servizi_json" text DEFAULT '[]' NOT NULL,
	"tranche_pagamento_json" text DEFAULT '[]' NOT NULL,
	"importo_totale" integer DEFAULT 0 NOT NULL,
	"clausole_json" text DEFAULT '{}' NOT NULL,
	"note_iva" text DEFAULT 'Importi non soggetti a IVA ai sensi dell''art. 1, commi 54-89, Legge n. 190/2014',
	"iban" text,
	"marca_da_bollo" integer DEFAULT 0 NOT NULL,
	"stato" text DEFAULT 'bozza' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "social_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"provider" text DEFAULT 'meta' NOT NULL,
	"meta_user_id" text,
	"meta_user_name" text,
	"access_token" text,
	"token_expires_at" timestamp with time zone,
	"pages" jsonb DEFAULT '[]',
	"instagram_accounts" jsonb DEFAULT '[]',
	"ad_accounts" jsonb DEFAULT '[]',
	"instagram_insights" jsonb,
	"facebook_insights" jsonb,
	"meta_ads_insights" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "client_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"tipo" text DEFAULT 'mensile' NOT NULL,
	"period" text NOT NULL,
	"period_label" text NOT NULL,
	"periodo_inizio" timestamp with time zone,
	"periodo_fine" timestamp with time zone,
	"status" text DEFAULT 'bozza' NOT NULL,
	"titolo" text,
	"riepilogo_esecutivo" text,
	"analisi_insights" text,
	"strategia_prossimo_periodo" text,
	"note_aggiuntive" text,
	"ai_summary" text,
	"ai_flag" boolean DEFAULT false,
	"ai_flags" jsonb,
	"metrics_json" jsonb,
	"kpi_social_json" jsonb,
	"kpi_meta_json" jsonb,
	"kpi_google_json" jsonb,
	"top_contenuti_json" jsonb,
	"pdf_url" text,
	"recipient_email" text,
	"subject" text,
	"inviato_a_email" text,
	"inviato_at" timestamp with time zone,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"scheduled_for" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "report_approvals" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" integer NOT NULL,
	"reviewer_id" text NOT NULL,
	"azione" text NOT NULL,
	"nota" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "ai_conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"context_type" text DEFAULT 'general' NOT NULL,
	"context_id" text,
	"is_starred" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "ai_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"tokens_used" integer,
	"feedback" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"link" text,
	"entity_type" text,
	"entity_id" integer,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "user_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" text NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_clerk_user_id_unique" UNIQUE("clerk_user_id")
);

CREATE TABLE "activity_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"user_name" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer,
	"entity_name" text,
	"details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "client_briefs" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"raw_text" text DEFAULT '' NOT NULL,
	"parsed_json" text DEFAULT '{}' NOT NULL,
	"strategy_html" text DEFAULT '' NOT NULL,
	"strategy_status" text DEFAULT 'empty' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_briefs_client_id_unique" UNIQUE("client_id")
);

CREATE TABLE "content_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#7a8f5c' NOT NULL,
	"icon" text DEFAULT 'Tag' NOT NULL,
	"description" text,
	"client_id" integer,
	"position" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "editorial_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"status" text DEFAULT 'bozza' NOT NULL,
	"platforms_json" jsonb DEFAULT '[]' NOT NULL,
	"package_type" text DEFAULT 'standard' NOT NULL,
	"notes_internal" text,
	"created_by" text,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"sent_to_client_at" timestamp with time zone,
	"confirmed_by_client_at" timestamp with time zone,
	"pdf_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "editorial_slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" integer NOT NULL,
	"platform" text NOT NULL,
	"content_type" text DEFAULT 'post' NOT NULL,
	"category_id" integer,
	"publish_date" date,
	"publish_time" time,
	"title" text,
	"caption" text,
	"hashtags_json" jsonb DEFAULT '[]',
	"call_to_action" text,
	"link_in_bio" text,
	"visual_url" text,
	"visual_description" text,
	"notes_internal" text,
	"notes_client" text,
	"status" text DEFAULT 'da_creare' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "editorial_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"package_type" text DEFAULT 'standard' NOT NULL,
	"slots_json" jsonb DEFAULT '[]' NOT NULL,
	"created_by" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "slot_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"slot_id" integer NOT NULL,
	"author_id" text NOT NULL,
	"content" text NOT NULL,
	"is_resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "daily_focus_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"tasks_shown_json" jsonb DEFAULT '[]'::jsonb,
	"tasks_completed_json" jsonb DEFAULT '[]'::jsonb,
	"tasks_skipped_json" jsonb DEFAULT '[]'::jsonb,
	"tasks_delegated_json" jsonb DEFAULT '[]'::jsonb,
	"tasks_postponed_json" jsonb DEFAULT '[]'::jsonb,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"completion_rate" real DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "task_focus_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"task_id" integer NOT NULL,
	"date" text NOT NULL,
	"action" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "billing_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer,
	"user_id" text,
	"activity_type" text,
	"hourly_rate" real NOT NULL,
	"valid_from" text,
	"valid_to" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "time_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"client_id" integer,
	"project_id" integer,
	"task_id" integer,
	"description" text,
	"activity_type" text,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"paused_seconds" integer DEFAULT 0 NOT NULL,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"is_billable" boolean DEFAULT true NOT NULL,
	"is_manual" boolean DEFAULT false NOT NULL,
	"hourly_rate" real,
	"amount" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "timer_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"client_id" integer,
	"project_id" integer,
	"task_id" integer,
	"description" text,
	"activity_type" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paused_at" timestamp with time zone,
	"resumed_at" timestamp with time zone,
	"total_paused_seconds" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "timesheets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"week_start" text NOT NULL,
	"week_end" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp with time zone,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"total_hours" real DEFAULT 0 NOT NULL,
	"billable_hours" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "client_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"nome" text NOT NULL,
	"cognome" text NOT NULL,
	"ruolo" text,
	"email" text NOT NULL,
	"telefono" text,
	"whatsapp" text,
	"linkedin" text,
	"is_primary" text DEFAULT 'false' NOT NULL,
	"metodo_contatto_preferito" text,
	"orario_preferito" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "client_services" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"tipo_servizio" text NOT NULL,
	"configurazione_json" text DEFAULT '{}' NOT NULL,
	"attivo" text DEFAULT 'true' NOT NULL,
	"data_inizio" text,
	"data_fine" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "client_billing" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"partita_iva" text,
	"codice_fiscale" text,
	"sdi" text,
	"pec" text,
	"indirizzo_fatturazione" text,
	"metodo_pagamento" text,
	"termini_pagamento" text,
	"iban" text,
	"valore_mensile" integer DEFAULT 0,
	"note_fatturazione" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "client_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"piattaforma" text NOT NULL,
	"identificativo" text,
	"livello_accesso" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "client_meetings" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"data" text NOT NULL,
	"durata_minuti" integer,
	"tipo" text,
	"partecipanti_json" text DEFAULT '[]' NOT NULL,
	"note" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "client_activity_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"user_id" text,
	"azione" text NOT NULL,
	"dettagli_json" text DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "project_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" text DEFAULT 'Altro' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "project_milestones" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"due_date" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"linked_tasks_json" text DEFAULT '[]' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "project_expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"description" text NOT NULL,
	"category" text DEFAULT 'Other' NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"date" text NOT NULL,
	"added_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "project_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'Altro' NOT NULL,
	"description" text,
	"structure_json" text DEFAULT '{}' NOT NULL,
	"is_system" text DEFAULT 'false' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "project_activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"details_json" text DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "client_reports" ADD CONSTRAINT "client_reports_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "report_approvals" ADD CONSTRAINT "report_approvals_report_id_client_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."client_reports"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "client_briefs" ADD CONSTRAINT "client_briefs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "content_categories" ADD CONSTRAINT "content_categories_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "editorial_plans" ADD CONSTRAINT "editorial_plans_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "editorial_slots" ADD CONSTRAINT "editorial_slots_plan_id_editorial_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."editorial_plans"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "editorial_slots" ADD CONSTRAINT "editorial_slots_category_id_content_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."content_categories"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "slot_comments" ADD CONSTRAINT "slot_comments_slot_id_editorial_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."editorial_slots"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "client_services" ADD CONSTRAINT "client_services_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "client_billing" ADD CONSTRAINT "client_billing_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "client_credentials" ADD CONSTRAINT "client_credentials_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "client_meetings" ADD CONSTRAINT "client_meetings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "client_activity_log" ADD CONSTRAINT "client_activity_log_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "project_expenses" ADD CONSTRAINT "project_expenses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "project_activity" ADD CONSTRAINT "project_activity_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
