import { BarChart3, ChevronRight } from "lucide-react";
import { usePortalData } from "../PortalContext";
import { usePortalNav } from "../nav";
import { T } from "../theme";
import { ScreenHeader, Spinner, ErrorState, EmptyState, fmtDate } from "../components/kit";
import type { Report } from "../types";

export function ReportsScreen() {
  const { data, loading, error, refetch } = usePortalData<Report[]>("/reports");
  const { push } = usePortalNav();
  const reports = data ?? [];

  if (loading && !data) return <><ScreenHeader title="Report" /><Spinner /></>;
  if (error) return <><ScreenHeader title="Report" /><ErrorState onRetry={refetch} /></>;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <ScreenHeader title="Report" subtitle="Come stanno andando i tuoi social" />
      {reports.length === 0 ? (
        <EmptyState icon={<BarChart3 size={26} />} title="Nessun report ancora" hint="Ogni mese prepariamo un report con i risultati: lo troverai qui." />
      ) : (
        <div className="space-y-2.5">
          {reports.map((r) => (
            <button key={r.id} onClick={() => push("report", r)}
              className="w-full flex items-center gap-3 p-4 rounded-2xl active:scale-[.99] transition-transform text-left"
              style={{ background: T.card, border: `1px solid ${T.cardBorder}` }}>
              <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: T.sageSoft, color: T.sage }}><BarChart3 size={20} /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold" style={{ color: T.ink }}>{r.titolo}</span>
                <span className="block text-sm" style={{ color: T.muted }}>{r.period ?? fmtDate(r.createdAt)}</span>
              </span>
              <ChevronRight size={18} style={{ color: T.softMuted }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
