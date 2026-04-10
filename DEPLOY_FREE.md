# Deploy gratuito (Vercel + Render + Supabase)

Questa guida pubblica l'app in produzione con costi zero (con limiti free tier).

## 1) Prerequisiti

- Repository su GitHub aggiornato.
- Build locale OK:
  - `pnpm -w run typecheck`
  - `pnpm -w run build`
- Chiavi e password sensibili non committate.

## 1b) Checklist veloce (quando vedi 500 su `/api/projects`, dashboard, clienti)

1. **Schema Postgres** — Stesso database che usi in `DATABASE_URL` su Render deve avere tabelle e colonne allineate al codice. Una sola volta (o dopo pull che cambiano lo schema), dalla root del repo:
   - `export DATABASE_URL='postgresql://...'` (stringa da Supabase → **Project Settings → Database**; per `drizzle-kit push` di solito va bene URI con host `db.<ref>.supabase.co` porta **5432**, oppure “Session” se usi il pooler; se `push` fallisce, prova la connection string **non** transaction-pooler.)
   - `pnpm run db:push`
   - Se Drizzle segnala conflitti irrisolvibili e accetti il rischio (meglio backup prima): `pnpm run db:push-force`
2. **Render** — `DATABASE_URL` punta a **quel** stesso progetto Supabase; `SUPABASE_JWT_SECRET` dalla dashboard Supabase (**API → JWT Secret**); `FRONTEND_URLS` include l’URL esatto del sito Vercel (con `https://`).
3. **Vercel** — `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (o publishable); in `vercel.json` il `rewrites` `/api/*` deve puntare al dominio **attuale** del servizio Render (non un URL vecchio).
4. **Auth** — Con login reale: **non** impostare `API_AUTH_DISABLED` (o `false`). Solo demo locale può usare `API_AUTH_DISABLED=true`.
5. **Verifica** — `GET https://<render>/api/healthz` → `{"status":"ok"}`; poi `GET /api/projects` (anche senza auth se in demo) non deve rispondere 500; login sul portale e ricarica dashboard.

**Schema incompleto:** se `/api/projects` va in 500 mentre `/api/clients` funziona, spesso mancano tabelle tipo `project_milestones` / `project_members`. In **Supabase → SQL Editor** esegui le migrazioni in `supabase/migrations/` in ordine (incluso `20260410190000_satellite_tables_and_fks.sql`), oppure `pnpm run db:push` con `DATABASE_URL` dello stesso database.

## 2) Backend su Render (free)

- Crea un nuovo **Web Service** da GitHub.
- Root directory: `artifacts/api-server`
- Build command: `pnpm install && pnpm run build`
- Start command: `pnpm run start` (deve essere **esattamente** questo; se vedi nei log `Running '1'` hai messo `1` nel campo Start invece del comando, oppure il campo Start è vuoto e un valore si è corrotto — correggi e ridistribuisci.)

Variabili ambiente consigliate (Render -> Environment):

- `PORT=8080` (o lascia quella di Render se mappata automaticamente)
- `DATABASE_URL=postgresql://...`
- **`SUPABASE_JWT_SECRET=`** — in Supabase Dashboard → **Project Settings** → **API** → **JWT Secret** (necessario per validare il Bearer inviato dal portal).
- `AI_INTEGRATIONS_ANTHROPIC_BASE_URL=https://api.anthropic.com`
- `AI_INTEGRATIONS_ANTHROPIC_API_KEY=...`
- `AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1`
- `AI_INTEGRATIONS_OPENAI_API_KEY=...`
- `FRONTEND_URLS=https://<tuo-frontend>.vercel.app`

**Amministratori:** `ADMIN_SUPABASE_USER_IDS=<uuid1,uuid2>` (UUID utente Supabase da **Authentication → Users**). Opzionale: puoi unire anche `ADMIN_CLERK_USER_IDS` se hai vecchi ID.

**Solo demo / senza JWT:** `API_AUTH_DISABLED=true` — l’API tratta ogni richiesta come admin (non usare in pubblico con dati reali). Con login Supabase nel portal, imposta **`API_AUTH_DISABLED=false`** (o rimuovi la variabile).

Opzionale: `API_ANONYMOUS_CLERK_USER_ID` se usi ancora il bypass anonimo (default `__api_anonymous__`).

Nota: `FRONTEND_URLS` accetta piu' domini separati da virgola.

## 3) Frontend su Vercel (free)

Monorepo: imposta **Root Directory** vuota (root del repo) cosi' Vercel legge `vercel.json` nella root.

- Root directory: **`.`** (lascia vuoto / repository root, **non** solo `artifacts/agency-portal` a meno che non configuri install monorepo a mano)
- `vercel.json` in root gia' contiene: `installCommand`, `buildCommand` (solo portal), `outputDirectory: artifacts/agency-portal/dist/public`

Se invece imposti Root su `artifacts/agency-portal`, allora **Output directory** deve essere **`dist/public`** (non `public`). Su monorepo e' piu' semplice usare la root del repo come sopra.

**Vercel – se compare "No Output Directory named public":** in Project Settings imposta **Framework Preset** su **Other** (cosi' non sovrascrive l'output). Rimuovi override manuali su "Output Directory" che puntano a `public`. Il repo include `vercel.json` in root e opzionale in `artifacts/agency-portal/` con `framework: null` e `outputDirectory` corretto.

Variabili ambiente (Vercel -> Environment Variables):

- `VITE_SUPABASE_URL=https://...supabase.co`
- `VITE_SUPABASE_ANON_KEY=...`
- `VITE_API_PROXY_TARGET=https://<tuo-backend>.onrender.com` (solo dev locale; in produzione Vercel usa i `rewrites` in `vercel.json` verso lo stesso host Render)

Il portal nel repo **non usa più Clerk nel browser**: non serve `VITE_CLERK_PUBLISHABLE_KEY` a meno di non ripristinare il login.

Se cambi URL del backend Render, aggiorna anche `rewrites` in `vercel.json` (root e/o `artifacts/agency-portal/vercel.json`) con il nuovo dominio.

## 4) Configurazioni esterne

- **Supabase Auth:** crea utenti (email/password o provider). Il portal usa **sign-in email/password** con `VITE_SUPABASE_*`.
- **Redirect URL** (se usi magic link / OAuth): aggiungi il dominio Vercel in **Authentication → URL configuration**.
- RLS: se il browser chiama Supabase direttamente oltre all’API, verifica le policy; l’API Express usa in genere `DATABASE_URL` con privilegi da server.

## 5) Test produzione

- Login Supabase (email/password) e caricamento dashboard.
- Creazione cliente salvata su DB.
- Apertura dettaglio cliente.
- Task/Projects/Reports caricano senza errori.

## 6) Limiti del piano gratuito

- Render free puo' andare in sleep (prima richiesta piu' lenta).
- Supabase free ha limiti di storage e compute.
- Vercel free ha limiti di bandwidth/build minutes.
