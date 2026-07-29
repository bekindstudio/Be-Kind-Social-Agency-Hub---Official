import { useMemo, useState } from "react";
import { X, Copy, Check, ImageIcon, LayoutGrid } from "lucide-react";
import { usePortalData } from "../PortalContext";
import { T, heroGradient } from "../theme";
import { ScreenHeader, Spinner, ErrorState, EmptyState, Skeleton, fmtDate } from "../components/kit";
import { SlotCard } from "../components/cards";
import type { EditorialData, Slot } from "../types";

const MESI = ["", "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

export function ContentScreen() {
  const { data, loading, error, refetch } = usePortalData<EditorialData>("/editorial");
  const [planId, setPlanId] = useState<number | null>(null);
  const [open, setOpen] = useState<Slot | null>(null);

  const plans = data?.plans ?? [];
  const activePlan = planId ?? plans[0]?.id ?? null;
  const slots = useMemo(
    () => (data?.slots ?? []).filter((s) => s.planId === activePlan).sort((a, b) => (a.publishDate ?? "").localeCompare(b.publishDate ?? "")),
    [data, activePlan],
  );

  if (loading && !data) return <><ScreenHeader title="Contenuti" /><Skeleton className="w-full h-44" /></>;
  if (error) return <><ScreenHeader title="Contenuti" /><ErrorState onRetry={refetch} /></>;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <ScreenHeader title="Contenuti" subtitle="Il piano di quello che pubblichiamo" />

      {plans.length === 0 ? (
        <EmptyState icon={<LayoutGrid size={26} />} title="Nessun contenuto ancora" hint="Appena prepariamo il tuo piano editoriale, i contenuti compaiono qui con le anteprime." />
      ) : (
        <>
          {plans.length > 1 && (
            <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-3" style={{ scrollbarWidth: "none" }}>
              {plans.map((p) => {
                const on = p.id === activePlan;
                return (
                  <button key={p.id} onClick={() => setPlanId(p.id)}
                    className="px-3.5 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap"
                    style={on ? { background: T.sage, color: "#fff" } : { background: T.card, color: T.muted, border: `1px solid ${T.cardBorder}` }}>
                    {MESI[p.month] ?? p.month} {p.year}
                  </button>
                );
              })}
            </div>
          )}
          {slots.length === 0 ? (
            <EmptyState title="Piano in preparazione" hint="I contenuti di questo mese arrivano a breve." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {slots.map((s) => <SlotCard key={s.id} slot={s} onClick={() => setOpen(s)} />)}
            </div>
          )}
        </>
      )}

      {open && <ContentDetailSheet slot={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function ContentDetailSheet({ slot, onClose }: { slot: Slot; onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (key: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1500); } catch { /* ignore */ }
  };
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 animate-in fade-in duration-200" />
      <div onClick={(e) => e.stopPropagation()}
        className="relative rounded-t-3xl max-h-[88vh] overflow-y-auto animate-in slide-in-from-bottom duration-300"
        style={{ background: T.cream }}>
        <div className="sticky top-0 flex justify-center pt-3 pb-1" style={{ background: T.cream }}>
          <span className="w-10 h-1.5 rounded-full" style={{ background: T.softMuted }} />
          <button onClick={onClose} className="absolute right-4 top-3 p-1.5 rounded-full" style={{ background: T.creamDeep, color: T.muted }}><X size={16} /></button>
        </div>
        <div className="w-full h-56" style={slot.visualUrl ? { backgroundImage: `url(${slot.visualUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: heroGradient }}>
          {!slot.visualUrl && <div className="w-full h-full flex items-center justify-center"><ImageIcon size={34} className="text-white/70" /></div>}
        </div>
        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: T.sage }}>{slot.platform} · {fmtDate(slot.publishDate)}</p>
            <h2 className="text-2xl font-extrabold mt-1" style={{ color: T.ink }}>{slot.title || slot.contentType || "Contenuto"}</h2>
          </div>
          {slot.caption && (
            <Block title="Cosa scriviamo" onCopy={() => copy("cap", slot.caption!)} copied={copied === "cap"}>
              {slot.caption}
            </Block>
          )}
          {slot.script && (
            <Block title="Cosa dici a camera" onCopy={() => copy("scr", slot.script!)} copied={copied === "scr"}>
              {slot.script}
            </Block>
          )}
          {slot.visualDescription && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: T.muted }}>L'idea visiva</p>
              <p className="text-sm whitespace-pre-wrap" style={{ color: T.ink }}>{slot.visualDescription}</p>
            </div>
          )}
          <div className="h-2" />
        </div>
      </div>
    </div>
  );
}

function Block({ title, children, onCopy, copied }: { title: string; children: React.ReactNode; onCopy: () => void; copied: boolean }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: T.card, border: `1px solid ${T.cardBorder}` }}>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: T.muted }}>{title}</p>
        <button onClick={onCopy} className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: T.sage }}>
          {copied ? <><Check size={13} /> Copiato</> : <><Copy size={13} /> Copia</>}
        </button>
      </div>
      <p className="text-[15px] leading-relaxed whitespace-pre-wrap" style={{ color: T.ink }}>{children}</p>
    </div>
  );
}
