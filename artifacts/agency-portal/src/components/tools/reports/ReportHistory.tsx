export interface SavedReport {
  id: string;
  clientId: string;
  period: string;
  generatedAt: string;
  sections: string[];
  notes: string;
}

interface ReportHistoryProps {
  reports: SavedReport[];
  onRegenerate: (saved: SavedReport) => void;
}

export function ReportHistory({ reports, onRegenerate }: ReportHistoryProps) {
  if (reports.length === 0) return null;
  return (
    <div className="rounded-xl border border-card-border bg-card p-4">
      <h3 className="font-semibold mb-3">Storico report</h3>
      <div className="space-y-2">
        {reports.map((report) => (
          <div key={report.id} className="rounded-lg border border-border bg-background/70 p-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{report.period}</p>
              <p className="text-xs text-muted-foreground">
                Generato il {new Date(report.generatedAt).toLocaleDateString("it-IT")} · Sezioni {report.sections.length}
              </p>
            </div>
            <button onClick={() => onRegenerate(report)} className="px-2.5 py-1.5 text-xs rounded-md bg-secondary text-secondary-foreground hover:opacity-90 transition-opacity">
              Rigenera
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
