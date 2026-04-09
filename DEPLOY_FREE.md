# Deploy gratuito (Vercel + Render + Supabase)

Questa guida pubblica l'app in produzione con costi zero (con limiti free tier).

## 1) Prerequisiti

- Repository su GitHub aggiornato.
- Build locale OK:
  - `pnpm -w run typecheck`
  - `pnpm -w run build`
- Chiavi e password sensibili non committate.

## 2) Backend su Render (free)

- Crea un nuovo **Web Service** da GitHub.
- Root directory: `artifacts/api-server`
- Build command: `pnpm install && pnpm run build`
- Start command: `pnpm run start` (deve essere **esattamente** questo; se vedi nei log `Running '1'` hai messo `1` nel campo Start invece del comando, oppure il campo Start è vuoto e un valore si è corrotto — correggi e ridistribuisci.)

Variabili ambiente consigliate (Render -> Environment):

- `PORT=8080` (o lascia quella di Render se mappata automaticamente)
- `DATABASE_URL=postgresql://...`
- `CLERK_PUBLISHABLE_KEY=pk_...`
- `AI_INTEGRATIONS_ANTHROPIC_BASE_URL=https://api.anthropic.com`
- `AI_INTEGRATIONS_ANTHROPIC_API_KEY=...`
- `AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1`
- `AI_INTEGRATIONS_OPENAI_API_KEY=...`
- `FRONTEND_URLS=https://<tuo-frontend>.vercel.app`

Nota: `FRONTEND_URLS` accetta piu' domini separati da virgola.

## 3) Frontend su Vercel (free)

Monorepo: imposta **Root Directory** vuota (root del repo) cosi' Vercel legge `vercel.json` nella root.

- Root directory: **`.`** (lascia vuoto / repository root, **non** solo `artifacts/agency-portal` a meno che non configuri install monorepo a mano)
- `vercel.json` in root gia' contiene: `installCommand`, `buildCommand` (solo portal), `outputDirectory: artifacts/agency-portal/dist/public`

Se invece imposti Root su `artifacts/agency-portal`, allora **Output directory** deve essere **`dist/public`** (non `public`). Su monorepo e' piu' semplice usare la root del repo come sopra.

**Vercel – se compare "No Output Directory named public":** in Project Settings imposta **Framework Preset** su **Other** (cosi' non sovrascrive l'output). Rimuovi override manuali su "Output Directory" che puntano a `public`. Il repo include `vercel.json` in root e opzionale in `artifacts/agency-portal/` con `framework: null` e `outputDirectory` corretto.

Variabili ambiente (Vercel -> Environment Variables):

- `VITE_CLERK_PUBLISHABLE_KEY=pk_...`
- `VITE_SUPABASE_URL=https://...supabase.co`
- `VITE_SUPABASE_ANON_KEY=...`
- `VITE_API_PROXY_TARGET=https://<tuo-backend>.onrender.com` (solo dev locale; in produzione Vercel usa i `rewrites` in `vercel.json` verso lo stesso host Render)

Opzionale solo per **demo senza login** (non adatto a dati sensibili in pubblico):

- `VITE_AUTH_DISABLED=true`

Se cambi URL del backend Render, aggiorna anche `rewrites` in `vercel.json` (root e/o `artifacts/agency-portal/vercel.json`) con il nuovo dominio.

## 4) Configurazioni esterne

- Clerk:
  - aggiungi dominio Vercel in allowed origins/redirect URLs.
- Supabase:
  - verifica policy RLS e URL progetto corretta.

## 5) Test produzione

- Login funzionante.
- Creazione cliente salvata su DB.
- Apertura dettaglio cliente.
- Task/Projects/Reports caricano senza errori.

## 6) Limiti del piano gratuito

- Render free puo' andare in sleep (prima richiesta piu' lenta).
- Supabase free ha limiti di storage e compute.
- Vercel free ha limiti di bandwidth/build minutes.
