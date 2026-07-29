import { useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Plus, Loader2 } from "lucide-react";
import { usePortalData, usePortal } from "../PortalContext";
import { usePortalNav } from "../nav";
import { portalSend } from "../portalApi";
import { T } from "../theme";
import { Spinner, ErrorState, EmptyState, fmtDate } from "../components/kit";
import type { PortalEvent } from "../types";

export function EventsScreen() {
  const { token } = usePortal();
  const { pop } = usePortalNav();
  const { data, loading, error, refetch } = usePortalData<PortalEvent[]>("/events");
  const [added, setAdded] = useState<PortalEvent[]>([]);
  const [show, setShow] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [type, setType] = useState<"evento" | "collaborazione">("evento");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const list = useMemo(() => {
    const ids = new Set(added.map((a) => a.id));
    return [...added, ...(data ?? []).filter((d) => !ids.has(d.id))]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [added, data]);

  const add = async () => {
    if (title.trim().length < 2 || !date) { setErrMsg("Servono titolo e data"); return; }
    setSaving(true); setErrMsg(null);
    const res = await portalSend<PortalEvent>(token, "/events", "POST", { title: title.trim(), date, type, note: note.trim() || undefined });
    setSaving(false);
    if (res.ok && res.data) {
      setAdded((p) => [res.data as PortalEvent, ...p]);
      setTitle(""); setDate(""); setNote(""); setType("evento"); setShow(false);
    } else {
      setErrMsg(res.data && typeof res.data === "object" && "error" in res.data ? String((res.data as { error: unknown }).error) : "Non riuscito, riprova");
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-right-3 duration-300">
      <button onClick={pop} className="inline-flex items-center gap-1.5 mb-3 text-sm font-semibold" style={{ color: T.sage }}><ArrowLeft size={18} /> Home</button>
      <h1 className="text-2xl font-extrabold tracking-tight mb-1" style={{ color: T.ink }}>Eventi & collaborazioni</h1>
      <p className="text-sm mb-4" style={{ color: T.muted }}>Aggiungi i tuoi prossimi appuntamenti: ci aiutano a pianificare.</p>

      {show ? (
        <div className="rounded-2xl p-4 mb-4 space-y-3" style={{ background: T.card, border: `2px solid ${T.sage}` }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="Es. Apertura nuova sede · Collab con @…"
            className="w-full px-4 py-3 rounded-xl text-base focus:outline-none" style={{ background: T.cream, border: `1px solid ${T.cardBorder}`, color: T.ink }} />
          <div className="grid grid-cols-2 gap-2">
            {(["evento", "collaborazione"] as const).map((t) => (
              <button key={t} onClick={() => setType(t)} className="py-2.5 rounded-xl text-sm font-semibold capitalize"
                style={type === t ? { background: T.sage, color: "#fff" } : { background: T.cream, color: T.muted, border: `1px solid ${T.cardBorder}` }}>{t}</button>
            ))}
          </div>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-4 py-3 rounded-xl text-base focus:outline-none" style={{ background: T.cream, border: `1px solid ${T.cardBorder}`, color: T.ink }} />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Una nota (facoltativa)" className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none" style={{ background: T.cream, border: `1px solid ${T.cardBorder}`, color: T.ink }} />
          {errMsg && <p className="text-sm font-medium text-amber-600">{errMsg}</p>}
          <div className="flex gap-2">
            <button onClick={() => { setShow(false); setErrMsg(null); }} className="px-4 py-2.5 rounded-xl text-sm font-medium" style={{ border: `1px solid ${T.cardBorder}`, color: T.muted }}>Annulla</button>
            <button onClick={add} disabled={saving || title.trim().length < 2 || !date} className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-50" style={{ background: T.sage }}>
              {saving ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Aggiungi"}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShow(true)} className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold mb-4" style={{ border: `2px dashed ${T.sage}66`, color: T.sageDark }}>
          <Plus size={18} /> Aggiungi un evento o collaborazione
        </button>
      )}

      {loading && !data ? <Spinner /> : error ? <ErrorState onRetry={refetch} /> : list.length === 0 ? (
        <EmptyState icon={<CalendarDays size={26} />} title="Nessun evento ancora" hint="Aggiungi il primo qui sopra." />
      ) : (
        <div className="space-y-2.5">
          {list.map((e) => (
            <div key={e.id} className="rounded-2xl p-3.5 flex items-start gap-3" style={{ background: T.card, border: `1px solid ${T.cardBorder}` }}>
              <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: T.sageSoft, color: T.sage }}><CalendarDays size={18} /></span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm" style={{ color: T.ink }}>{e.title}</p>
                <p className="text-xs" style={{ color: T.muted }}>{fmtDate(e.date)}{e.note ? ` · ${e.note}` : ""}</p>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full capitalize shrink-0" style={{ background: T.creamDeep, color: T.muted }}>{e.type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
