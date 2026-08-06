import { useEffect, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { portalFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Copy, Check, Link2, Ban, Inbox, Plus, Loader2, Tags, Save, SlidersHorizontal, EyeOff } from "lucide-react";

/**
 * Gestione del configuratore preventivo: genera un link personale per ogni
 * prospect, e leggi i preventivi che hanno composto (i lead) anche se non hanno
 * pagato. Il prospect compila su /preventivo/:token.
 */

const eur = (n: number) => `${Number(n).toLocaleString("it-IT")} €`;

type Tier = { label: string; value: string; price: number };
type Override = { basePrice?: number; unitPrice?: number; tiers?: Record<string, number>; hidden?: boolean };
type QuoteLink = { id: number; token: string; prospectName: string; note: string | null; status: string; url: string; createdAt: string; preset: string[]; priceOverrides: Record<string, Override> };
type Service = {
  id: number; key: string; name: string; description: string | null; category: string;
  billing: "monthly" | "oneoff"; pricing: "fixed" | "tiered" | "per_unit";
  basePrice: number; unitLabel: string | null; unitPrice: number | null; tiers: Tier[]; active: boolean;
};
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
  const [tab, setTab] = useState<"links" | "leads" | "prezzi">("links");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [preset, setPreset] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [pricingFor, setPricingFor] = useState<number | null>(null);

  const load = async () => {
    const [l, r, s] = await Promise.all([
      portalFetch("/api/quote-links").then((x) => x.json()).catch(() => []),
      portalFetch("/api/quote-requests").then((x) => x.json()).catch(() => []),
      portalFetch("/api/quote-services").then((x) => x.json()).catch(() => []),
    ]);
    setLinks(Array.isArray(l) ? l : []);
    setLeads(Array.isArray(r) ? r : []);
    // Tutti i servizi (anche inattivi): la tab Prezzi deve poterli riattivare.
    setServices(Array.isArray(s) ? s : []);
  };
  const activeServices = services.filter((s) => s.active);
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
          <button onClick={() => setTab("prezzi")} className={`px-3 py-1.5 rounded-md text-sm font-medium ${tab === "prezzi" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
            <Tags size={14} className="inline mr-1.5" />Prezzi & servizi
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
              {activeServices.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-1.5">Servizi consigliati (pre-selezionati all'apertura)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {activeServices.map((s) => {
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
              {links.map((l) => {
                const custom = Object.keys(l.priceOverrides ?? {}).length;
                return (
                <div key={l.id} className={`rounded-xl border ${l.status === "active" ? "border-card-border bg-card" : "border-card-border bg-muted/40 opacity-70"}`}>
                  <div className="p-3 flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {l.prospectName}
                        {custom > 0 && <span className="ml-2 text-[10px] font-semibold text-primary bg-primary/10 rounded-full px-1.5 py-0.5">prezzi su misura</span>}
                        {l.status !== "active" && <span className="text-[10px] text-muted-foreground"> · disattivato</span>}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{l.url}</p>
                      {l.note && <p className="text-xs text-muted-foreground/80 truncate">{l.note}</p>}
                    </div>
                    <button onClick={() => setPricingFor(pricingFor === l.id ? null : l.id)}
                      className={`p-2 rounded-lg hover:bg-muted ${pricingFor === l.id ? "text-primary bg-primary/10" : "text-muted-foreground"}`} title="Prezzi per questo cliente">
                      <SlidersHorizontal size={16} />
                    </button>
                    <button onClick={() => copy(l.url)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground" title="Copia link">
                      {copied === l.url ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                    </button>
                    {l.status === "active" && (
                      <button onClick={() => disable(l.id)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground" title="Disattiva"><Ban size={16} /></button>
                    )}
                  </div>
                  {pricingFor === l.id && (
                    <LinkPriceEditor link={l} services={services}
                      onSaved={(updated) => { setLinks((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x))); setPricingFor(null); }} />
                  )}
                </div>
                );
              })}
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
                      {d.email || "nessuna email"}{d.phone ? ` · ${d.phone}` : ""} · {new Date(d.createdAt).toLocaleDateString("it-IT")}
                    </p>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 bg-amber-100 text-amber-700">
                    Composto
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

        {tab === "prezzi" && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Modifica prezzi, scaglioni e disponibilità. Le modifiche valgono subito su tutti i link.
            </p>
            {Object.entries(groupServices(services)).map(([cat, list]) => (
              <div key={cat}>
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">{cat}</h3>
                <div className="space-y-2">
                  {list.map((s) => (
                    <ServicePriceRow key={s.id} service={s} onSaved={(updated) =>
                      setServices((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

function groupServices(arr: Service[]): Record<string, Service[]> {
  const out: Record<string, Service[]> = {};
  for (const s of arr) (out[s.category] ??= []).push(s);
  return out;
}

/**
 * Editor prezzi per un singolo cliente (link). Ogni campo parte dal prezzo
 * globale; se lo cambi diventa un override salvato solo su questo link. Puoi
 * anche nascondere un servizio per questo cliente. Al salvataggio inviamo solo
 * ciò che differisce dal catalogo, così i link restano puliti.
 */
function LinkPriceEditor({ link, services, onSaved }: { link: QuoteLink; services: Service[]; onSaved: (l: QuoteLink) => void }) {
  const { toast } = useToast();
  const activeServices = services.filter((s) => s.active);
  const [state, setState] = useState(() => {
    const init: Record<string, { basePrice: number; unitPrice: number; tiers: Record<string, number>; hidden: boolean }> = {};
    for (const s of activeServices) {
      const ov = link.priceOverrides?.[s.key] ?? {};
      init[s.key] = {
        basePrice: ov.basePrice ?? s.basePrice,
        unitPrice: ov.unitPrice ?? s.unitPrice ?? 0,
        tiers: Object.fromEntries(s.tiers.map((t) => [t.value, ov.tiers?.[t.value] ?? t.price])),
        hidden: !!ov.hidden,
      };
    }
    return init;
  });
  const [saving, setSaving] = useState(false);

  const set = (key: string, patch: Partial<{ basePrice: number; unitPrice: number; hidden: boolean }>) =>
    setState((p) => ({ ...p, [key]: { ...p[key], ...patch } }));
  const setTier = (key: string, value: string, price: number) =>
    setState((p) => ({ ...p, [key]: { ...p[key], tiers: { ...p[key].tiers, [value]: price } } }));

  const save = async () => {
    // Costruisci gli override: solo ciò che differisce dal catalogo globale.
    const overrides: Record<string, Override> = {};
    for (const s of activeServices) {
      const st = state[s.key];
      if (st.hidden) { overrides[s.key] = { hidden: true }; continue; }
      const entry: Override = {};
      if (s.pricing === "fixed" && st.basePrice !== s.basePrice) entry.basePrice = st.basePrice;
      if (s.pricing === "per_unit" && st.unitPrice !== (s.unitPrice ?? 0)) entry.unitPrice = st.unitPrice;
      if (s.pricing === "tiered") {
        const diff: Record<string, number> = {};
        for (const t of s.tiers) if (st.tiers[t.value] !== t.price) diff[t.value] = st.tiers[t.value];
        if (Object.keys(diff).length) entry.tiers = diff;
      }
      if (Object.keys(entry).length) overrides[s.key] = entry;
    }
    setSaving(true);
    try {
      const r = await portalFetch(`/api/quote-links/${link.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ priceOverrides: overrides }),
      });
      if (!r.ok) throw new Error();
      const updated = await r.json();
      onSaved(updated);
      toast({ title: "Prezzi salvati", description: `Su misura per ${link.prospectName}` });
    } catch { toast({ variant: "destructive", title: "Salvataggio non riuscito" }); }
    finally { setSaving(false); }
  };

  const suffix = (s: Service) => (s.billing === "oneoff" ? "una tantum" : "/mese");

  return (
    <div className="border-t border-card-border bg-muted/30 px-3 py-3">
      <p className="text-xs text-muted-foreground mb-3">
        Prezzi solo per <b>{link.prospectName}</b>. Ciò che non tocchi resta al prezzo di listino.
      </p>
      <div className="space-y-2">
        {activeServices.map((s) => {
          const st = state[s.key];
          const changed =
            st.hidden ||
            (s.pricing === "fixed" && st.basePrice !== s.basePrice) ||
            (s.pricing === "per_unit" && st.unitPrice !== (s.unitPrice ?? 0)) ||
            (s.pricing === "tiered" && s.tiers.some((t) => st.tiers[t.value] !== t.price));
          return (
            <div key={s.id} className={`rounded-lg border p-2.5 bg-card ${st.hidden ? "opacity-60" : ""} ${changed && !st.hidden ? "border-primary/40" : "border-card-border"}`}>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-sm font-medium truncate">{s.name} {changed && !st.hidden && <span className="text-[10px] text-primary">· modificato</span>}</span>
                <button onClick={() => set(s.key, { hidden: !st.hidden })}
                  className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ${st.hidden ? "bg-zinc-200 text-zinc-600" : "text-muted-foreground hover:bg-muted"}`}
                  title={st.hidden ? "Nascosto a questo cliente" : "Nascondi a questo cliente"}>
                  <EyeOff size={12} /> {st.hidden ? "Nascosto" : "Nascondi"}
                </button>
              </div>
              {!st.hidden && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  {s.pricing === "fixed" && (
                    <OverrideField label="Prezzo" suffix={suffix(s)} def={s.basePrice} value={st.basePrice} onChange={(v) => set(s.key, { basePrice: v })} />
                  )}
                  {s.pricing === "per_unit" && (
                    <OverrideField label={`/ ${s.unitLabel ?? "unità"}`} suffix={suffix(s)} def={s.unitPrice ?? 0} value={st.unitPrice} onChange={(v) => set(s.key, { unitPrice: v })} />
                  )}
                  {s.pricing === "tiered" && s.tiers.map((t) => (
                    <OverrideField key={t.value} label={t.label} suffix={suffix(s)} def={t.price} value={st.tiers[t.value]} onChange={(v) => setTier(s.key, t.value, v)} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex justify-end">
        <button onClick={save} disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salva prezzi cliente
        </button>
      </div>
    </div>
  );
}

function OverrideField({ label, suffix, def, value, onChange }: { label: string; suffix: string; def: number; value: number; onChange: (n: number) => void }) {
  const changed = value !== def;
  return (
    <div>
      <label className="block text-[11px] text-muted-foreground mb-0.5">{label}</label>
      <div className={`inline-flex items-center rounded-lg border bg-background overflow-hidden ${changed ? "border-primary" : "border-input"}`}>
        <input type="number" min={0} value={value}
          onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
          className="w-20 px-2 py-1.5 text-sm text-right bg-transparent focus:outline-none tabular-nums" />
        <span className="px-2 text-xs text-muted-foreground border-l border-input">€ {suffix}</span>
      </div>
      {changed && <p className="text-[10px] text-muted-foreground mt-0.5">listino {def} €</p>}
    </div>
  );
}

/** Riga editabile di un servizio: prezzi, scaglioni, attivo. Salvataggio esplicito. */
function ServicePriceRow({ service, onSaved }: { service: Service; onSaved: (s: Service) => void }) {
  const { toast } = useToast();
  const [name, setName] = useState(service.name);
  const [basePrice, setBasePrice] = useState(service.basePrice);
  const [unitPrice, setUnitPrice] = useState(service.unitPrice ?? 0);
  const [tiers, setTiers] = useState<Tier[]>(service.tiers);
  const [active, setActive] = useState(service.active);
  const [saving, setSaving] = useState(false);

  const dirty =
    name !== service.name || basePrice !== service.basePrice || unitPrice !== (service.unitPrice ?? 0) ||
    active !== service.active || JSON.stringify(tiers) !== JSON.stringify(service.tiers);

  const suffix = service.billing === "oneoff" ? "una tantum" : "/mese";

  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { name, active };
      if (service.pricing === "fixed") body.basePrice = basePrice;
      if (service.pricing === "per_unit") body.unitPrice = unitPrice;
      if (service.pricing === "tiered") body.tiers = tiers;
      const r = await portalFetch(`/api/quote-services/${service.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error();
      const updated = await r.json();
      onSaved(updated);
      toast({ title: "Prezzo aggiornato", description: service.name });
    } catch { toast({ variant: "destructive", title: "Salvataggio non riuscito" }); }
    finally { setSaving(false); }
  };

  return (
    <div className={`rounded-xl border p-3 ${active ? "border-card-border bg-card" : "border-card-border bg-muted/40"}`}>
      <div className="flex items-center gap-2 mb-2">
        <input value={name} onChange={(e) => setName(e.target.value)}
          className="flex-1 min-w-0 font-medium text-sm bg-transparent border-b border-transparent hover:border-input focus:border-primary focus:outline-none py-0.5" />
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 cursor-pointer">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-primary" />
          Attivo
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {service.pricing === "fixed" && (
          <PriceField label="Prezzo" suffix={suffix} value={basePrice} onChange={setBasePrice} />
        )}
        {service.pricing === "per_unit" && (
          <PriceField label={`Prezzo / ${service.unitLabel ?? "unità"}`} suffix={suffix} value={unitPrice} onChange={setUnitPrice} />
        )}
        {service.pricing === "tiered" && tiers.map((t, i) => (
          <PriceField key={t.value} label={t.label} suffix={suffix} value={t.price}
            onChange={(v) => setTiers((prev) => prev.map((x, xi) => (xi === i ? { ...x, price: v } : x)))} />
        ))}
      </div>

      {dirty && (
        <div className="mt-3 flex justify-end">
          <button onClick={save} disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold disabled:opacity-50">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Salva
          </button>
        </div>
      )}
    </div>
  );
}

function PriceField({ label, suffix, value, onChange }: { label: string; suffix: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <label className="block text-[11px] text-muted-foreground mb-0.5">{label}</label>
      <div className="inline-flex items-center rounded-lg border border-input bg-background overflow-hidden">
        <input type="number" min={0} value={value}
          onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
          className="w-20 px-2 py-1.5 text-sm text-right bg-transparent focus:outline-none tabular-nums" />
        <span className="px-2 text-xs text-muted-foreground border-l border-input">€ {suffix}</span>
      </div>
    </div>
  );
}
