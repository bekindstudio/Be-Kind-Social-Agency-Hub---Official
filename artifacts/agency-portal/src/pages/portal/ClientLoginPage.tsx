import { useCallback, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, LogIn } from "lucide-react";
import { T, SERIF, heroGradient } from "./theme";

/**
 * Accesso cliente con email + password → porta SOLO alla sua area portale.
 * Pensato per il caso "app installata che apre il login": qui il cliente entra
 * con le sue credenziali (mai l'area agenzia). Al successo memorizza il token
 * così la PWA lo ricorda (vedi guardia standalonePortalToken in App.tsx).
 */
export default function ClientLoginPage() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (!email.trim() || !password) { setError("Inserisci email e password"); return; }
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/public/portal/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data?.token) { setError(data?.error ?? "Email o password non corretti"); return; }
      try { localStorage.setItem("bk_portal_token", data.token); } catch { /* storage non disponibile */ }
      navigate(`/portal/${data.token}`);
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setBusy(false);
    }
  }, [email, password, navigate]);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-6 relative" style={{ background: heroGradient }}>
      <div className="absolute inset-0" style={{ background: "rgba(20,26,14,0.45)" }} />
      <div className="relative w-full max-w-xs text-center animate-in fade-in zoom-in-95 duration-300">
        <div className="w-16 h-16 rounded-2xl bg-white mx-auto flex items-center justify-center mb-5 shadow-lg">
          <LogIn size={26} style={{ color: T.sage }} />
        </div>
        <h1 className="text-white text-2xl font-bold leading-tight" style={{ fontFamily: SERIF }}>La tua area</h1>
        <p className="text-white/75 text-sm mt-1 mb-6">Accedi con l'email e la password che ti ha dato l'agenzia.</p>

        <div className="space-y-2.5 text-left">
          <input
            value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }}
            type="email" inputMode="email" autoComplete="email" placeholder="Email"
            className="w-full rounded-2xl bg-white/95 px-4 py-3.5 text-base focus:outline-none focus:ring-4 focus:ring-white/30"
          />
          <input
            value={password} onChange={(e) => { setPassword(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
            type="password" autoComplete="current-password" placeholder="Password"
            className="w-full rounded-2xl bg-white/95 px-4 py-3.5 text-base focus:outline-none focus:ring-4 focus:ring-white/30"
          />
        </div>
        {error && <p className="text-red-100 text-sm mt-2 font-medium">{error}</p>}

        <button
          onClick={() => void submit()} disabled={busy}
          className="mt-4 w-full py-3.5 rounded-2xl bg-white font-bold text-lg active:scale-[.99] transition-transform disabled:opacity-60 inline-flex items-center justify-center gap-2"
          style={{ color: T.forest }}
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : null}
          {busy ? "Accesso…" : "Entra"}
        </button>
      </div>
    </div>
  );
}
