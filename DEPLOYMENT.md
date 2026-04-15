## Render Cron Job - Meta Token Renewal

Use this setup if deployment is managed from the Render dashboard and no `render.yaml` is used.

1. Render Dashboard -> New -> Cron Job
2. Name: `meta-token-renewal`
3. Schedule: `0 3 * * *`
4. Build Command:
   - `pnpm --filter @workspace/api-server build`
5. Start Command:
   - `node --enable-source-maps artifacts/api-server/dist/jobs/metaTokenRenew.js`
6. Environment variables:
   - same env vars used by the main API web service
   - `TOKEN_ENCRYPTION_KEY` (required)
   - `META_APP_ID` (required)
   - `META_APP_SECRET` (required)
