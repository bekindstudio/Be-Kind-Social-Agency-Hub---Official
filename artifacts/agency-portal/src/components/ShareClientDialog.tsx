import { useEffect, useState } from "react";
import { portalFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { X, Copy, Link2, RotateCw, Trash2, Loader2, ExternalLink } from "lucide-react";

/**
 * Dialog per generare/copiare/revocare il link di condivisione col cliente.
 * Il link dà accesso (senza login) all'area cliente: Brief (compilabile) +
 * Eventi / Editoriale / Report / File in sola lettura.
 */
export function ShareClientDialog({
  clientId,
  clientName,
  open,
  onClose,
}: {
  clientId: number;
  clientName: string;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [pinSet, setPinSet] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [loginSet, setLoginSet] = useState(false);
  const [loginEmail, setLoginEmail] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);

  const url = token ? `${window.location.origin}/portal/${token}` : "";
  const loginUrl = `${window.location.origin}/accedi`;

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    void (async () => {
      try {
        const r = await portalFetch(`/api/clients/${clientId}`, { credentials: "include" });
        if (!alive) return;
        if (r.ok) {
          const c = await r.json();
          setToken(c?.shareToken ?? null);
          setPinSet(Boolean(c?.portalPinSet));
        }
        const rl = await portalFetch(`/api/clients/${clientId}/portal-login`, { credentials: "include" });
        if (alive && rl.ok) {
          const l = await rl.json();
          setLoginSet(Boolean(l?.set));
          setLoginEmail(l?.email ?? null);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, clientId]);

  const generate = async () => {
    setBusy(true);
    try {
      const r = await portalFetch(`/api/clients/${clientId}/share-link`, { method: "POST", credentials: "include" });
      if (!r.ok) throw new Error("gen");
      const data = await r.json();
      setToken(data.shareToken);
      toast({ title: "Link generato" });
    } catch {
      toast({ variant: "destructive", title: "Impossibile generare il link" });
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    if (!confirm("Revocare il link? Il cliente non potrà più accedere con il link attuale.")) return;
    setBusy(true);
    try {
      const r = await portalFetch(`/api/clients/${clientId}/share-link`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error("rev");
      setToken(null);
      toast({ title: "Link revocato" });
    } catch {
      toast({ variant: "destructive", title: "Impossibile revocare il link" });
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copiato negli appunti" });
    } catch {
      toast({ variant: "destructive", title: "Copia non riuscita", description: "Copia il link manualmente." });
    }
  };

  const savePin = async () => {
    if (!/^\d{4,6}$/.test(pinInput)) { toast({ variant: "destructive", title: "Il PIN deve essere 4-6 cifre" }); return; }
    setPinBusy(true);
    try {
      const r = await portalFetch(`/api/clients/${clientId}/portal-pin`, {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: pinInput }),
      });
      if (!r.ok) throw new Error();
      setPinSet(true); setPinInput("");
      toast({ title: "PIN impostato", description: "Comunicalo tu al cliente." });
    } catch { toast({ variant: "destructive", title: "Impossibile impostare il PIN" }); }
    finally { setPinBusy(false); }
  };
  const removePin = async () => {
    setPinBusy(true);
    try {
      const r = await portalFetch(`/api/clients/${clientId}/portal-pin`, {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: "" }),
      });
      if (!r.ok) throw new Error();
      setPinSet(false); setPinInput("");
      toast({ title: "PIN rimosso" });
    } catch { toast({ variant: "destructive", title: "Impossibile rimuovere il PIN" }); }
    finally { setPinBusy(false); }
  };

  const saveLogin = async () => {
    setLoginBusy(true);
    try {
      const r = await portalFetch(`/api/clients/${clientId}/portal-login`, {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput.trim(), password: passwordInput }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { toast({ variant: "destructive", title: data?.error ?? "Impossibile salvare l'accesso" }); return; }
      setLoginSet(true); setLoginEmail(emailInput.trim()); setPasswordInput("");
      toast({ title: "Accesso impostato", description: "Inoltra al cliente email, password e il link di accesso." });
    } catch { toast({ variant: "destructive", title: "Impossibile salvare l'accesso" }); }
    finally { setLoginBusy(false); }
  };
  const removeLogin = async () => {
    setLoginBusy(true);
    try {
      const r = await portalFetch(`/api/clients/${clientId}/portal-login`, {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "", password: "" }),
      });
      if (!r.ok) throw new Error();
      setLoginSet(false); setLoginEmail(null); setEmailInput(""); setPasswordInput("");
      toast({ title: "Accesso rimosso" });
    } catch { toast({ variant: "destructive", title: "Impossibile rimuovere l'accesso" }); }
    finally { setLoginBusy(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold inline-flex items-center gap-2">
            <Link2 size={16} className="text-primary" /> Condividi con {clientName}
          </h3>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted">
            <X size={14} />
          </button>
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          Genera un link da inviare al cliente. Potrà <strong>compilare il Brief</strong>, <strong>proporre idee
          di contenuto</strong> e consultare Eventi, Editoriale, Report e File — <strong>senza login</strong>.
          Chiunque abbia il link può accedere: trattalo come riservato.
        </p>

        {loading ? (
          <div className="py-6 text-center">
            <Loader2 className="mx-auto animate-spin text-muted-foreground" />
          </div>
        ) : token ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-xs"
              />
              <button onClick={() => void copy()} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
                <Copy size={13} /> Copia
              </button>
            </div>
            <div className="flex items-center justify-between">
              <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                <ExternalLink size={13} /> Anteprima
              </a>
              <div className="flex items-center gap-2">
                <button onClick={() => void generate()} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-input px-2.5 py-1.5 text-xs disabled:opacity-50" title="Genera un nuovo link e invalida quello attuale">
                  <RotateCw size={12} /> Rigenera
                </button>
                <button onClick={() => void revoke()} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-red-200 text-red-600 px-2.5 py-1.5 text-xs disabled:opacity-50">
                  <Trash2 size={12} /> Revoca
                </button>
              </div>
            </div>

            {/* PIN opzionale: seconda chiave, utile se il cliente installa l'app */}
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs font-semibold mb-1">PIN di accesso (opzionale)</p>
              {pinSet ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-emerald-600 font-medium">PIN attivo · il cliente lo inserisce all'apertura</span>
                  <button onClick={() => void removePin()} disabled={pinBusy} className="text-xs text-red-600 hover:underline disabled:opacity-50">Rimuovi</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric" placeholder="4-6 cifre"
                    className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm tracking-widest"
                  />
                  <button onClick={() => void savePin()} disabled={pinBusy || pinInput.length < 4} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
                    {pinBusy ? "…" : "Imposta"}
                  </button>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-1.5">Comunicalo tu al cliente a voce. Non viene salvato in chiaro.</p>
            </div>

            {/* Accesso con email + password: utile se il cliente installa l'app e
                l'icona apre il login. Con queste credenziali entra solo nella sua area. */}
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs font-semibold mb-1">Accesso con email e password</p>
              {loginSet ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-emerald-600 font-medium truncate">Attivo · {loginEmail}</span>
                    <button onClick={() => void removeLogin()} disabled={loginBusy} className="text-xs text-red-600 hover:underline disabled:opacity-50 shrink-0">Rimuovi</button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Il cliente accede da <a href={loginUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">{loginUrl}</a> con la sua email e password. Per cambiare la password, reimposta qui sotto.
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    <input value={emailInput || loginEmail || ""} onChange={(e) => setEmailInput(e.target.value)} type="email" placeholder="email del cliente"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
                    <div className="flex items-center gap-2">
                      <input value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} type="text" placeholder="nuova password (min 6)"
                        className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm" />
                      <button onClick={() => void saveLogin()} disabled={loginBusy || passwordInput.length < 6} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
                        {loginBusy ? "…" : "Aggiorna"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <input value={emailInput} onChange={(e) => setEmailInput(e.target.value)} type="email" placeholder="email del cliente"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
                  <div className="flex items-center gap-2">
                    <input value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} type="text" placeholder="password (min 6)"
                      className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm" />
                    <button onClick={() => void saveLogin()} disabled={loginBusy || !emailInput.trim() || passwordInput.length < 6} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
                      {loginBusy ? "…" : "Imposta"}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Il cliente accederà da <span className="font-mono">{loginUrl}</span> ed entrerà solo nella sua area. La password non viene salvata in chiaro.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <button
            onClick={() => void generate()}
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
            Genera link di condivisione
          </button>
        )}
      </div>
    </div>
  );
}
