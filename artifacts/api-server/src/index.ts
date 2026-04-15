import { logger } from "./lib/logger";

// Guard produzione — blocca avvio se bypass attivo
if (
  process.env.NODE_ENV === "production" &&
  process.env.API_AUTH_DISABLED === "true"
) {
  console.error(
    "[SECURITY] FATAL: API_AUTH_DISABLED=true in produzione.\n" +
    "Imposta API_AUTH_DISABLED=false su Render e riavvia.",
  );
  process.exit(1);
}

const { default: app } = await import("./app");

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
