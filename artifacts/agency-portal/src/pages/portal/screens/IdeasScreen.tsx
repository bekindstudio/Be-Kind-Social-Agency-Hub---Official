import { useMemo, useState } from "react";
import { Lightbulb, Plus, ExternalLink, Loader2 } from "lucide-react";
import { usePortalData, usePortal } from "../PortalContext";
import { portalSend } from "../portalApi";
import { T } from "../theme";
import { ScreenHeader, Spinner, ErrorState, EmptyState, CategoryChip, fmtDate } from "../components/kit";
import { CATEGORY_META } from "@/lib/ideasSchema";
import type { Idea } from "../types";

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "Idea"; }
}

export function IdeasScreen() {
  const { token } = usePortal();
  const { data, loading, error, refetch } = usePortalData<Idea[]>("/ideas");
  const [added, setAdded] = useState<Idea[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState("");
  const [why, setWhy] = useState("");
  const [category, setCategory] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const list = useMemo(() => {
    const ids = new Set(added.map((a) => String(a.id)));
    return [...added, ...(data ?? []).filter((d) => !ids.has(String(d.id)))];
  }, [added, data]);

  const submit = async () => {
    if (!url.trim()) { setErrMsg("Incolla il link"); return; }
    setSaving(true); setErrMsg(null);
    const res = await portalSend<Idea>(token, "/ideas", "POST", {
      url: url.trim(), title: hostOf(url.trim()), notes: why.trim() || undefined, category: category || undefined,
    });
    setSaving(false);
    if (res.ok && res.data) {
      setAdded((p) => [res.data as Idea, ...p]);
      setUrl(""); setWhy(""); setCategory(""); setShowForm(false);
    } else {
      setErrMsg(res.data && typeof res.data === "object" && "error" in res.data ? String((res.data as { error: unknown }).error) : "Non riuscito, riprova");
    }
  };

  if (loading && !data) return <><ScreenHeader title="Idee" /><Spinner /></>;
  if (error) return <><ScreenHeader title="Idee" /><ErrorState onRetry={refetch} /></>;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <ScreenHeader title="Le tue idee" subtitle="Incolla i video che vuoi replicare" />

      {showForm ? (
        <div className="rounded-2xl p-4 mb-4 space-y-3" style={{ background: T.card, border: `2px solid ${T.sage}` }}>
          <input value={url} onChange={(e) => setUrl(e.target.value)} autoFocus placeholder="Incolla il link (Instagram, TikTok…)"
            className="w-full px-4 py-3 rounded-xl text-base focus:outline-none" style={{ background: T.cream, border: `1px solid ${T.cardBorder}`, color: T.ink }} />
          <input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Perché ti piace? (facoltativo)"
            className="w-full px-4 py-3 rounded-xl text-base focus:outline-none" style={{ background: T.cream, border: `1px solid ${T.cardBorder}`, color: T.ink }} />
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_META.filter((c) => c.value !== "da_classificare").map((c) => {
              const on = category === c.value;
              return (
                <button key={c.value} onClick={() => setCategory(on ? "" : c.value)}
                  className="px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={on ? { background: T.sage, color: "#fff" } : { background: T.cream, color: T.muted, border: `1px solid ${T.cardBorder}` }}>
                  {c.label}
                </button>
              );
            })}
          </div>
          {errMsg && <p className="text-sm font-medium text-amber-600">{errMsg}</p>}
          <div className="flex gap-2">
            <button onClick={() => { setShowForm(false); setErrMsg(null); }} className="px-4 py-2.5 rounded-xl text-sm font-medium" style={{ border: `1px solid ${T.cardBorder}`, color: T.muted }}>Annulla</button>
            <button onClick={submit} disabled={saving || !url.trim()} className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-50" style={{ background: T.sage }}>
              {saving ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Aggiungi idea"}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold mb-4" style={{ border: `2px dashed ${T.sage}66`, color: T.sageDark }}>
          <Plus size={18} /> Aggiungi un video da replicare
        </button>
      )}

      {list.length === 0 ? (
        <EmptyState icon={<Lightbulb size={26} />} title="Nessuna idea ancora" hint="Quando vedi un reel che ti piace, incollalo qui: lo useremo come ispirazione." />
      ) : (
        <div className="space-y-2.5">
          {list.map((i) => (
            <div key={i.id} className="rounded-2xl p-3.5 flex items-start gap-3" style={{ background: T.card, border: `1px solid ${T.cardBorder}` }}>
              <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: T.sageSoft, color: T.sage }}><Lightbulb size={18} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm" style={{ color: T.ink }}>{i.title || hostOf(i.url)}</span>
                  <CategoryChip category={i.category} />
                  {i.source === "client" && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: T.sageSoft, color: T.sageDark }}>tua</span>}
                </div>
                {i.notes && <p className="text-sm mt-0.5" style={{ color: T.muted }}>{i.notes}</p>}
                <a href={i.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs mt-1 font-medium" style={{ color: T.sage }}>
                  <ExternalLink size={12} /> Apri
                </a>
              </div>
              <span className="text-[10px] shrink-0" style={{ color: T.softMuted }}>{fmtDate(i.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
