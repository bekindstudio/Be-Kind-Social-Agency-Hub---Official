import { db, socialAccountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { encrypt, isEncrypted } from "../lib/encrypt";

async function migrate() {
  const accounts = await db.select().from(socialAccountsTable);
  let migrated = 0;
  let skipped = 0;

  for (const account of accounts) {
    if (!account.accessToken) {
      skipped++;
      continue;
    }
    if (isEncrypted(account.accessToken)) {
      skipped++;
      continue;
    }
    await db
      .update(socialAccountsTable)
      .set({ accessToken: encrypt(account.accessToken) })
      .where(eq(socialAccountsTable.id, account.id));
    migrated++;
    console.log(`✓ Migrated token for account: ${account.id}`);
  }

  console.log(`\nDone: ${migrated} encrypted, ${skipped} skipped`);
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
