import { useEffect, useMemo, useState } from "react";
import {
  computeQuote,
  type QuoteServiceDef,
  type QuoteSelectionItem,
} from "@workspace/api-zod";
import { Check, Loader2, Lock, Send, Tag, Minus, Plus, Sparkles } from "lucide-react";

/**
 * Configuratore preventivo pubblico. Il prospect apre /preventivo/:token,
 * compone il pacchetto e blocca la data pagando il primo mese. Nessun login:
 * la chiave è il token. Prezzo mostrato in tempo reale (client) ma sempre
 * ricalcolato dal server all'invio.
 */

const API = (token: string, path = "") => `/api/public/preventivo/${encodeURIComponent(token)}${path}`;
const eur = (n: number) => `${n.toLocaleString("it-IT")} €`;

type Loaded = {
  prospectName: string;
  preset: string[];
  services: QuoteServiceDef[];
  settings: { minMonths: number; monthsOptions: number[]; maxDiscountPercent: number };
  stripeEnabled: boolean;
};

type SelState = Record<string, { on: boolean; tier?: string; qty?: number; choices: Record<string, string[]> }>;

export default function QuoteConfiguratorPage({ token }: { token: string }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "invalid">("loading");
  const [sel, setSel] = useState<SelState>({});
  const [months, setMonths] = useState(4);
  const [code, setCode] = useState("");
  const [validCode, setValidCode] = useState<{ code: string; percent: number } | null>(null);
  const [codeMsg, setCodeMsg] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState<null | "code" | "lock" | "send">(null);
  const [sent, setSent] = useState(false);
  const paid = new URLSearchParams(window.location.search).get("pagato") === "1";

  useEffect(() => {
    let alive = true;
    fetch(API(token))
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Loaded) => {
        if (!alive) return;
        setData(d);
        setMonths(d.settings.minMonths);
        // Pre-seleziona i servizi consigliati dall'agenzia per questo prospect.
        const init: SelState = {};
        for (const key of d.preset ?? []) {
          const s = d.services.find((x) => x.key === key);
          if (s) init[key] = { on: true, tier: s.tiers[0]?.value, qty: s.minQty || 1, choices: {} };
        }
        setSel(init);
        setStatus("ready");
      })
      .catch(() => alive && setStatus("invalid"));
    return () => { alive = false; };
  }, [token]);

  const items = useMemo<QuoteSelectionItem[]>(() =>
    Object.entries(sel).filter(([, v]) => v.on).map(([key, v]) => ({ key, tier: v.tier, qty: v.qty, choices: v.choices })),
    [sel]);

  const breakdown = useMemo(() => {
    if (!data) return null;
    return computeQuote(data.services, items, months, validCode?.percent ?? 0);
  }, [data, items, months, validCode]);

  if (status === "loading") {
    return <Centered><Loader2 className="animate-spin text-[#7a8f5c]" size={30} /></Centered>;
  }
  if (status === "invalid" || !data || !breakdown) {
    return <Centered><p className="text-zinc-500">Questo link non è valido o è stato disattivato.</p></Centered>;
  }

  const toggle = (s: QuoteServiceDef) => setSel((p) => {
    const cur = p[s.key];
    if (cur?.on) return { ...p, [s.key]: { ...cur, on: false } };
    return { ...p, [s.key]: { on: true, tier: s.tiers[0]?.value, qty: s.minQty || 1, choices: cur?.choices ?? {} } };
  });
  const setTier = (key: string, tier: string) => setSel((p) => ({ ...p, [key]: { ...p[key], on: true, tier, choices: p[key]?.choices ?? {} } }));
  const setQty = (key: string, qty: number, s: QuoteServiceDef) =>
    setSel((p) => ({ ...p, [key]: { ...p[key], on: true, qty: Math.min(s.maxQty, Math.max(s.minQty, qty)), choices: p[key]?.choices ?? {} } }));
  const toggleChoice = (key: string, optKey: string, choice: string) => setSel((p) => {
    const cur = p[key] ?? { on: true, choices: {} };
    const list = cur.choices[optKey] ?? [];
    const next = list.includes(choice) ? list.filter((c) => c !== choice) : [...list, choice];
    return { ...p, [key]: { ...cur, on: true, choices: { ...cur.choices, [optKey]: next } } };
  });

  const applyCode = async () => {
    if (!code.trim()) return;
    setBusy("code"); setCodeMsg(null);
    try {
      const r = await fetch(API(token, "/quote"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selection: items, months, code: code.trim() }),
      });
      const d = await r.json();
      if (d?.codeValid && d?.breakdown?.codePercent > 0) {
        setValidCode({ code: d.codeApplied, percent: d.breakdown.codePercent });
        setCodeMsg(`Codice applicato: -${d.breakdown.codePercent}%`);
      } else {
        setValidCode(null);
        setCodeMsg("Codice non valido");
      }
    } catch { setCodeMsg("Errore, riprova"); }
    finally { setBusy(null); }
  };

  const submit = async (action: "lock" | "send") => {
    if (items.length === 0) return;
    setBusy(action);
    try {
      const r = await fetch(API(token, "/quote"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selection: items, months, email, phone, code: validCode?.code ?? "" }),
      });
      const d = await r.json();
      if (action === "send") { setSent(true); setBusy(null); return; }
      // lock → checkout Stripe
      const c = await fetch(API(token, "/checkout"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: d.requestId }),
      });
      if (c.ok) { const cj = await c.json(); window.location.href = cj.url; return; }
      // Stripe non configurato → trattalo come richiesta inviata
      setSent(true); setBusy(null);
    } catch { setBusy(null); }
  };

  const byCategory = groupBy(data.services, (s) => s.category);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 pb-40">
      {/* Header */}
      <div className="bg-[#7a8f5c] text-white px-5 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 text-white/80 text-sm mb-2"><Sparkles size={15} /> Be Kind · Preventivo su misura</div>
          <h1 className="text-2xl md:text-3xl font-bold leading-tight">
            Ciao {data.prospectName}, componi la tua collaborazione.
          </h1>
          <p className="text-white/85 text-sm mt-2">
            Scegli i servizi, vedi subito quanto costa. Collaborazione minima {data.settings.minMonths} mesi.
          </p>
        </div>
      </div>

      {paid && (
        <div className="max-w-3xl mx-auto px-5 mt-4">
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 text-sm font-medium">
            Pagamento ricevuto. Ti contattiamo a breve per il contratto e la partenza.
          </div>
        </div>
      )}
      {sent && !paid && (
        <div className="max-w-3xl mx-auto px-5 mt-4">
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 text-sm font-medium">
            Richiesta inviata a Be Kind. Ti ricontattiamo presto.
          </div>
        </div>
      )}

      {/* Servizi */}
      <div className="max-w-3xl mx-auto px-5 mt-6 space-y-7">
        {Object.entries(byCategory).map(([cat, services]) => (
          <div key={cat}>
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">{cat}</h2>
            <div className="space-y-2.5">
              {services.map((s) => {
                const state = sel[s.key];
                const on = !!state?.on;
                return (
                  <div key={s.key} className={`rounded-2xl border bg-white transition-all ${on ? "border-[#7a8f5c] shadow-sm" : "border-zinc-200"}`}>
                    <button type="button" onClick={() => toggle(s)} className="w-full flex items-start gap-3 p-4 text-left">
                      <span className={`shrink-0 mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center ${on ? "bg-[#7a8f5c] border-[#7a8f5c] text-white" : "border-zinc-300"}`}>
                        {on && <Check size={14} strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-semibold">{s.name}</span>
                          <span className="text-sm font-semibold text-zinc-500 whitespace-nowrap">{priceHint(s)}</span>
                        </span>
                        {s.description && <span className="block text-sm text-zinc-500 mt-0.5">{s.description}</span>}
                      </span>
                    </button>

                    {on && (s.pricing === "tiered" || s.pricing === "per_unit" || s.options.length > 0) && (
                      <div className="px-4 pb-4 pl-13 space-y-3">
                        {s.pricing === "tiered" && (
                          <div className="flex flex-wrap gap-2">
                            {s.tiers.map((t) => (
                              <button key={t.value} type="button" onClick={() => setTier(s.key, t.value)}
                                className={`px-3 py-1.5 rounded-lg text-sm border ${state?.tier === t.value ? "bg-[#7a8f5c]/10 border-[#7a8f5c] text-[#5f7047] font-semibold" : "border-zinc-200 hover:bg-zinc-50"}`}>
                                {t.label} · {eur(t.price)}
                              </button>
                            ))}
                          </div>
                        )}
                        {s.pricing === "per_unit" && (
                          <div className="flex items-center gap-3">
                            <div className="inline-flex items-center rounded-lg border border-zinc-200">
                              <button type="button" onClick={() => setQty(s.key, (state?.qty ?? 0) - 1, s)} className="p-2 text-zinc-500 hover:text-zinc-900"><Minus size={15} /></button>
                              <span className="w-10 text-center font-semibold tabular-nums">{state?.qty ?? 0}</span>
                              <button type="button" onClick={() => setQty(s.key, (state?.qty ?? 0) + 1, s)} className="p-2 text-zinc-500 hover:text-zinc-900"><Plus size={15} /></button>
                            </div>
                            <span className="text-sm text-zinc-500">{s.unitLabel} · {eur(s.unitPrice ?? 0)} l'una</span>
                          </div>
                        )}
                        {s.options.map((opt) => (
                          <div key={opt.key}>
                            <p className="text-xs text-zinc-400 font-medium mb-1">{opt.label}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {opt.choices.map((c) => {
                                const active = (state?.choices[opt.key] ?? []).includes(c);
                                return (
                                  <button key={c} type="button" onClick={() => toggleChoice(s.key, opt.key, c)}
                                    className={`px-2.5 py-1 rounded-full text-xs border ${active ? "bg-[#7a8f5c]/10 border-[#7a8f5c] text-[#5f7047] font-semibold" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}>
                                    {c}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Durata + codice + contatti */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Durata</p>
            <div className="flex gap-2">
              {data.settings.monthsOptions.map((m) => (
                <button key={m} type="button" onClick={() => setMonths(m)}
                  className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold ${months === m ? "bg-[#7a8f5c] border-[#7a8f5c] text-white" : "border-zinc-200 hover:bg-zinc-50"}`}>
                  {m} mesi
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Codice sconto</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input value={code} onChange={(e) => { setCode(e.target.value); setValidCode(null); setCodeMsg(null); }}
                  placeholder="Se ne hai uno" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-zinc-200 text-sm uppercase" />
              </div>
              <button type="button" onClick={applyCode} disabled={busy === "code" || !code.trim()}
                className="px-4 rounded-xl border border-zinc-300 text-sm font-semibold hover:bg-zinc-50 disabled:opacity-40">
                {busy === "code" ? "…" : "Applica"}
              </button>
            </div>
            {codeMsg && <p className={`text-xs mt-1 ${validCode ? "text-emerald-600" : "text-amber-600"}`}>{codeMsg}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="La tua email"
              className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefono (facoltativo)"
              className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm" />
          </div>
        </div>
      </div>

      {/* Barra prezzo sticky */}
      <div className="fixed bottom-0 inset-x-0 border-t border-zinc-200 bg-white/95 backdrop-blur">
        <div className="max-w-3xl mx-auto px-5 py-3">
          <div className="flex items-end justify-between gap-4 mb-2">
            <div className="text-sm text-zinc-500 min-w-0">
              {breakdown.discountPercent > 0 && (
                <span className="inline-block text-[11px] font-bold text-[#5f7047] bg-[#7a8f5c]/10 rounded-full px-2 py-0.5 mb-1">
                  Sconto -{breakdown.discountPercent}%{breakdown.bundlePercent > 0 && breakdown.serviceCount >= 3 ? " (più servizi)" : ""}
                </span>
              )}
              {/* Il totale resta visibile ma piccolo: l'headline è il mensile. */}
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                {breakdown.contractTotal > 0 && <span>Su {breakdown.months} mesi · {eur(breakdown.contractTotal)}</span>}
                {breakdown.oneoffSubtotal > 0 && <span>di cui {eur(breakdown.oneoffSubtotal)} una tantum</span>}
              </div>
            </div>
            <div className="text-right shrink-0">
              {breakdown.monthlyDiscounted > 0 ? (
                <>
                  <div className="text-[11px] text-zinc-400 uppercase tracking-wide">Al mese</div>
                  <div className="text-2xl font-extrabold tabular-nums leading-none">{eur(breakdown.monthlyDiscounted)}</div>
                </>
              ) : (
                <>
                  <div className="text-[11px] text-zinc-400 uppercase tracking-wide">Una tantum</div>
                  <div className="text-2xl font-extrabold tabular-nums leading-none">{eur(breakdown.oneoffSubtotal)}</div>
                </>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => submit("send")} disabled={items.length === 0 || busy !== null}
              className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border border-zinc-300 font-semibold text-sm hover:bg-zinc-50 disabled:opacity-40">
              {busy === "send" ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              Invia richiesta
            </button>
            <button type="button" onClick={() => submit("lock")} disabled={items.length === 0 || breakdown.deposit <= 0 || busy !== null}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#7a8f5c] text-white font-bold text-sm hover:opacity-90 disabled:opacity-40">
              {busy === "lock" ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
              Blocca la data · primo mese {eur(breakdown.deposit)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function priceHint(s: QuoteServiceDef): string {
  if (s.pricing === "fixed") return s.billing === "oneoff" ? `${eur(s.basePrice)}` : `${eur(s.basePrice)}/mese`;
  if (s.pricing === "tiered" && s.tiers.length) {
    const min = Math.min(...s.tiers.map((t) => t.price));
    return s.billing === "oneoff" ? `da ${eur(min)}` : `da ${eur(min)}/mese`;
  }
  if (s.pricing === "per_unit") return `${eur(s.unitPrice ?? 0)}/${s.unitLabel ?? "pz"}`;
  return "";
}

function groupBy<T>(arr: T[], key: (t: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const item of arr) { const k = key(item); (out[k] ??= []).push(item); }
  return out;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-6 text-center">{children}</div>;
}
