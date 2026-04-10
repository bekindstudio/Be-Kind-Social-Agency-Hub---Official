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
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  authDisabled: boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

const authDisabled =
  import.meta.env.VITE_AUTH_DISABLED === "true" || import.meta.env.VITE_AUTH_DISABLED === "1";

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!authDisabled);

  const sessionRef = useRef<Session | null>(null);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (authDisabled) {
      setAuthTokenGetter(null);
      setLoading(false);
      return;
    }

    let supabase: ReturnType<typeof getSupabaseBrowserClient>;
    try {
      supabase = getSupabaseBrowserClient();
    } catch {
      setLoading(false);
      setAuthTokenGetter(null);
      return;
    }

    setAuthTokenGetter(() => sessionRef.current?.access_token ?? null);

    void supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

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
      authDisabled,
      signOut,
    }),
    [session, user, loading, signOut],
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
