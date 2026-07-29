import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Sparkles, Check, PartyPopper, Loader2, Cloud, CloudOff, AlertCircle } from "lucide-react";
import {
  BRIEF_SECTIONS, emptyBriefData, normalizeBriefData, briefEssentialStats,
  type BriefData, type BriefField,
} from "@/lib/briefSchema";
import { usePortal } from "../PortalContext";
import { usePortalNav } from "../nav";
import { portalUrl, portalGet, portalSend, PortalAuthError, PortalHttpError } from "../portalApi";
import { T, SERIF } from "../theme";

type Save = "idle" | "saving" | "saved" | "error";

export function BriefScreen() {
  const { token, onAuthExpired } = usePortal();
  const { pop } = usePortalNav();
  const [data, setData] = useState<BriefData>(emptyBriefData);
  const [load, setLoad] = useState<"loading" | "ready" | "error">("loading");
  const [save, setSave] = useState<Save>("idle");
  const [si, setSi] = useState(0);
  const okRef = useRef(false);      // autosave abilitato solo dopo GET riuscito (fix 6)
  const dirtyRef = useRef(false);
  const latest = useRef<BriefData>(data);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  latest.current = data;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const row = await portalGet<{ parsedJson?: string }>(token, "/brief");
        if (!alive) return;
        let parsed: unknown = {};
        try { parsed = row?.parsedJson ? JSON.parse(row.parsedJson) : {}; } catch { parsed = {}; }
        setData(normalizeBriefData(parsed));
        okRef.current = true;
        setLoad("ready");
      } catch (e) {
        if (!alive) return;
        if (e instanceof PortalAuthError) { onAuthExpired(); return; }
        if (e instanceof PortalHttpError && e.status === 404) { okRef.current = true; setLoad("ready"); return; }
        setLoad("error"); // NON abilitare autosave: non sovrascrivere con dati vuoti
      }
    })();
    return () => { alive = false; };
  }, [token, onAuthExpired]);

  const persist = useCallback(async () => {
    if (!okRef.current) return;
    setSave("saving");
    const res = await portalSend(token, "/brief", "PUT", { parsedJson: latest.current });
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

  // fix 1: flush quando la pagina va in background o si chiude, e allo smontaggio.
  useEffect(() => {
    const flush = () => {
      if (!dirtyRef.current || !okRef.current) return;
      if (timer.current) clearTimeout(timer.current);
      fetch(portalUrl(token, "/brief"), {
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

  type Flow = { kind: "intro" } | { kind: "gate" } | { kind: "done" } | { kind: "field"; sk: string; sl: string; f: BriefField };
  const flow = useMemo<Flow[]>(() => {
    const ess: Flow[] = []; const opt: Flow[] = [];
    for (const s of BRIEF_SECTIONS) for (const f of s.fields) (f.essential ? ess : opt).push({ kind: "field", sk: s.key, sl: s.label, f });
    return [{ kind: "intro" }, ...ess, { kind: "gate" }, ...opt, { kind: "done" }];
  }, []);
  const essential = useMemo(() => briefEssentialStats(data), [data]);
  const doneIdx = flow.length - 1;
  const step = flow[Math.min(si, doneIdx)];
  const progress = Math.round((si / doneIdx) * 100);
  const next = () => setSi((i) => Math.min(doneIdx, i + 1));
  const back = () => (si === 0 ? pop() : setSi((i) => i - 1));

  if (load === "loading") return <div className="py-20 text-center"><Loader2 className="mx-auto animate-spin" style={{ color: T.sage }} /></div>;
  if (load === "error") return (
    <div className="py-20 text-center flex flex-col items-center">
      <button onClick={pop} className="inline-flex items-center gap-1.5 mb-6 text-sm font-semibold self-start" style={{ color: T.sage }}><ArrowLeft size={18} /> Home</button>
      <AlertCircle size={30} className="text-amber-500 mb-3" />
      <p className="font-semibold" style={{ color: T.ink }}>Non riusciamo a caricare il brief</p>
      <button onClick={() => window.location.reload()} className="mt-4 px-5 py-2.5 rounded-xl text-white font-semibold text-sm" style={{ background: T.sage }}>Riprova</button>
    </div>
  );

  return (
    <div className="min-h-[70vh] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <button onClick={back} className="p-2 -ml-2 rounded-xl" style={{ color: T.muted }}><ArrowLeft size={20} /></button>
        {step.kind !== "intro" && <SaveBadge state={save} onRetry={persist} />}
      </div>
      {step.kind !== "intro" && (
        <div className="h-1.5 rounded-full overflow-hidden mb-6" style={{ background: T.creamDeep }}>
          <div className="h-full transition-all duration-500" style={{ width: `${progress}%`, background: T.sage }} />
        </div>
      )}

      <div key={si} className="flex-1 animate-in fade-in slide-in-from-bottom-3 duration-300">
        {step.kind === "intro" && (
          <div className="text-center py-8">
            <div className="inline-flex items-center gap-1.5 text-sm font-semibold mb-4 px-3 py-1 rounded-full" style={{ background: T.sageSoft, color: T.sageDark }}><Sparkles size={15} /> Il tuo brief</div>
            <h1 className="text-3xl font-bold leading-tight" style={{ color: T.ink, fontFamily: SERIF }}>Aiutaci a partire<br />col piede giusto.</h1>
            <p className="text-lg mt-3" style={{ color: T.muted }}>Poche domande, una alla volta. Si salvano da sole.</p>
            <button onClick={next} className="mt-8 inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-white text-lg font-bold shadow-lg active:scale-[.98] transition-transform" style={{ background: T.sage }}>Iniziamo <ArrowRight size={20} /></button>
          </div>
        )}
        {step.kind === "field" && (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: T.sage }}>{step.sl}</p>
            <label className="block text-2xl font-extrabold tracking-tight leading-tight" style={{ color: T.ink }}>{step.f.label}</label>
            {step.f.help && <p className="text-base mt-2" style={{ color: T.muted }}>{step.f.help}</p>}
            <textarea autoFocus value={data[step.sk]?.[step.f.key] ?? ""}
              onChange={(e) => setField(step.sk, step.f.key, e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !step.f.long) { e.preventDefault(); next(); } }}
              placeholder={step.f.placeholder ?? "Scrivi qui…"} rows={step.f.long ? 4 : 2}
              className="w-full mt-5 resize-y rounded-2xl px-4 py-4 text-lg focus:outline-none"
              style={{ background: T.card, border: `2px solid ${T.cardBorder}`, color: T.ink }} />
          </div>
        )}
        {step.kind === "gate" && (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5"><Check size={30} className="text-emerald-600" /></div>
            <h2 className="text-2xl font-extrabold" style={{ color: T.ink }}>L'essenziale c'è. Grazie!</h2>
            <p className="text-lg mt-3" style={{ color: T.muted }}>Vuoi aggiungere qualche dettaglio in più?</p>
            <div className="mt-8 flex flex-col sm:flex-row gap-2 justify-center">
              <button onClick={() => setSi(doneIdx)} className="px-6 py-3.5 rounded-2xl font-bold" style={{ border: `2px solid ${T.cardBorder}`, color: T.ink }}>Ho finito così</button>
              <button onClick={next} className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-white font-bold" style={{ background: T.sage }}>Aggiungo dettagli <ArrowRight size={18} /></button>
            </div>
          </div>
        )}
        {step.kind === "done" && (
          <div className="text-center py-10">
            {save === "error" ? (
              <>
                <AlertCircle size={30} className="text-amber-500 mx-auto mb-3" />
                <h2 className="text-2xl font-extrabold" style={{ color: T.ink }}>Quasi fatto</h2>
                <p className="text-lg mt-2" style={{ color: T.muted }}>L'ultima risposta non si è salvata.</p>
                <button onClick={persist} className="mt-6 px-6 py-3 rounded-2xl text-white font-bold" style={{ background: T.sage }}>Riprova a salvare</button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: T.sageSoft }}><PartyPopper size={30} style={{ color: T.sage }} /></div>
                <h2 className="text-3xl font-extrabold" style={{ color: T.ink, fontFamily: SERIF }}>È tutto salvato.</h2>
                <p className="text-lg mt-3" style={{ color: T.muted }}>Grazie! Puoi tornare qui quando vuoi.</p>
                <button onClick={pop} className="mt-8 px-6 py-3 rounded-2xl font-bold" style={{ border: `2px solid ${T.cardBorder}`, color: T.ink }}>Torna alla home</button>
              </>
            )}
          </div>
        )}
      </div>

      {step.kind === "field" && (
        <div className="mt-6 flex items-center gap-3">
          <button onClick={back} className="p-3 rounded-2xl" style={{ color: T.muted }}><ArrowLeft size={20} /></button>
          <button onClick={next} className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-white text-lg font-bold active:scale-[.99] transition-transform" style={{ background: T.sage }}>Avanti <ArrowRight size={20} /></button>
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
