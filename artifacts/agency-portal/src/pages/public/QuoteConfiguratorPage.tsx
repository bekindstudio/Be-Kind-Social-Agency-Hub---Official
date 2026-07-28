import { useEffect, useMemo, useState } from "react";
import {
  computeQuote,
  type QuoteServiceDef,
  type QuoteSelectionItem,
} from "@workspace/api-zod";
import {
  Check, Loader2, Lock, Send, Tag, Minus, Plus, Sparkles,
  ArrowRight, ArrowLeft, PartyPopper,
} from "lucide-react";

/**
 * Configuratore preventivo pubblico, stile Typeform: una schermata alla volta,
 * tipografia grande, transizioni fluide, ottimizzato per mobile. Il prezzo
 * mensile è sempre in vista e si aggiorna mentre il prospect compone.
 * Nessun login: la chiave è il token. Il server ricalcola sempre il prezzo.
 */

const API = (token: string, path = "") => `/api/public/preventivo/${encodeURIComponent(token)}${path}`;
const eur = (n: number) => `${n.toLocaleString("it-IT")} €`;
const GREEN = "#7a8f5c";

const CAT_COPY: Record<string, { q: string; s: string }> = {
  "Gestione": { q: "Partiamo dalla gestione", s: "Chi pensa a piano editoriale, contenuti e pubblicazione." },
  "Contenuti": { q: "Aggiungiamo contenuti?", s: "Reel, video e grafiche extra." },
  "Advertising": { q: "Vuoi far girare pubblicità?", s: "Campagne e newsletter. Il budget pubblicitario è a parte." },
  "Una tantum": { q: "Serve qualcosa all'avvio?", s: "Cose che si fanno una volta sola." },
};

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
  const [si, setSi] = useState(0); // step index
  const paid = new URLSearchParams(window.location.search).get("pagato") === "1";

  useEffect(() => {
    let alive = true;
    fetch(API(token))
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Loaded) => {
        if (!alive) return;
        setData(d);
        setMonths(d.settings.minMonths);
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

  const categories = useMemo(() => {
    const out: string[] = [];
    for (const s of data?.services ?? []) if (!out.includes(s.category)) out.push(s.category);
    return out;
  }, [data]);

  // welcome · una per categoria · durata · contatti · riepilogo
  const steps = useMemo(() => ["welcome", ...categories.map((c) => `cat:${c}`), "durata", "contatti", "riepilogo"], [categories]);

  const items = useMemo<QuoteSelectionItem[]>(() =>
    Object.entries(sel).filter(([, v]) => v.on).map(([key, v]) => ({ key, tier: v.tier, qty: v.qty, choices: v.choices })),
    [sel]);

  const breakdown = useMemo(() => {
    if (!data) return null;
    return computeQuote(data.services, items, months, validCode?.percent ?? 0);
  }, [data, items, months, validCode]);

  if (status === "loading") {
    return <Screen center><Loader2 className="animate-spin" size={30} style={{ color: GREEN }} /></Screen>;
  }
  if (status === "invalid" || !data || !breakdown) {
    return <Screen center><p className="text-zinc-500 text-lg">Questo link non è valido o è stato disattivato.</p></Screen>;
  }

  // ─── success full-screen ───
  if (paid || sent) {
    return (
      <Screen center hero>
        <div className="animate-in fade-in zoom-in-95 duration-500 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-5">
            <PartyPopper size={30} className="text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white leading-tight">
            {paid ? "Perfetto, ci siamo!" : "Richiesta inviata"}
          </h1>
          <p className="text-white/85 mt-3 text-lg">
            {paid
              ? "Pagamento ricevuto. Ti contattiamo a breve per il contratto e la data di partenza."
              : "Abbiamo ricevuto la tua proposta. Ti ricontattiamo prestissimo."}
          </p>
        </div>
      </Screen>
    );
  }

  const stepId = steps[si];
  const isWelcome = stepId === "welcome";
  const isSummary = stepId === "riepilogo";
  const progress = Math.round((si / (steps.length - 1)) * 100);

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

  const next = () => setSi((i) => Math.min(steps.length - 1, i + 1));
  const back = () => setSi((i) => Math.max(0, i - 1));

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
      } else { setValidCode(null); setCodeMsg("Codice non valido"); }
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
      const c = await fetch(API(token, "/checkout"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: d.requestId }),
      });
      if (c.ok) { const cj = await c.json(); window.location.href = cj.url; return; }
      setSent(true); setBusy(null);
    } catch { setBusy(null); }
  };

  const catServices = stepId.startsWith("cat:")
    ? data.services.filter((s) => s.category === stepId.slice(4))
    : [];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-white text-zinc-900">
      {/* Progress + price pill */}
      {!isWelcome && (
        <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-zinc-100">
          <div className="h-1 bg-zinc-100">
            <div className="h-full transition-all duration-500" style={{ width: `${progress}%`, background: GREEN }} />
          </div>
          <div className="max-w-xl mx-auto px-5 py-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400">Passo {si} di {steps.length - 1}</span>
            {breakdown.monthlyDiscounted > 0 && (
              <span className="text-sm font-bold tabular-nums" style={{ color: GREEN }}>
                {eur(breakdown.monthlyDiscounted)}<span className="text-zinc-400 font-medium">/mese</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Step content */}
      <div className="flex-1 flex flex-col justify-center overflow-y-auto">
        <div key={si} className="w-full max-w-xl mx-auto px-6 py-8 animate-in fade-in slide-in-from-bottom-4 duration-300">

          {isWelcome && (
            <div className="text-center">
              <div className="inline-flex items-center gap-1.5 text-sm font-semibold mb-5 px-3 py-1 rounded-full" style={{ color: GREEN, background: `${GREEN}1a` }}>
                <Sparkles size={15} /> Be Kind
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.05]">
                Ciao {data.prospectName}.
              </h1>
              <p className="text-xl md:text-2xl text-zinc-500 mt-4 leading-snug">
                Componi la tua collaborazione. Pochi tap, e vedi subito quanto costa.
              </p>
              <p className="text-sm text-zinc-400 mt-5">Collaborazione minima {data.settings.minMonths} mesi.</p>
              <button onClick={next} className="mt-8 inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-white text-lg font-bold shadow-lg active:scale-[.98] transition-transform" style={{ background: GREEN }}>
                Iniziamo <ArrowRight size={20} />
              </button>
            </div>
          )}

          {stepId.startsWith("cat:") && (
            <div>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight">
                {(CAT_COPY[stepId.slice(4)]?.q) ?? stepId.slice(4)}
              </h2>
              <p className="text-lg text-zinc-500 mt-2 mb-6">{CAT_COPY[stepId.slice(4)]?.s ?? "Scegli quello che ti serve."}</p>
              <div className="space-y-3">
                {catServices.map((s) => {
                  const state = sel[s.key];
                  const on = !!state?.on;
                  return (
                    <div key={s.key} className={`rounded-2xl border-2 bg-white transition-all ${on ? "shadow-md" : "border-zinc-200"}`} style={on ? { borderColor: GREEN } : undefined}>
                      <button type="button" onClick={() => toggle(s)} className="w-full flex items-start gap-3 p-4 text-left">
                        <span className={`shrink-0 mt-0.5 w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-colors`} style={on ? { background: GREEN, borderColor: GREEN } : { borderColor: "#d4d4d8" }}>
                          {on && <Check size={16} strokeWidth={3} className="text-white" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="font-bold text-lg">{s.name}</span>
                            <span className="text-sm font-bold whitespace-nowrap" style={{ color: on ? GREEN : "#71717a" }}>{priceHint(s)}</span>
                          </span>
                          {s.description && <span className="block text-sm text-zinc-500 mt-0.5">{s.description}</span>}
                        </span>
                      </button>

                      {on && (s.pricing === "tiered" || s.pricing === "per_unit" || s.options.length > 0) && (
                        <div className="px-4 pb-4 space-y-3 animate-in fade-in duration-200">
                          {s.pricing === "tiered" && (
                            <div className="flex flex-wrap gap-2">
                              {s.tiers.map((t) => {
                                const act = state?.tier === t.value;
                                return (
                                  <button key={t.value} type="button" onClick={() => setTier(s.key, t.value)}
                                    className="px-3.5 py-2 rounded-xl text-sm border-2 font-semibold transition-colors"
                                    style={act ? { background: `${GREEN}14`, borderColor: GREEN, color: "#4f5e3a" } : { borderColor: "#e4e4e7" }}>
                                    {t.label} · {eur(t.price)}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          {s.pricing === "per_unit" && (
                            <div className="flex items-center gap-3">
                              <div className="inline-flex items-center rounded-xl border-2 border-zinc-200">
                                <button type="button" onClick={() => setQty(s.key, (state?.qty ?? 0) - 1, s)} className="p-2.5 text-zinc-500"><Minus size={16} /></button>
                                <span className="w-10 text-center font-bold tabular-nums">{state?.qty ?? 0}</span>
                                <button type="button" onClick={() => setQty(s.key, (state?.qty ?? 0) + 1, s)} className="p-2.5 text-zinc-500"><Plus size={16} /></button>
                              </div>
                              <span className="text-sm text-zinc-500">{s.unitLabel} · {eur(s.unitPrice ?? 0)} l'una</span>
                            </div>
                          )}
                          {s.options.map((opt) => (
                            <div key={opt.key}>
                              <p className="text-xs text-zinc-400 font-semibold mb-1.5">{opt.label}</p>
                              <div className="flex flex-wrap gap-1.5">
                                {opt.choices.map((c) => {
                                  const active = (state?.choices[opt.key] ?? []).includes(c);
                                  return (
                                    <button key={c} type="button" onClick={() => toggleChoice(s.key, opt.key, c)}
                                      className="px-3 py-1.5 rounded-full text-sm border-2 font-medium transition-colors"
                                      style={active ? { background: `${GREEN}14`, borderColor: GREEN, color: "#4f5e3a" } : { borderColor: "#e4e4e7", color: "#71717a" }}>
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
          )}

          {stepId === "durata" && (
            <div>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight">Per quanto tempo?</h2>
              <p className="text-lg text-zinc-500 mt-2 mb-6">Più lunga la collaborazione, più risultati. Minimo {data.settings.minMonths} mesi.</p>
              <div className="grid grid-cols-3 gap-3">
                {data.settings.monthsOptions.map((m) => {
                  const on = months === m;
                  return (
                    <button key={m} type="button" onClick={() => setMonths(m)}
                      className="py-6 rounded-2xl border-2 font-extrabold text-2xl transition-all active:scale-[.98]"
                      style={on ? { background: GREEN, borderColor: GREEN, color: "#fff" } : { borderColor: "#e4e4e7" }}>
                      {m}<span className="block text-xs font-semibold mt-1 opacity-80">mesi</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {stepId === "contatti" && (
            <div>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight">Come ti ricontattiamo?</h2>
              <p className="text-lg text-zinc-500 mt-2 mb-6">Ci serve solo per mandarti la proposta e il contratto.</p>
              <div className="space-y-3">
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="La tua email"
                  className="w-full px-4 py-4 rounded-2xl border-2 border-zinc-200 text-lg focus:outline-none focus:border-[#7a8f5c]" />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefono (facoltativo)"
                  className="w-full px-4 py-4 rounded-2xl border-2 border-zinc-200 text-lg focus:outline-none focus:border-[#7a8f5c]" />
                <div>
                  <p className="text-xs font-semibold text-zinc-400 mb-1.5 mt-2">Hai un codice sconto?</p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input value={code} onChange={(e) => { setCode(e.target.value); setValidCode(null); setCodeMsg(null); }}
                        placeholder="Se ne hai uno" className="w-full pl-10 pr-3 py-3.5 rounded-2xl border-2 border-zinc-200 text-base uppercase focus:outline-none focus:border-[#7a8f5c]" />
                    </div>
                    <button type="button" onClick={applyCode} disabled={busy === "code" || !code.trim()}
                      className="px-5 rounded-2xl border-2 border-zinc-300 font-bold hover:bg-zinc-50 disabled:opacity-40">
                      {busy === "code" ? "…" : "Applica"}
                    </button>
                  </div>
                  {codeMsg && <p className={`text-sm mt-1.5 font-medium ${validCode ? "text-emerald-600" : "text-amber-600"}`}>{codeMsg}</p>}
                </div>
              </div>
            </div>
          )}

          {isSummary && (
            <div>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight">Ecco la tua proposta.</h2>
              <div className="mt-6 rounded-3xl p-6 text-white shadow-xl" style={{ background: GREEN }}>
                {breakdown.discountPercent > 0 && (
                  <span className="inline-block text-xs font-bold bg-white/25 rounded-full px-2.5 py-1 mb-3">
                    Sconto -{breakdown.discountPercent}%{breakdown.serviceCount >= 3 ? " · più servizi" : ""}
                  </span>
                )}
                <div className="flex items-end gap-2">
                  <span className="text-5xl font-extrabold tabular-nums leading-none">
                    {eur(breakdown.monthlyDiscounted > 0 ? breakdown.monthlyDiscounted : breakdown.oneoffSubtotal)}
                  </span>
                  <span className="text-white/80 font-semibold mb-1">{breakdown.monthlyDiscounted > 0 ? "/ mese" : "una tantum"}</span>
                </div>
                <p className="text-white/80 text-sm mt-2">
                  Su {breakdown.months} mesi · {eur(breakdown.contractTotal)}
                  {breakdown.oneoffSubtotal > 0 && breakdown.monthlyDiscounted > 0 ? ` (incl. ${eur(breakdown.oneoffSubtotal)} una tantum)` : ""}
                </p>
              </div>

              <div className="mt-5 space-y-2">
                {breakdown.lines.map((l) => (
                  <div key={l.key} className="flex items-center justify-between text-sm border-b border-zinc-100 pb-2">
                    <span className="text-zinc-600">{l.label}</span>
                    <span className="font-semibold tabular-nums">{eur(l.amount)}{l.billing === "monthly" ? "/mese" : ""}</span>
                  </div>
                ))}
                {breakdown.lines.length === 0 && <p className="text-zinc-400 text-sm">Non hai ancora scelto nessun servizio. Torna indietro e componi il tuo pacchetto.</p>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer nav (nascosto sul welcome: lì c'è già il bottone "Iniziamo") */}
      {!isWelcome && (
        <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-zinc-100">
          <div className="max-w-xl mx-auto px-6 py-3 flex items-center gap-3">
            <button onClick={back} className="p-3 rounded-2xl text-zinc-400 hover:bg-zinc-100" aria-label="Indietro"><ArrowLeft size={20} /></button>
            {!isSummary && (
              <button onClick={next} className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-white text-lg font-bold active:scale-[.99] transition-transform" style={{ background: GREEN }}>
                Avanti <ArrowRight size={20} />
              </button>
            )}
            {isSummary && (
              <div className="flex-1 flex gap-2">
                <button type="button" onClick={() => submit("send")} disabled={items.length === 0 || busy !== null}
                  className="flex items-center justify-center gap-1.5 px-4 py-4 rounded-2xl border-2 border-zinc-300 font-bold text-sm hover:bg-zinc-50 disabled:opacity-40">
                  {busy === "send" ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Invia
                </button>
                <button type="button" onClick={() => submit("lock")} disabled={items.length === 0 || breakdown.deposit <= 0 || busy !== null}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-4 rounded-2xl text-white font-bold text-sm active:scale-[.99] transition-transform disabled:opacity-40" style={{ background: GREEN }}>
                  {busy === "lock" ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                  Blocca · primo mese {eur(breakdown.deposit)}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
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

function Screen({ children, center, hero }: { children: React.ReactNode; center?: boolean; hero?: boolean }) {
  return (
    <div className={`min-h-[100dvh] px-6 ${center ? "flex items-center justify-center text-center" : ""}`}
      style={hero ? { background: `linear-gradient(160deg, ${GREEN}, #5f7047)` } : { background: "#fff" }}>
      {children}
    </div>
  );
}
