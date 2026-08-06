import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Globe, Check, Loader2, Cloud, CloudOff, AlertCircle, Sparkles } from "lucide-react";
import {
  WEBSITE_BRIEF_SECTIONS, emptyWebsiteBriefData, normalizeWebsiteBriefData,
  type WebsiteBriefData, type WBField,
} from "@/lib/websiteBriefSchema";
import { usePortal } from "../PortalContext";
import { usePortalNav } from "../nav";
import { portalUrl, portalGet, portalSend, PortalAuthError, PortalHttpError } from "../portalApi";
import { T, SERIF } from "../theme";

type Save = "idle" | "saving" | "saved" | "error";

/**
 * Brief Sito Web — TUTTO su una pagina (non a step tipo Typeform): il cliente
 * scorre le sezioni e risponde dove vuole, si salva da solo. Alcune sezioni
 * sono a checkbox con descrizione. Riusa l'anti-perdita-dati del brief social
 * (autosave debounce + flush su visibilitychange/pagehide/unmount).
 */
export function WebsiteBriefScreen() {
  const { token, onAuthExpired } = usePortal();
  const { pop } = usePortalNav();
  const [data, setData] = useState<WebsiteBriefData>(emptyWebsiteBriefData);
  const [prefill, setPrefill] = useState<Record<string, string>>({});
  const [load, setLoad] = useState<"loading" | "ready" | "error">("loading");
  const [save, setSave] = useState<Save>("idle");
  const okRef = useRef(false);      // autosave abilitato solo dopo GET riuscito
  const dirtyRef = useRef(false);
  const latest = useRef<WebsiteBriefData>(data);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  latest.current = data;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const row = await portalGet<{ parsedJson?: string; prefill?: Record<string, string> }>(token, "/website-brief");
        if (!alive) return;
        let parsed: unknown = {};
        try { parsed = row?.parsedJson ? JSON.parse(row.parsedJson) : {}; } catch { parsed = {}; }
        setData(normalizeWebsiteBriefData(parsed));
        setPrefill(row?.prefill ?? {});   // suggerimenti a sola lettura, MAI scritti nelle risposte
        okRef.current = true;
        setLoad("ready");
      } catch (e) {
        if (!alive) return;
        if (e instanceof PortalAuthError) { onAuthExpired(); return; }
        if (e instanceof PortalHttpError && e.status === 404) { okRef.current = true; setLoad("ready"); return; }
        setLoad("error");
      }
    })();
    return () => { alive = false; };
  }, [token, onAuthExpired]);

  const persist = useCallback(async () => {
    if (!okRef.current) return;
    setSave("saving");
    const res = await portalSend(token, "/website-brief", "PUT", { parsedJson: latest.current });
    if (res.ok) { dirtyRef.current = false; setSave("saved"); }
    else setSave("error");
  }, [token]);

  const schedule = useCallback(() => {
    if (!okRef.current) return;
    dirtyRef.current = true;
    setSave("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void persist(), 800);
  }, [persist]);

  // flush quando la pagina va in background o si chiude, e allo smontaggio.
  useEffect(() => {
    const flush = () => {
      if (!dirtyRef.current || !okRef.current) return;
      if (timer.current) clearTimeout(timer.current);
      fetch(portalUrl(token, "/website-brief"), {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parsedJson: latest.current }), keepalive: true,
      }).catch(() => {});
      dirtyRef.current = false;
    };
    const onVis = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", flush);
      if (timer.current) clearTimeout(timer.current);
      flush();
    };
  }, [token]);

  const setField = (sk: string, fk: string, v: string) => {
    setData((p) => ({ ...p, [sk]: { ...p[sk], [fk]: v } }));
    schedule();
  };
  const toggle = (sk: string, fk: string, opt: string) => {
    const cur = (data[sk]?.[fk] ?? "").split("\n").filter(Boolean);
    const next = cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt];
    setField(sk, fk, next.join("\n"));
  };

  if (load === "loading") return <div className="py-20 text-center"><Loader2 className="mx-auto animate-spin" style={{ color: T.sage }} /></div>;
  if (load === "error") return (
    <div className="py-20 text-center flex flex-col items-center">
      <button onClick={pop} className="inline-flex items-center gap-1.5 mb-6 text-sm font-semibold self-start" style={{ color: T.sage }}><ArrowLeft size={18} /> Home</button>
      <AlertCircle size={30} className="text-amber-500 mb-3" />
      <p className="font-semibold" style={{ color: T.ink }}>Non riusciamo a caricare il brief del sito</p>
      <button onClick={() => window.location.reload()} className="mt-4 px-5 py-2.5 rounded-xl text-white font-semibold text-sm" style={{ background: T.sage }}>Riprova</button>
    </div>
  );

  return (
    <div className="pb-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header sticky: back + stato salvataggio */}
      <div className="sticky z-10 -mx-5 px-5 py-2 flex items-center justify-between backdrop-blur" style={{ top: "var(--bk-topbar)", background: "rgba(246,242,233,0.9)" }}>
        <button onClick={pop} className="p-2 -ml-2 rounded-xl" style={{ color: T.muted }}><ArrowLeft size={20} /></button>
        <SaveBadge state={save} onRetry={persist} />
      </div>

      {/* Intro */}
      <div className="text-center pt-4 pb-6">
        <div className="inline-flex items-center gap-1.5 text-sm font-semibold mb-3 px-3 py-1 rounded-full" style={{ background: T.sageSoft, color: T.sageDark }}><Globe size={15} /> Brief Sito Web</div>
        <h1 className="text-3xl font-bold leading-tight" style={{ color: T.ink, fontFamily: SERIF }}>Disegniamo insieme<br />il tuo sito.</h1>
        <p className="text-base mt-3" style={{ color: T.muted }}>Rispondi dove vuoi, anche a pezzi. Si salva da solo.</p>
      </div>

      <div className="space-y-5">
        {WEBSITE_BRIEF_SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <section key={s.key} className="rounded-2xl p-5" style={{ background: T.card, border: `1px solid ${T.cardBorder}` }}>
              <div className="flex items-start gap-3 mb-4">
                <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: T.sageSoft, color: T.sage }}><Icon size={17} /></span>
                <div className="min-w-0">
                  <h2 className="font-bold text-lg leading-tight" style={{ color: T.ink }}>{s.label}</h2>
                  {s.hint && <p className="text-sm mt-0.5" style={{ color: T.muted }}>{s.hint}</p>}
                </div>
              </div>
              <div className="space-y-6">
                {s.fields.map((f) => (
                  <Field
                    key={f.key}
                    f={f}
                    value={data[s.key]?.[f.key] ?? ""}
                    hint={prefill[f.key]}
                    onText={(v) => setField(s.key, f.key, v)}
                    onToggle={(opt) => toggle(s.key, f.key, opt)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div className="text-center mt-8">
        <div className="inline-flex items-center gap-1.5 text-sm" style={{ color: T.muted }}><Check size={15} style={{ color: T.sage }} /> Tutto qui. Le risposte si salvano da sole.</div>
        <div>
          <button onClick={pop} className="mt-4 px-6 py-3 rounded-2xl font-bold" style={{ border: `2px solid ${T.cardBorder}`, color: T.ink }}>Torna alla home</button>
        </div>
      </div>
    </div>
  );
}

function Field({ f, value, hint, onText, onToggle }: {
  f: WBField; value: string; hint?: string; onText: (v: string) => void; onToggle: (opt: string) => void;
}) {
  const selected = value ? value.split("\n").filter(Boolean) : [];
  const isFreeText = f.type === "text" || f.type === "textarea" || f.type === "url_list";

  return (
    <div>
      <label className="block text-base font-bold leading-snug" style={{ color: T.ink }}>{f.label}</label>
      {f.help && <p className="text-sm mt-1" style={{ color: T.muted }}>{f.help}</p>}

      {/* Suggerimento dai dati che abbiamo già (mai scritto in automatico) */}
      {hint && (isFreeText ? (
        <button
          type="button"
          onClick={() => { if (!value) onText(hint); }}
          className="mt-3 w-full text-left rounded-2xl px-4 py-3"
          style={{ background: T.sageSoft, border: `1px dashed ${T.sage}`, color: T.sageDark }}
        >
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide"><Sparkles size={12} /> Abbiamo già questo</span>
          <span className="block mt-1 whitespace-pre-wrap" style={{ color: T.ink }}>{hint}</span>
          {!value && <span className="block text-xs mt-1">Tocca per usarlo · oppure scrivi sotto</span>}
        </button>
      ) : (
        <div className="mt-3 rounded-2xl px-4 py-3" style={{ background: T.sageSoft, color: T.sageDark }}>
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide"><Sparkles size={12} /> Da quello che ci hai già detto</span>
          <span className="block mt-1 whitespace-pre-wrap" style={{ color: T.ink }}>{hint}</span>
        </div>
      ))}

      {f.type === "text" && (
        <input
          value={value} onChange={(e) => onText(e.target.value)}
          placeholder={f.placeholder ?? "Scrivi qui…"}
          className="w-full mt-3 rounded-2xl px-4 py-3.5 text-base focus:outline-none"
          style={{ background: T.cream, border: `2px solid ${T.cardBorder}`, color: T.ink }}
        />
      )}
      {(f.type === "textarea" || f.type === "url_list") && (
        <textarea
          value={value} onChange={(e) => onText(e.target.value)}
          placeholder={f.type === "url_list" ? "Un link per riga…" : (f.placeholder ?? "Scrivi qui…")}
          rows={f.type === "url_list" ? 3 : 4}
          className="w-full mt-3 resize-y rounded-2xl px-4 py-3.5 text-base focus:outline-none"
          style={{ background: T.cream, border: `2px solid ${T.cardBorder}`, color: T.ink }}
        />
      )}

      {f.type === "single_choice" && (
        <div className="mt-3 space-y-2">
          {f.options!.map((o) => {
            const on = value === o.v;
            return (
              <button key={o.v} type="button" onClick={() => onText(o.v)}
                className="w-full text-left px-4 py-3 rounded-2xl flex items-start gap-3"
                style={{ background: on ? T.sageSoft : T.cream, border: `2px solid ${on ? T.sage : T.cardBorder}` }}>
                <span className="mt-0.5 w-5 h-5 rounded-full shrink-0 flex items-center justify-center"
                  style={{ border: `2px solid ${on ? T.sage : T.softMuted}`, background: on ? T.sage : "transparent" }}>
                  {on && <Check size={12} className="text-white" />}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold" style={{ color: T.ink }}>{o.v}</span>
                  {o.d && <span className="block text-sm" style={{ color: T.muted }}>{o.d}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {f.type === "multi_choice" && (
        <div className="mt-3 space-y-2">
          {f.options!.map((o) => {
            const on = selected.includes(o.v);
            return (
              <button key={o.v} type="button" onClick={() => onToggle(o.v)}
                className="w-full text-left px-4 py-3 rounded-2xl flex items-start gap-3"
                style={{ background: on ? T.sageSoft : T.cream, border: `2px solid ${on ? T.sage : T.cardBorder}` }}>
                <span className="mt-0.5 w-5 h-5 rounded-md shrink-0 flex items-center justify-center"
                  style={{ border: `2px solid ${on ? T.sage : T.softMuted}`, background: on ? T.sage : "transparent" }}>
                  {on && <Check size={12} className="text-white" />}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold" style={{ color: T.ink }}>{o.v}</span>
                  {o.d && <span className="block text-sm" style={{ color: T.muted }}>{o.d}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SaveBadge({ state, onRetry }: { state: Save; onRetry: () => void }) {
  if (state === "saving") return <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: T.muted }}><Loader2 size={13} className="animate-spin" /> Salvataggio…</span>;
  if (state === "saved") return <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600"><Cloud size={13} /> Salvato</span>;
  if (state === "error") return <button onClick={onRetry} className="inline-flex items-center gap-1.5 text-xs text-amber-600 font-semibold"><CloudOff size={13} /> Non salvato · Riprova</button>;
  return null;
}
