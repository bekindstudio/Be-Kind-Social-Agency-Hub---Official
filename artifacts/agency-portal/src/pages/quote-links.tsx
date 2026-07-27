import { useEffect, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { portalFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Copy, Check, Link2, Ban, Inbox, Plus, Loader2 } from "lucide-react";

/**
 * Gestione del configuratore preventivo: genera un link personale per ogni
 * prospect, e leggi i preventivi che hanno composto (i lead) anche se non hanno
 * pagato. Il prospect compila su /preventivo/:token.
 */

const eur = (n: number) => `${Number(n).toLocaleString("it-IT")} €`;

type QuoteLink = { id: number; token: string; prospectName: string; note: string | null; status: string; url: string; createdAt: string; preset: string[] };
type Service = { key: string; name: string; category: string };
type Lead = {
  id: number; prospectName: string | null; email: string | null; phone: string | null;
  months: number; monthlySubtotal: number; oneoffSubtotal: number; discountPct: number;
  contractTotal: number; deposit: number; status: string; createdAt: string;
};

export default function QuoteLinksPage() {
  const { toast } = useToast();
  const [links, setLinks] = useState<QuoteLink[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [tab, setTab] = useState<"links" | "leads">("links");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [preset, setPreset] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    const [l, r, s] = await Promise.all([
      portalFetch("/api/quote-links").then((x) => x.json()).catch(() => []),
      portalFetch("/api/quote-requests").then((x) => x.json()).catch(() => []),
      portalFetch("/api/quote-services").then((x) => x.json()).catch(() => []),
    ]);
    setLinks(Array.isArray(l) ? l : []);
    setLeads(Array.isArray(r) ? r : []);
    setServices(Array.isArray(s) ? s.filter((x: any) => x.active !== false) : []);
  };
  useEffect(() => { void load(); }, []);

  const create = async () => {
    if (name.trim().length < 2) return;
    setCreating(true);
    try {
      const r = await portalFetch("/api/quote-links", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectName: name.trim(), note: note.trim() || undefined, preset }),
      });
      if (!r.ok) throw new Error();
      setName(""); setNote(""); setPreset([]);
      await load();
      toast({ title: "Link creato", description: "Copialo e mandalo al potenziale cliente." });
    } catch { toast({ variant: "destructive", title: "Creazione non riuscita" }); }
    finally { setCreating(false); }
  };

  const copy = async (url: string) => {
    try { await navigator.clipboard.writeText(url); setCopied(url); setTimeout(() => setCopied(null), 1500); }
    catch { /* ignore */ }
  };

  const disable = async (id: number) => {
    await portalFetch(`/api/quote-links/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "disabled" }),
    });
    await load();
  };

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="text-primary" size={24} /> Preventivo online
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Genera un link personale: il potenziale cliente compone il suo pacchetto, vede il prezzo e blocca la data pagando il primo mese.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit mb-5">
          <button onClick={() => setTab("links")} className={`px-3 py-1.5 rounded-md text-sm font-medium ${tab === "links" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
            <Link2 size={14} className="inline mr-1.5" />Link ({links.filter((l) => l.status === "active").length})
          </button>
          <button onClick={() => setTab("leads")} className={`px-3 py-1.5 rounded-md text-sm font-medium ${tab === "leads" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
            <Inbox size={14} className="inline mr-1.5" />Preventivi ricevuti ({leads.length})
          </button>
        </div>

        {tab === "links" && (
          <>
            <div className="rounded-xl border border-card-border bg-card p-4 mb-6">
              <h2 className="text-sm font-semibold mb-3">Nuovo link per un prospect</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome del potenziale cliente *"
                  className="px-3 py-2 text-sm border border-input rounded-lg bg-background" />
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota interna (facoltativa)"
                  className="px-3 py-2 text-sm border border-input rounded-lg bg-background" />
              </div>
              {services.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-1.5">Servizi consigliati (pre-selezionati all'apertura)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {services.map((s) => {
                      const on = preset.includes(s.key);
                      return (
                        <button key={s.key} type="button"
                          onClick={() => setPreset((p) => on ? p.filter((k) => k !== s.key) : [...p, s.key])}
                          className={`px-2.5 py-1 rounded-full text-xs border ${on ? "bg-primary/10 border-primary text-primary font-semibold" : "border-input text-muted-foreground hover:bg-muted"}`}>
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <button onClick={create} disabled={creating || name.trim().length < 2}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50">
                {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Crea link
              </button>
            </div>

            <div className="space-y-2">
              {links.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nessun link ancora. Creane uno qui sopra.</p>}
              {links.map((l) => (
                <div key={l.id} className={`rounded-xl border p-3 flex items-center gap-3 ${l.status === "active" ? "border-card-border bg-card" : "border-card-border bg-muted/40 opacity-70"}`}>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{l.prospectName} {l.status !== "active" && <span className="text-[10px] text-muted-foreground">· disattivato</span>}</p>
                    <p className="text-xs text-muted-foreground truncate">{l.url}</p>
                    {l.note && <p className="text-xs text-muted-foreground/80 truncate">{l.note}</p>}
                  </div>
                  <button onClick={() => copy(l.url)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground" title="Copia link">
                    {copied === l.url ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                  </button>
                  {l.status === "active" && (
                    <button onClick={() => disable(l.id)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground" title="Disattiva"><Ban size={16} /></button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "leads" && (
          <div className="space-y-2">
            {leads.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nessun preventivo composto ancora.</p>}
            {leads.map((d) => (
              <div key={d.id} className="rounded-xl border border-card-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{d.prospectName ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.email || "no email"}{d.phone ? ` · ${d.phone}` : ""} · {new Date(d.createdAt).toLocaleDateString("it-IT")}
                    </p>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 ${d.status === "deposit_paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {d.status === "deposit_paid" ? "Acconto pagato" : "Composto"}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span className="text-muted-foreground">{eur(d.monthlySubtotal)}/mese × {d.months}{d.discountPct > 0 ? ` · -${d.discountPct}%` : ""}</span>
                  {d.oneoffSubtotal > 0 && <span className="text-muted-foreground">+ {eur(d.oneoffSubtotal)} una tantum</span>}
                  <span className="font-semibold">Totale {eur(d.contractTotal)}</span>
                  <span className="text-primary font-semibold">Acconto {eur(d.deposit)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
