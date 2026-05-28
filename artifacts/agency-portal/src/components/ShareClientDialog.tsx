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

  const url = token ? `${window.location.origin}/portal/${token}` : "";

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
          Genera un link da inviare al cliente. Potrà <strong>compilare il Brief</strong> e consultare Eventi,
          Editoriale, Report e File — <strong>senza login</strong>. Chiunque abbia il link può accedere: trattalo come riservato.
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
