-- Indici per migliorare query performance su pattern usati ovunque nel codice.
-- Bersaglio: 1) where(isNull(deletedAt)) presente su quasi ogni list query,
-- 2) lookup per project_id/client_id usati in ACL filtering, 3) ricerca
-- messaggi per project_id (creator GET messages).
--
-- Tutti gli indici sono partial (WHERE deleted_at IS NULL) per minimizzare
-- spazio: i record cancellati NON vengono indicizzati.
--
-- Applicare con: supabase db push  oppure  drizzle-kit migrate.

-- Soft delete partial indexes ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_clients_active        ON clients        (id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_active       ON projects       (id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_active          ON tasks          (id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_active      ON contracts      (id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_quote_templates_active ON quote_templates (id) WHERE deleted_at IS NULL;

-- ACL filtering indexes (project→client lookup, very frequent) ────────────
CREATE INDEX IF NOT EXISTS idx_projects_client_id    ON projects (client_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_project_id      ON tasks    (project_id) WHERE deleted_at IS NULL AND project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_client_id       ON tasks    (client_id)  WHERE deleted_at IS NULL AND client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id     ON tasks    (assignee_id) WHERE deleted_at IS NULL AND assignee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_project_id   ON messages (project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_project_id      ON files    (project_id) WHERE project_id IS NOT NULL;

-- Lookup token share (single-row by token, very frequent on /public/portal/*)
CREATE INDEX IF NOT EXISTS idx_clients_share_token   ON clients (share_token) WHERE share_token IS NOT NULL AND deleted_at IS NULL;

-- Lookup membri team per authUserId (used in messages routes ACL)
CREATE INDEX IF NOT EXISTS idx_team_members_auth_user ON team_members (auth_user_id) WHERE auth_user_id IS NOT NULL;

-- Indici dashboard widget order-by createdAt desc su tabelle large
CREATE INDEX IF NOT EXISTS idx_projects_created_at_desc ON projects (created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_created_at_desc    ON tasks    (created_at DESC) WHERE deleted_at IS NULL;

-- Note: indici cliente_event/client_posts/client_reports per range scheduledDate
-- non aggiunti qui — i volumi attesi sono modesti (<10k record nei prossimi 12 mesi)
-- e sequential scan resta accettabile. Da rivedere se la performance degrada.
