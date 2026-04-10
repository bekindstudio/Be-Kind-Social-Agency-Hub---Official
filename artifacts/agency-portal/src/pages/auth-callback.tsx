import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

/**
 * Destinazione del link d’invito Supabase: hash/query con token; il client con detectSessionInUrl li assorbe.
 */
export default function AuthCallbackPage() {
  const [, setLocation] = useLocation();
  const redirected = useRef(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const goDash = () => {
      if (redirected.current) return;
      redirected.current = true;
      setLocation("/dashboard");
    };
    const goSignIn = () => {
      if (redirected.current) return;
      redirected.current = true;
      setLocation("/sign-in");
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED")) {
        goDash();
      }
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) goDash();
    });

    const t = window.setTimeout(() => {
      void supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) goSignIn();
        else goDash();
      });
    }, 5000);

    return () => {
      window.clearTimeout(t);
      subscription.unsubscribe();
    };
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(83,15%,96%)] p-6">
      <p className="text-sm text-muted-foreground">Completamento accesso…</p>
    </div>
  );
}
