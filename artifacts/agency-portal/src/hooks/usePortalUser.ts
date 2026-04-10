import type { User } from "@supabase/supabase-js";
import { useSupabaseAuth } from "@/auth/SupabaseAuthContext";

/** Shape usato da Sidebar / Settings / Chat (compatibile con il vecchio profilo Clerk). */
export type PortalUserInfo = {
  id?: string;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string;
  fullName?: string | null;
  username?: string | null;
  primaryEmailAddress?: { emailAddress?: string } | null;
  emailAddresses?: { emailAddress?: string }[];
};

function mapSupabaseUser(u: User): PortalUserInfo {
  const meta = u.user_metadata as Record<string, unknown> | undefined;
  const first =
    (typeof meta?.first_name === "string" && meta.first_name) ||
    (typeof meta?.name === "string" ? meta.name.split(/\s+/)[0] : null) ||
    null;
  const last =
    (typeof meta?.last_name === "string" && meta.last_name) ||
    (typeof meta?.name === "string" ? meta.name.split(/\s+/).slice(1).join(" ") : null) ||
    null;
  const full =
    (typeof meta?.full_name === "string" && meta.full_name) ||
    [first, last].filter(Boolean).join(" ").trim() ||
    u.email ||
    null;
  const avatar =
    (typeof meta?.avatar_url === "string" && meta.avatar_url) ||
    (typeof meta?.picture === "string" && meta.picture) ||
    undefined;

  return {
    id: u.id,
    firstName: first,
    lastName: last || null,
    imageUrl: avatar,
    fullName: full,
    username: u.email ?? null,
    primaryEmailAddress: u.email ? { emailAddress: u.email } : null,
    emailAddresses: u.email ? [{ emailAddress: u.email }] : [],
  };
}

export function usePortalUser(): {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: PortalUserInfo | null;
} {
  const { session, user, loading, authDisabled } = useSupabaseAuth();

  if (authDisabled) {
    return { isLoaded: true, isSignedIn: false, user: null };
  }

  if (loading) {
    return { isLoaded: false, isSignedIn: false, user: null };
  }

  return {
    isLoaded: true,
    isSignedIn: !!session,
    user: user ? mapSupabaseUser(user) : null,
  };
}
