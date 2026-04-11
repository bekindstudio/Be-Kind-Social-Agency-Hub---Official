import { eq, sql } from "drizzle-orm";
import { db, teamMembersTable } from "@workspace/db";

/**
 * Collega la riga `team_members` all’UUID Supabase (`authUserId` / colonna `clerk_user_id`) quando l’email del JWT
 * coincide con quella del membro e non è ancora collegata (o coincide già con lo stesso utente).
 */
export async function linkTeamMemberToSupabaseUser(
  supabaseUserId: string,
  email: string | null | undefined,
): Promise<void> {
  if (!email?.trim()) return;
  const normalized = email.trim().toLowerCase();
  const rows = await db
    .select()
    .from(teamMembersTable)
    .where(sql`lower(trim(${teamMembersTable.email})) = ${normalized}`);

  if (rows.length === 0) return;

  const candidate =
    rows.find((r) => !r.authUserId) ?? rows.find((r) => r.authUserId === supabaseUserId);
  if (!candidate) return;
  if (candidate.authUserId && candidate.authUserId !== supabaseUserId) return;
  if (candidate.authUserId === supabaseUserId) return;

  await db
    .update(teamMembersTable)
    .set({ authUserId: supabaseUserId })
    .where(eq(teamMembersTable.id, candidate.id));
}
