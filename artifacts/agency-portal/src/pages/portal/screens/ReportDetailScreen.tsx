import { ArrowLeft, FileDown, Heart, MessageCircle, Eye } from "lucide-react";
import { usePortalNav } from "../nav";
import { T, heroGradient } from "../theme";
import { KpiCard } from "../components/cards";
import type { Report, TopPost } from "../types";

/** Chiavi note → etichette leggibili; il resto viene "umanizzato". */
const LABELS: Record<string, string> = {
  followers: "Follower", follower: "Follower", reach: "Copertura", impressions: "Impression",
  engagement: "Interazioni", engagementRate: "Engagement", likes: "Like", comments: "Commenti",
  spend: "Spesa", budget: "Budget", clicks: "Click", ctr: "CTR", cpc: "CPC", roas: "ROAS",
  conversions: "Conversioni", views: "Visualizzazioni", newFollowers: "Nuovi follower", profileViews: "Visite profilo",
};
function humanize(k: string): string {
  return LABELS[k] ?? k.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ").replace(/^./, (c) => c.toUpperCase()).trim();
}
function fmtVal(v: unknown): string {
  if (typeof v === "number") return v.toLocaleString("it-IT");
  if (typeof v === "string") return v;
  return "";
}
/** Estrae fino a 6 KPI (valori numerici/stringa) da un oggetto di forma ignota. */
function kpiEntries(obj: Record<string, unknown> | null): [string, unknown][] {
  if (!obj || typeof obj !== "object") return [];
  return Object.entries(obj).filter(([, v]) => typeof v === "number" || (typeof v === "string" && v.length > 0)).slice(0, 6);
}

export function ReportDetailScreen({ report }: { report: Report }) {
  const { pop } = usePortalNav();
  const groups: { label: string; data: Record<string, unknown> | null }[] = [
    { label: "Social", data: report.kpiSocial },
    { label: "Meta Ads", data: report.kpiMeta },
    { label: "Google Ads", data: report.kpiGoogle },
  ];
  const top = Array.isArray(report.topContenuti) ? report.topContenuti : [];

  return (
    <div className="animate-in fade-in slide-in-from-right-3 duration-300 pb-4">
      <button onClick={pop} className="inline-flex items-center gap-1.5 mb-3 text-sm font-semibold" style={{ color: T.sage }}>
        <ArrowLeft size={18} /> Report
      </button>
      <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: T.ink }}>{report.titolo}</h1>
      {report.period && <p className="text-sm mb-5" style={{ color: T.muted }}>{report.period}</p>}

      {report.riepilogoEsecutivo && (
        <div className="rounded-2xl p-4 mb-5 text-white" style={{ background: heroGradient }}>
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/80 mb-1">In due parole</p>
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{report.riepilogoEsecutivo}</p>
        </div>
      )}

      {groups.filter((g) => kpiEntries(g.data).length > 0).map((g) => (
        <section key={g.label} className="mb-5">
          <h2 className="text-sm font-bold uppercase tracking-widest mb-2" style={{ color: T.muted }}>{g.label}</h2>
          <div className="grid grid-cols-2 gap-2.5">
            {kpiEntries(g.data).map(([k, v]) => <KpiCard key={k} label={humanize(k)} value={fmtVal(v)} />)}
          </div>
        </section>
      ))}

      {top.length > 0 && (
        <section className="mb-5">
          <h2 className="text-sm font-bold uppercase tracking-widest mb-2" style={{ color: T.muted }}>I contenuti che hanno funzionato</h2>
          <div className="grid grid-cols-3 gap-2">
            {top.slice(0, 6).map((p: TopPost, i) => (
              <a key={i} href={p.permalink || "#"} target="_blank" rel="noreferrer"
                className="rounded-xl overflow-hidden aspect-square relative"
                style={(p.thumbnailUrl || p.mediaUrl) ? { backgroundImage: `url(${p.thumbnailUrl || p.mediaUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: heroGradient }}>
                <div className="absolute bottom-0 inset-x-0 p-1.5 flex gap-2 text-[10px] text-white font-semibold" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)" }}>
                  {p.likes != null && <span className="inline-flex items-center gap-0.5"><Heart size={10} /> {p.likes}</span>}
                  {p.comments != null && <span className="inline-flex items-center gap-0.5"><MessageCircle size={10} /> {p.comments}</span>}
                  {p.reach != null && <span className="inline-flex items-center gap-0.5"><Eye size={10} /> {p.reach}</span>}
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {report.analisiInsights && <TextSection title="L'analisi del mese" body={report.analisiInsights} />}
      {report.strategiaProssimoPeriodo && <TextSection title="Cosa facciamo il mese prossimo" body={report.strategiaProssimoPeriodo} />}

      {report.pdfUrl && (
        <a href={report.pdfUrl} target="_blank" rel="noreferrer"
          className="mt-2 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-white active:scale-[.99] transition-transform" style={{ background: T.sage }}>
          <FileDown size={18} /> Apri il report in PDF
        </a>
      )}
    </div>
  );
}

function TextSection({ title, body }: { title: string; body: string }) {
  return (
    <section className="mb-5">
      <h2 className="text-sm font-bold uppercase tracking-widest mb-2" style={{ color: T.muted }}>{title}</h2>
      <div className="rounded-2xl p-4" style={{ background: T.card, border: `1px solid ${T.cardBorder}` }}>
        <p className="text-[15px] leading-relaxed whitespace-pre-wrap" style={{ color: T.ink }}>{body}</p>
      </div>
    </section>
  );
}
