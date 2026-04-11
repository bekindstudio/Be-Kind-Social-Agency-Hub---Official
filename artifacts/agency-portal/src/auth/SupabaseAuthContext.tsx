import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { getSupabaseBrowserClient, initSupabaseFromEnvOrApi } from "@/lib/supabase-browser";
import { AUTH_DISABLED as authDisabled } from "@/config/auth-mode";

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** true se URL/chiave Supabase non risolvibili (né Vite né /api/public/supabase-config). */
  supabaseConfigMissing: boolean;
  authDisabled: boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!authDisabled);
  const [supabaseConfigMissing, setSupabaseConfigMissing] = useState(false);

  const sessionRef = useRef<Session | null>(null);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (authDisabled) {
      setAuthTokenGetter(null);
      setLoading(false);
      setSupabaseConfigMissing(false);
      return;
    }

    let cancelled = false;
    const subRef: { current: { unsubscribe: () => void } | null } = { current: null };

    void (async () => {
      const ok = await initSupabaseFromEnvOrApi();
      if (cancelled) return;
      if (!ok) {
        setSupabaseConfigMissing(true);
        setLoading(false);
        setAuthTokenGetter(null);
        return;
      }

      let supabase: ReturnType<typeof getSupabaseBrowserClient>;
      try {
        supabase = getSupabaseBrowserClient();
      } catch {
        if (!cancelled) {
          setSupabaseConfigMissing(true);
          setLoading(false);
          setAuthTokenGetter(null);
        }
        return;
      }

      setAuthTokenGetter(() => sessionRef.current?.access_token ?? null);

      const {
        data: { session: s },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, next) => {
        setSession(next);
        setUser(next?.user ?? null);
      });
      subRef.current = subscription;
    })();

    return () => {
      cancelled = true;
      subRef.current?.unsubscribe();
    };
  }, [authDisabled]);

  const signOut = useCallback(async () => {
    if (authDisabled) return;
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user,
      loading: authDisabled ? false : loading,
      supabaseConfigMissing: authDisabled ? false : supabaseConfigMissing,
      authDisabled,
      signOut,
    }),
    [session, user, loading, supabaseConfigMissing, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSupabaseAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error("useSupabaseAuth deve essere usato dentro SupabaseAuthProvider");
  }
  return v;
}
