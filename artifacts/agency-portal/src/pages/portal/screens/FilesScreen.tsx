import { ArrowLeft, FolderOpen, FileText, ExternalLink, HardDrive } from "lucide-react";
import { usePortalData } from "../PortalContext";
import { usePortalNav } from "../nav";
import { T } from "../theme";
import { Spinner, ErrorState, EmptyState, fmtDate } from "../components/kit";
import type { FilesData } from "../types";

export function FilesScreen() {
  const { pop } = usePortalNav();
  const { data, loading, error, refetch } = usePortalData<FilesData>("/files");
  const files = data?.files ?? [];
  const driveUrl = data?.driveUrl ?? null;

  return (
    <div className="animate-in fade-in slide-in-from-right-3 duration-300">
      <button onClick={pop} className="inline-flex items-center gap-1.5 mb-3 text-sm font-semibold" style={{ color: T.sage }}><ArrowLeft size={18} /> Home</button>
      <h1 className="text-2xl font-extrabold tracking-tight mb-1" style={{ color: T.ink }}>Consegne & file</h1>
      <p className="text-sm mb-4" style={{ color: T.muted }}>Materiali, report e la cartella condivisa.</p>

      {driveUrl && (
        <a href={driveUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-4 rounded-2xl mb-4 text-white active:scale-[.99] transition-transform" style={{ background: `linear-gradient(135deg, ${T.sage}, ${T.forest})` }}>
          <HardDrive size={22} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-bold">Cartella Drive</p>
            <p className="text-white/85 text-sm">Tutti i materiali condivisi</p>
          </div>
          <ExternalLink size={18} />
        </a>
      )}

      {loading && !data ? <Spinner /> : error ? <ErrorState onRetry={refetch} /> : files.length === 0 ? (
        driveUrl
          ? <p className="text-sm text-center py-6" style={{ color: T.muted }}>I file li trovi nella cartella Drive qui sopra.</p>
          : <EmptyState icon={<FolderOpen size={26} />} title="Nessuna consegna ancora" hint="Qui troverai report, piani e materiali quando saranno pronti." />
      ) : (
        <div className="space-y-2.5">
          {files.map((f) => (
            <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3.5 rounded-2xl active:scale-[.99] transition-transform" style={{ background: T.card, border: `1px solid ${T.cardBorder}` }}>
              <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: T.sageSoft, color: T.sage }}><FileText size={18} /></span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm truncate" style={{ color: T.ink }}>{f.name}</p>
                <p className="text-xs" style={{ color: T.muted }}>{f.type?.toUpperCase()} · {fmtDate(f.createdAt)}</p>
              </div>
              <ExternalLink size={16} style={{ color: T.softMuted }} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
