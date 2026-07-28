import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  BRIEF_SECTIONS,
  emptyBriefData,
  normalizeBriefData,
  briefEssentialStats,
  sectionHasEssential,
  visibleFields,
  type BriefData,
  type BriefField,
} from "@/lib/briefSchema";
import {
  platformMeta,
  statusMeta,
  categoryMeta,
  CATEGORY_META,
  type ContentIdeaRow,
  type IdeaCategory,
} from "@/lib/ideasSchema";
import {
  Loader2,
  Cloud,
  CloudOff,
  ChevronDown,
  CheckCircle2,
  FileText,
  CalendarDays,
  CalendarRange,
  BarChart3,
  FolderOpen,
  ExternalLink,
  Lightbulb,
  Plus,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  PartyPopper,
  Check,
} from "lucide-react";

/* Area cliente pubblica (accesso via link, senza login). */

type ClientInfo = { name: string; logo: string | null; color: string; driveUrl: string | null };
type TabKey = "brief" | "ideas" | "events" | "editorial" | "reports" | "files";
type SaveState = "idle" | "saving" | "saved" | "error";

const API = (token: string, path = "") => `/api/public/portal/${encodeURIComponent(token)}${path}`;

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { key: "brief", label: "Brief", icon: FileText },
  { key: "ideas", label: "Idee", icon: Lightbulb },
  { key: "events", label: "Eventi", icon: CalendarDays },
  { key: "editorial", label: "Editoriale", icon: CalendarRange },
  { key: "reports", label: "Report", icon: BarChart3 },
  { key: "files", label: "File", icon: FolderOpen },
];

export default function ClientPortalPage({ token }: { token: string }) {
  const [status, setStatus] = useState<"loading" | "ok" | "pin" | "invalid">("loading");
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [tab, setTab] = useState<TabKey>("brief");
  const [pin, setPin] = useState("");
  const [pinErr, setPinErr] = useState<string | null>(null);
  const [pinBusy, setPinBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const r = await fetch(API(token));
      if (!r.ok) { setStatus("invalid"); return; }
      const data = await r.json();
      setClient(data.client);
      setStatus(data.pinRequired ? "pin" : "ok");
    } catch { setStatus("invalid"); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const submitPin = useCallback(async () => {
    if (!/^\d{4,6}$/.test(pin)) { setPinErr("Inserisci il PIN"); return; }
    setPinBusy(true); setPinErr(null);
    try {
      const r = await fetch(API(token, "/verify-pin"), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }),
      });
      if (r.ok) { setPin(""); await load(); }
      else setPinErr("PIN errato");
    } catch { setPinErr("Errore, riprova"); }
    finally { setPinBusy(false); }
  }, [pin, token, load]);

  // PWA per-cliente: nome e colore del cliente nel <head> mentre è sul portale.
  // L'ICONA resta quella di Be Kind (apple-touch-icon globale + icone del
  // manifest = logo Be Kind): l'app è uno strumento dell'agenzia.
  useEffect(() => {
    const head = document.head;
    const manifest = head.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    const themeMeta = head.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    const titleMeta = head.querySelector('meta[name="apple-mobile-web-app-title"]') as HTMLMetaElement | null;
    const prev = {
      manifest: manifest?.getAttribute("href"),
      theme: themeMeta?.getAttribute("content"), title: titleMeta?.getAttribute("content"), doc: document.title,
    };
    manifest?.setAttribute("href", API(token, "/manifest.webmanifest"));
    if (client?.color) themeMeta?.setAttribute("content", client.color);
    if (client?.name) { titleMeta?.setAttribute("content", client.name); document.title = client.name; }
    return () => {
      if (prev.manifest) manifest?.setAttribute("href", prev.manifest);
      if (prev.theme) themeMeta?.setAttribute("content", prev.theme);
      if (prev.title) titleMeta?.setAttribute("content", prev.title);
      document.title = prev.doc;
    };
  }, [token, client?.color, client?.name]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(83,15%,96%)]">
        <Loader2 className="animate-spin text-[#7a8f5c]" />
      </div>
    );
  }
  if (status === "invalid" || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(83,15%,96%)] p-6">
        <div className="text-center max-w-sm">
          <CloudOff className="mx-auto mb-3 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Link non valido</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Questo link non è più attivo o è stato revocato. Contatta la tua agenzia per ricevere un nuovo link.
          </p>
        </div>
      </div>
    );
  }

  if (status === "pin") {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-6"
        style={{ background: `linear-gradient(160deg, ${client.color || "#7a8f5c"}, #2f3c21)` }}>
        <div className="w-full max-w-xs text-center animate-in fade-in zoom-in-95 duration-300">
          <div className="w-20 h-20 rounded-2xl bg-white mx-auto flex items-center justify-center overflow-hidden mb-5 shadow-lg">
            {client.logo
              ? <img src={client.logo} alt={client.name} className="w-full h-full object-contain p-2" />
              : <span className="text-2xl font-bold text-[#7a8f5c]">{client.name.slice(0, 2).toUpperCase()}</span>}
          </div>
          <h1 className="text-white text-2xl font-bold leading-tight">{client.name}</h1>
          <p className="text-white/75 text-sm mt-1 mb-6">Inserisci il PIN per entrare</p>
          <input
            value={pin}
            onChange={(e) => { setPin(e.target.value.replace(/\D/g, "").slice(0, 6)); setPinErr(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") void submitPin(); }}
            inputMode="numeric" autoFocus
            placeholder="••••"
            className="w-full text-center text-3xl tracking-[0.5em] font-bold py-4 rounded-2xl bg-white/95 focus:outline-none focus:ring-4 focus:ring-white/30"
          />
          {pinErr && <p className="text-red-100 text-sm mt-2 font-medium">{pinErr}</p>}
          <button onClick={() => void submitPin()} disabled={pinBusy}
            className="mt-4 w-full py-3.5 rounded-2xl bg-white font-bold text-lg active:scale-[.99] transition-transform disabled:opacity-60"
            style={{ color: client.color || "#2f3c21" }}>
            {pinBusy ? "…" : "Entra"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(83,15%,96%)]">
      {/* Header brandizzato */}
      <header className="bg-[#2f3c21] text-white">
        <div className="h-1.5" style={{ backgroundColor: client.color || "#7a8f5c" }} />
        <div className="max-w-4xl mx-auto px-5 py-5 flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white overflow-hidden">
            {client.logo ? (
              <img src={client.logo} alt={client.name} className="h-full w-full object-contain p-1" />
            ) : (
              <span className="text-lg font-bold text-[#7a8f5c]">{client.name.slice(0, 2).toUpperCase()}</span>
            )}
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">{client.name}</h1>
            <p className="text-xs text-white/70">Area cliente · Be Kind Social Agency</p>
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-4xl mx-auto px-5">
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    active ? "border-white text-white" : "border-transparent text-white/60 hover:text-white"
                  }`}
                >
                  <Icon size={15} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-6">
        {tab === "brief" && <PortalBrief token={token} />}
        {tab === "ideas" && <PortalIdeas token={token} />}
        {tab === "events" && <PortalEvents token={token} />}
        {tab === "editorial" && <PortalEditorial token={token} />}
        {tab === "reports" && <PortalReports token={token} />}
        {tab === "files" && <PortalFiles token={token} driveUrl={client.driveUrl} />}
        <p className="mt-8 text-center text-[11px] text-muted-foreground">Powered by Be Kind Social Agency</p>
      </main>
      <InstallHint clientName={client.name} color={client.color || "#7a8f5c"} />
    </div>
  );
}

/* ── BRIEF (compilabile) ─────────────────────────────────────── */
/**
 * Invito discreto a installare il portale come app. Compare solo su mobile, se
 * non è già aperto come app installata, e si può chiudere. Su iOS l'aggiunta
 * alla home è manuale (Condividi → Aggiungi a Home): mostriamo l'istruzione.
 */
function InstallHint({ clientName, color }: { clientName: string; color: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (window.navigator as { standalone?: boolean }).standalone === true;
    const dismissed = localStorage.getItem("bk-portal-install-dismissed") === "1";
    const isMobile = /iphone|ipad|ipod|android/i.test(navigator.userAgent);
    if (!standalone && !dismissed && isMobile) setShow(true);
  }, []);
  if (!show) return null;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 p-3">
      <div className="max-w-md mx-auto rounded-2xl shadow-xl text-white p-3.5 flex items-start gap-3" style={{ background: color }}>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm">Tieni {clientName} sul telefono</p>
          <p className="text-white/85 text-xs mt-0.5">
            {isIOS
              ? "Tocca Condividi, poi “Aggiungi a Home”. Avrai l’icona come un’app."
              : "Apri il menu del browser e scegli “Aggiungi a schermata Home”."}
          </p>
        </div>
        <button onClick={() => { localStorage.setItem("bk-portal-install-dismissed", "1"); setShow(false); }}
          className="shrink-0 text-white/80 hover:text-white text-xs font-semibold px-2 py-1">Chiudi</button>
      </div>
    </div>
  );
}

function PortalBrief({ token }: { token: string }) {
  const [data, setData] = useState<BriefData>(emptyBriefData);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const loadedRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<BriefData>(data);
  latest.current = data;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void (async () => {
      try {
        const r = await fetch(API(token, "/brief"));
        if (!alive) return;
        if (r.ok) {
          const row = await r.json();
          let parsed: unknown = {};
          try {
            parsed = row?.parsedJson ? JSON.parse(row.parsedJson) : {};
          } catch {
            parsed = {};
          }
          setData(normalizeBriefData(parsed));
        }
      } finally {
        if (alive) {
          setLoading(false);
          setTimeout(() => {
            loadedRef.current = true;
          }, 0);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  const persist = useCallback(async () => {
    setSaveState("saving");
    try {
      const r = await fetch(API(token, "/brief"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parsedJson: latest.current }),
      });
      if (!r.ok) throw new Error("save");
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, [token]);

  const schedule = useCallback(() => {
    if (!loadedRef.current) return;
    setSaveState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void persist(), 800);
  }, [persist]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const setField = (sk: string, fk: string, v: string) => {
    setData((p) => ({ ...p, [sk]: { ...p[sk], [fk]: v } }));
    schedule();
  };

  // Flusso Typeform: una domanda alla volta. Prima le essenziali, poi (se vuole)
  // le facoltative. intro → [essenziali] → bivio → [facoltative] → fatto.
  type Flow =
    | { kind: "intro" }
    | { kind: "gate" }
    | { kind: "done" }
    | { kind: "field"; sk: string; sl: string; f: BriefField };
  const { essFields, optFields } = useMemo(() => {
    const ess: Flow[] = []; const opt: Flow[] = [];
    for (const s of BRIEF_SECTIONS) for (const f of s.fields) {
      (f.essential ? ess : opt).push({ kind: "field", sk: s.key, sl: s.label, f });
    }
    return { essFields: ess, optFields: opt };
  }, []);
  const flow = useMemo<Flow[]>(
    () => [{ kind: "intro" }, ...essFields, { kind: "gate" }, ...optFields, { kind: "done" }],
    [essFields, optFields],
  );
  const [si, setSi] = useState(0);
  const doneIndex = flow.length - 1;
  const essential = useMemo(() => briefEssentialStats(data), [data]);

  if (loading) {
    return <div className="py-16 text-center"><Loader2 className="mx-auto animate-spin text-[#7a8f5c]" /></div>;
  }

  const step = flow[Math.min(si, doneIndex)];
  const progress = Math.round((si / doneIndex) * 100);
  const next = () => setSi((i) => Math.min(doneIndex, i + 1));
  const back = () => setSi((i) => Math.max(0, i - 1));

  return (
    <div className="min-h-[60vh]">
      {/* Barra progresso + stato salvataggio */}
      {step.kind !== "intro" && (
        <div className="mb-6">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-[#7a8f5c] transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-muted-foreground">
              {essential.filled}/{essential.total} risposte chiave
            </span>
            <SaveBadge state={saveState} />
          </div>
        </div>
      )}

      <div key={si} className="animate-in fade-in slide-in-from-bottom-3 duration-300">
        {step.kind === "intro" && (
          <div className="text-center py-10">
            <div className="inline-flex items-center gap-1.5 text-sm font-semibold mb-4 px-3 py-1 rounded-full bg-[#7a8f5c]/10 text-[#5f7047]">
              <Sparkles size={15} /> Raccontaci di te
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight">
              Aiutaci a partire col piede giusto.
            </h2>
            <p className="text-lg text-muted-foreground mt-3">
              Poche domande, una alla volta. Si salvano da sole, puoi tornarci quando vuoi.
            </p>
            <button onClick={next}
              className="mt-8 inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-[#7a8f5c] text-white text-lg font-bold shadow-lg active:scale-[.98] transition-transform">
              Iniziamo <ArrowRight size={20} />
            </button>
          </div>
        )}

        {step.kind === "field" && (
          <div className="py-4">
            <p className="text-xs font-bold uppercase tracking-widest text-[#7a8f5c] mb-2">{step.sl}</p>
            <label className="block text-2xl md:text-3xl font-extrabold tracking-tight leading-tight">{step.f.label}</label>
            {step.f.help && <p className="text-base text-muted-foreground mt-2">{step.f.help}</p>}
            <textarea
              autoFocus
              value={data[step.sk]?.[step.f.key] ?? ""}
              onChange={(e) => setField(step.sk, step.f.key, e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !step.f.long) { e.preventDefault(); next(); } }}
              placeholder={step.f.placeholder ?? "Scrivi qui…"}
              rows={step.f.long ? 4 : 2}
              className="w-full mt-5 resize-y rounded-2xl border-2 border-input bg-background px-4 py-4 text-lg focus:outline-none focus:border-[#7a8f5c]"
            />
          </div>
        )}

        {step.kind === "gate" && (
          <div className="text-center py-10">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
              <Check size={30} className="text-emerald-600" />
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">L'essenziale c'è. Grazie!</h2>
            <p className="text-lg text-muted-foreground mt-3">
              Vuoi aggiungere qualche dettaglio in più? Ci aiuta a fare un lavoro più su misura.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-2 justify-center">
              <button onClick={() => setSi(doneIndex)}
                className="px-6 py-3.5 rounded-2xl border-2 border-input font-bold">Ho finito così</button>
              <button onClick={next}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-[#7a8f5c] text-white font-bold">
                Aggiungo dettagli <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {step.kind === "done" && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-[#7a8f5c]/15 flex items-center justify-center mx-auto mb-5">
              <PartyPopper size={30} className="text-[#7a8f5c]" />
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight">Perfetto, è tutto salvato.</h2>
            <p className="text-lg text-muted-foreground mt-3">
              Puoi tornare qui quando vuoi per modificare o aggiungere.
            </p>
            <button onClick={() => setSi(0)}
              className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-2xl border-2 border-input font-bold">
              <ArrowLeft size={18} /> Rivedi le risposte
            </button>
          </div>
        )}
      </div>

      {/* Navigazione (nei passi domanda) */}
      {step.kind === "field" && (
        <div className="mt-6 flex items-center gap-3">
          <button onClick={back} className="p-3 rounded-2xl text-muted-foreground hover:bg-muted" aria-label="Indietro"><ArrowLeft size={20} /></button>
          <button onClick={next}
            className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-[#7a8f5c] text-white text-lg font-bold active:scale-[.99] transition-transform">
            Avanti <ArrowRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
}

function SaveBadge({ state }: { state: SaveState }) {
  if (state === "saving")
    return <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 size={13} className="animate-spin" /> Salvataggio…</span>;
  if (state === "saved")
    return <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600"><Cloud size={13} /> Salvato</span>;
  if (state === "error")
    return <span className="inline-flex items-center gap-1.5 text-xs text-red-600"><CloudOff size={13} /> Errore</span>;
  return null;
}

/* ── BANCA IDEE (il cliente incolla i suoi link) ─────────────── */
// Nota: fetch NUDO, senza portalFetch — il cliente non ha login, il token
// nell'URL è la chiave. Qui NON c'è autosave come nel brief: un'idea è un
// inserimento discreto, quindi il bottone esplicito è più chiaro.
// Il cliente vede tutta la banca (anche le idee dell'agenzia) ma può solo
// aggiungere: lo stato lo muove l'agenzia.
function PortalIdeas({ token }: { token: string }) {
  const [items, setItems] = useState<ContentIdeaRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<IdeaCategory>("da_classificare");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch(API(token, "/ideas"));
      setItems(r.ok ? await r.json() : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    if (!url.trim() || !title.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const r = await fetch(API(token, "/ideas"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), url: url.trim(), category }),
      });
      if (!r.ok) {
        let msg = "Non siamo riusciti a salvare l'idea.";
        try { const j = await r.json(); if (j?.error) msg = String(j.error); } catch { /* ignore */ }
        setError(msg);
        return;
      }
      setUrl("");
      setTitle("");
      setCategory("da_classificare");
      await load();
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setSaving(false);
    }
  };

  const list = items ?? [];

  return (
    <div>
      <div className="mb-4 rounded-xl border border-card-border bg-card p-4">
        <h2 className="font-semibold">Le tue idee</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Hai visto un reel o un post che ti piace? Incolla qui il link: lo teniamo da parte per i contenuti futuri.
        </p>
        <div className="mt-3 space-y-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Incolla il link (es. https://www.instagram.com/reel/…)"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8f5c]/40"
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Perché ti piace? (es. mi piace il montaggio veloce)"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8f5c]/40"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void submit(); } }}
          />
          {/* Facoltativa: se il cliente non sa che tipo sia, lo decidiamo noi.
              L'etichetta del segnaposto è diversa da quella interna
              ("Da classificare"): al cliente non si chiede di classificare. */}
          <label className="block text-xs text-muted-foreground">
            Che tipo di contenuto è? <span className="text-muted-foreground/70">(facoltativo)</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as IdeaCategory)}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#7a8f5c]/40"
            >
              {CATEGORY_META.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.value === "da_classificare" ? "Non saprei — decidete voi" : `${c.label} — ${c.descr}`}
                </option>
              ))}
            </select>
          </label>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving || !url.trim() || !title.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#7a8f5c] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Aggiungi idea
          </button>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : list.length === 0 ? (
        <Empty text="Nessuna idea salvata per ora. Aggiungi il primo link qui sopra." />
      ) : (
        <div className="space-y-2">
          {list.map((i) => {
            const meta = platformMeta(i.platform);
            const Icon = meta.icon;
            return (
              <div key={i.id} className="rounded-xl border border-card-border bg-card p-3 flex items-start gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white ${meta.color}`}>
                  <Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <a
                    href={i.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-medium text-sm hover:underline inline-flex items-center gap-1 max-w-full"
                  >
                    <span className="truncate">{i.title}</span>
                    <ExternalLink size={12} className="shrink-0 text-muted-foreground" />
                  </a>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(i.createdAt)} · {i.source === "client" ? "Aggiunta da te" : "Aggiunta dall'agenzia"}
                  </p>
                  {i.category !== "da_classificare" && (
                    <span className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className={`w-2 h-2 rounded-full ${categoryMeta(i.category).color}`} />
                      {categoryMeta(i.category).label}
                    </span>
                  )}
                </div>
                <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 shrink-0">{statusMeta(i.status).label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Sezioni in sola lettura ─────────────────────────────────── */
function usePortalData<T>(token: string, path: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    void (async () => {
      try {
        const r = await fetch(API(token, path));
        if (!alive) return;
        setData(r.ok ? await r.json() : null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [token, path]);
  return { data, loading };
}

function Spinner() {
  return <div className="py-16 text-center"><Loader2 className="mx-auto animate-spin text-[#7a8f5c]" /></div>;
}
function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-card-border py-12 text-center text-sm text-muted-foreground">{text}</div>;
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}

function PortalEvents({ token }: { token: string }) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [type, setType] = useState<"evento" | "collaborazione">("evento");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const r = await fetch(API(token, "/events"));
        if (alive && r.ok) setEvents(await r.json());
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [token]);

  const add = async () => {
    if (title.trim().length < 2 || !date) return;
    setSaving(true);
    try {
      const r = await fetch(API(token, "/events"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), date, type, note: note.trim() || undefined }),
      });
      if (r.ok) {
        const created = await r.json();
        setEvents((prev) => [...prev, created].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
        setTitle(""); setDate(""); setNote(""); setType("evento"); setShowForm(false);
      }
    } finally { setSaving(false); }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-3">
      {/* Aggiungi: card grande e invitante in cima */}
      {showForm ? (
        <div className="rounded-2xl border-2 border-[#7a8f5c] bg-card p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <p className="font-semibold">Un tuo evento o collaborazione</p>
          <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus
            placeholder="Es. Apertura nuova sede · Collab con @…"
            className="w-full px-4 py-3 rounded-xl border border-input bg-background text-base focus:outline-none focus:ring-2 focus:ring-[#7a8f5c]/40" />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setType("evento")}
              className={`py-2.5 rounded-xl border-2 text-sm font-semibold ${type === "evento" ? "border-[#7a8f5c] bg-[#7a8f5c]/10 text-[#5f7047]" : "border-input text-muted-foreground"}`}>Evento</button>
            <button type="button" onClick={() => setType("collaborazione")}
              className={`py-2.5 rounded-xl border-2 text-sm font-semibold ${type === "collaborazione" ? "border-[#7a8f5c] bg-[#7a8f5c]/10 text-[#5f7047]" : "border-input text-muted-foreground"}`}>Collaborazione</button>
          </div>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-input bg-background text-base focus:outline-none focus:ring-2 focus:ring-[#7a8f5c]/40" />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Una nota (facoltativa)"
            className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8f5c]/40" />
          <div className="flex gap-2">
            <button onClick={() => { setShowForm(false); setTitle(""); setDate(""); setNote(""); }}
              className="px-4 py-2.5 rounded-xl border border-input text-sm font-medium">Annulla</button>
            <button onClick={() => void add()} disabled={saving || title.trim().length < 2 || !date}
              className="flex-1 py-2.5 rounded-xl bg-[#7a8f5c] text-white font-bold text-sm disabled:opacity-50">
              {saving ? "…" : "Aggiungi"}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-dashed border-[#7a8f5c]/40 text-[#5f7047] font-semibold hover:bg-[#7a8f5c]/5 transition-colors">
          <Plus size={18} /> Aggiungi un tuo evento o collaborazione
        </button>
      )}

      {events.length === 0 ? (
        <Empty text="Nessun evento ancora. Aggiungi il primo qui sopra." />
      ) : (
        events.map((e) => (
          <div key={e.id} className="rounded-xl border border-card-border bg-card p-3 flex items-start gap-3">
            <CalendarDays size={16} className="text-[#7a8f5c] mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm">{e.title}</p>
              <p className="text-xs text-muted-foreground">{fmtDate(e.date)}{e.endDate ? ` → ${fmtDate(e.endDate)}` : ""}{e.note ? ` · ${e.note}` : ""}</p>
            </div>
            <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 shrink-0">{e.type}</span>
          </div>
        ))
      )}
    </div>
  );
}

/**
 * Riga contenuto nel portale cliente. Se il contenuto ha uno script, la riga
 * si apre e lo mostra per intero: è la cosa che il cliente deve leggere prima
 * di girare, e su un telefono deve stare in verticale, non in una riga tagliata.
 */
function PortalSlotRow({ slot }: { slot: any }) {
  const [open, setOpen] = useState(false);
  const hasScript = typeof slot.script === "string" && slot.script.trim().length > 0;

  return (
    <div className="border-t border-card-border/50 pt-1.5 first:border-0 first:pt-0">
      <button
        type="button"
        onClick={() => hasScript && setOpen((v) => !v)}
        className={cn(
          "w-full flex items-center gap-2 text-sm text-left",
          hasScript ? "cursor-pointer" : "cursor-default",
        )}
      >
        <span className="text-xs text-muted-foreground w-16 shrink-0">{fmtDate(slot.publishDate)}</span>
        <span className="text-[10px] rounded bg-[#7a8f5c]/10 text-[#7a8f5c] px-1.5 py-0.5 shrink-0">{slot.platform}</span>
        <span className="truncate flex-1">{slot.title || slot.contentType}</span>
        {hasScript && (
          <span className="text-[10px] rounded-full bg-[#7a8f5c] text-white px-2 py-0.5 shrink-0">
            {open ? "chiudi" : "script"}
          </span>
        )}
      </button>

      {hasScript && open && (
        <div className="mt-2 mb-1 rounded-lg bg-muted/40 p-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">
            Script video
          </p>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{slot.script}</p>
          {slot.caption && (
            <>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mt-3 mb-1.5">
                Testo del post
              </p>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{slot.caption}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PortalEditorial({ token }: { token: string }) {
  const { data, loading } = usePortalData<{ plans: any[]; slots: any[] }>(token, "/editorial");
  if (loading) return <Spinner />;
  const plans = data?.plans ?? [];
  const slots = data?.slots ?? [];
  if (plans.length === 0) return <Empty text="Nessun piano editoriale disponibile." />;
  const MESI = ["", "Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
  return (
    <div className="space-y-4">
      {plans.map((p) => {
        const ps = slots.filter((s) => s.planId === p.id);
        return (
          <div key={p.id} className="rounded-xl border border-card-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">Piano {MESI[p.month] ?? p.month} {p.year}</h3>
              <span className="text-[10px] rounded-full bg-muted px-2 py-0.5">{p.status}</span>
            </div>
            {ps.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nessun contenuto pianificato.</p>
            ) : (
              <div className="space-y-1.5">
                {ps.map((s) => (
                  <PortalSlotRow key={s.id} slot={s} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PortalReports({ token }: { token: string }) {
  const { data, loading } = usePortalData<any[]>(token, "/reports");
  if (loading) return <Spinner />;
  const reports = Array.isArray(data) ? data : [];
  if (reports.length === 0) return <Empty text="Nessun report disponibile." />;
  return (
    <div className="space-y-2">
      {reports.map((r) => (
        <div key={r.id} className="rounded-xl border border-card-border bg-card p-3 flex items-center gap-3">
          <BarChart3 size={16} className="text-[#7a8f5c] shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate">{r.titolo}</p>
            <p className="text-xs text-muted-foreground">{r.period ?? ""} · {fmtDate(r.createdAt)}</p>
          </div>
          {r.pdfUrl && (
            <a href={r.pdfUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-[#7a8f5c] hover:underline shrink-0">
              <ExternalLink size={13} /> Apri
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

function PortalFiles({ token, driveUrl }: { token: string; driveUrl: string | null }) {
  const { data, loading } = usePortalData<{ driveUrl: string | null; files: any[] }>(token, "/files");
  if (loading) return <Spinner />;
  const files = data?.files ?? [];
  const drive = data?.driveUrl ?? driveUrl;
  return (
    <div className="space-y-3">
      {drive && (
        <a
          href={drive}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-xl border border-[#7a8f5c]/30 bg-[#7a8f5c]/5 p-4 hover:bg-[#7a8f5c]/10 transition-colors"
        >
          <FolderOpen size={20} className="text-[#7a8f5c]" />
          <div className="flex-1">
            <p className="font-medium text-sm">Cartella Google Drive condivisa</p>
            <p className="text-xs text-muted-foreground">Apri la cartella con tutti i materiali</p>
          </div>
          <ExternalLink size={16} className="text-[#7a8f5c]" />
        </a>
      )}
      {files.length === 0 ? (
        !drive && <Empty text="Nessun file disponibile." />
      ) : (
        <div className="space-y-2">
          {files.map((f) => (
            <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-card-border bg-card p-3 hover:bg-muted/40 transition-colors">
              <FileText size={16} className="text-[#7a8f5c] shrink-0" />
              <span className="truncate flex-1 text-sm">{f.name}</span>
              <ExternalLink size={14} className="text-muted-foreground shrink-0" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
