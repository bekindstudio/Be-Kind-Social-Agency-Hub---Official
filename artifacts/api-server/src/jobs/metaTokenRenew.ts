import { and, eq, isNotNull, lte } from "drizzle-orm";
import { db, socialAccountsTable } from "@workspace/db";
import { decrypt, encrypt, isEncrypted } from "../lib/encrypt";
import { logger } from "../lib/logger";
import { exchangeForLongLivedToken } from "../lib/metaClient";

const RENEW_THRESHOLD_DAYS = 10;

function getPlainToken(value: string): string {
  if (!isEncrypted(value)) return value;
  return decrypt(value);
}

export async function renewExpiringTokens(): Promise<void> {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + RENEW_THRESHOLD_DAYS);

  const accounts = await db
    .select()
    .from(socialAccountsTable)
    .where(
      and(
        eq(socialAccountsTable.provider, "meta"),
        eq(socialAccountsTable.isActive, true),
        isNotNull(socialAccountsTable.accessToken),
        isNotNull(socialAccountsTable.tokenExpiresAt),
        lte(socialAccountsTable.tokenExpiresAt, threshold),
      ),
    );

  logger.info(
    { count: accounts.length, threshold: threshold.toISOString() },
    "Meta token renewal: accounts to process",
  );

  let renewed = 0;
  let failed = 0;

  for (const account of accounts) {
    try {
      const encryptedToken = account.accessToken;
      if (!encryptedToken) {
        logger.warn({ accountId: account.id }, "Skipping account: no access token");
        continue;
      }

      const currentToken = getPlainToken(encryptedToken);
      const newTokenData = await exchangeForLongLivedToken(currentToken);

      await db
        .update(socialAccountsTable)
        .set({
          accessToken: encrypt(newTokenData.token),
          tokenExpiresAt: newTokenData.expires,
          updatedAt: new Date(),
        })
        .where(eq(socialAccountsTable.id, account.id));

      renewed += 1;
      logger.info(
        { accountId: account.id, expiresAt: newTokenData.expires.toISOString() },
        "Meta token renewed successfully",
      );
    } catch (err) {
      failed += 1;
      logger.error(
        { accountId: account.id, err },
        "Meta token renewal failed",
      );
    }
  }

  logger.info(
    { renewed, failed, total: accounts.length },
    "Meta token renewal job completed",
  );
}

// Nessun auto-run al boot: il rinnovo gira via Vercel Cron sull'endpoint
// /api/cron/meta-token-renew (vedi routes/cron.ts). In passato un check
// `isMain` qui dentro, una volta bundlato, risultava vero per errore e faceva
// eseguire il job (+ process.exit) all'avvio del server long-running.
