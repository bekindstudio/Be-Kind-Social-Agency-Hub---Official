import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BRIEF_SECTIONS,
  emptyBriefData,
  normalizeBriefData,
  briefSectionFilled,
  type BriefData,
} from "@/lib/briefSchema";
import { platformMeta, statusMeta, type ContentIdeaRow } from "@/lib/ideasSchema";
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
  const [status, setStatus] = useState<"loading" | "ok" | "invalid">("loading");
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [tab, setTab] = useState<TabKey>("brief");

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    void (async () => {
      try {
        const r = await fetch(API(token));
        if (!alive) return;
        if (!r.ok) {
          setStatus("invalid");
          return;
        }
        const data = await r.json();
        setClient(data.client);
        setStatus("ok");
      } catch {
        if (alive) setStatus("invalid");
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

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
    </div>
  );
}

/* ── BRIEF (compilabile) ─────────────────────────────────────── */
function PortalBrief({ token }: { token: string }) {
  const [data, setData] = useState<BriefData>(emptyBriefData);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [open, setOpen] = useState<Record<string, boolean>>({ [BRIEF_SECTIONS[0].key]: true });
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

  const totals = useMemo(() => {
    const total = BRIEF_SECTIONS.reduce((a, s) => a + s.fields.length, 0);
    const filled = BRIEF_SECTIONS.reduce((a, s) => a + briefSectionFilled(data, s), 0);
    return { total, filled, pct: total ? Math.round((filled / total) * 100) : 0 };
  }, [data]);

  if (loading) {
    return (
      <div className="py-16 text-center">
        <Loader2 className="mx-auto animate-spin text-[#7a8f5c]" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 rounded-xl border border-card-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Compila il tuo brief</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Più informazioni ci dai, migliore sarà il lavoro. Le risposte si salvano da sole.
            </p>
          </div>
          <SaveBadge state={saveState} />
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Completamento</span>
            <span className="font-semibold text-foreground">{totals.pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-[#7a8f5c] transition-all duration-500" style={{ width: `${totals.pct}%` }} />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {BRIEF_SECTIONS.map((s) => {
          const isOpen = !!open[s.key];
          const filled = briefSectionFilled(data, s);
          const Icon = s.icon;
          return (
            <section key={s.key} className="rounded-xl border border-card-border bg-card overflow-hidden">
              <button
                type="button"
                onClick={() => setOpen((p) => ({ ...p, [s.key]: !p[s.key] }))}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#7a8f5c]/10 text-[#7a8f5c]">
                  <Icon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{s.label}</span>
                    {filled === s.fields.length && filled > 0 && <CheckCircle2 size={14} className="text-emerald-500" />}
                  </span>
                  {s.hint && <span className="block text-[11px] text-muted-foreground truncate">{s.hint}</span>}
                </span>
                <span className="text-[11px] text-muted-foreground shrink-0">{filled}/{s.fields.length}</span>
                <ChevronDown size={16} className={`shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="px-4 pb-4 pt-1 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                  {s.fields.map((f) => (
                    <div key={f.key} className={f.long ? "md:col-span-2" : undefined}>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">{f.label}</label>
                      <textarea
                        value={data[s.key]?.[f.key] ?? ""}
                        onChange={(e) => setField(s.key, f.key, e.target.value)}
                        placeholder={f.placeholder ?? "—"}
                        rows={f.long ? 3 : 2}
                        className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7a8f5c]/40"
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
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
        body: JSON.stringify({ title: title.trim(), url: url.trim() }),
      });
      if (!r.ok) {
        let msg = "Non siamo riusciti a salvare l'idea.";
        try { const j = await r.json(); if (j?.error) msg = String(j.error); } catch { /* ignore */ }
        setError(msg);
        return;
      }
      setUrl("");
      setTitle("");
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
  const { data, loading } = usePortalData<any[]>(token, "/events");
  if (loading) return <Spinner />;
  const events = Array.isArray(data) ? data : [];
  if (events.length === 0) return <Empty text="Nessun evento in programma." />;
  return (
    <div className="space-y-2">
      {events.map((e) => (
        <div key={e.id} className="rounded-xl border border-card-border bg-card p-3 flex items-start gap-3">
          <CalendarDays size={16} className="text-[#7a8f5c] mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm">{e.title}</p>
            <p className="text-xs text-muted-foreground">{fmtDate(e.date)}{e.endDate ? ` → ${fmtDate(e.endDate)}` : ""}{e.note ? ` · ${e.note}` : ""}</p>
          </div>
          <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 shrink-0">{e.type}</span>
        </div>
      ))}
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
                  <div key={s.id} className="flex items-center gap-2 text-sm border-t border-card-border/50 pt-1.5 first:border-0 first:pt-0">
                    <span className="text-xs text-muted-foreground w-16 shrink-0">{fmtDate(s.publishDate)}</span>
                    <span className="text-[10px] rounded bg-[#7a8f5c]/10 text-[#7a8f5c] px-1.5 py-0.5 shrink-0">{s.platform}</span>
                    <span className="truncate flex-1">{s.title || s.contentType}</span>
                  </div>
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
