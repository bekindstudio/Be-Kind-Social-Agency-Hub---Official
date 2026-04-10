import { eq, sql } from "drizzle-orm";
import { db, teamMembersTable } from "@workspace/db";

/**
 * Collega la riga `team_members` all’UUID Supabase (`clerk_user_id`) quando l’email del JWT
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
    rows.find((r) => !r.clerkUserId) ?? rows.find((r) => r.clerkUserId === supabaseUserId);
  if (!candidate) return;
  if (candidate.clerkUserId && candidate.clerkUserId !== supabaseUserId) return;
  if (candidate.clerkUserId === supabaseUserId) return;

  await db
    .update(teamMembersTable)
    .set({ clerkUserId: supabaseUserId })
    .where(eq(teamMembersTable.id, candidate.id));
}
