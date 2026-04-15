import { AlertTriangle, CheckCircle2, FileText, RefreshCw, Send, ThumbsUp, Trash2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export function ClientReportsSection({
  Section,
  reports,
  clientId,
  reportsLoading,
  REPORT_STATUS_COLORS,
  REPORT_STATUS_LABELS,
  handleApproveReport,
  handleRejectReport,
  handleSendReport,
  sendingReportId,
  handleDeleteReport,
}: {
  Section: React.ComponentType<{ title: string; icon: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }>;
  reports: any[];
  clientId: number;
  reportsLoading: boolean;
  REPORT_STATUS_COLORS: Record<string, string>;
  REPORT_STATUS_LABELS: Record<string, string>;
  handleApproveReport: (id: number) => void;
  handleRejectReport: (id: number) => void;
  handleSendReport: (report: any) => void;
  sendingReportId: number | null;
  handleDeleteReport: (id: number) => void;
}) {
  return (
    <Section
      title={`Report Mensili (${reports.length})`}
      icon={<FileText size={15} className="text-primary" />}
      action={
        <button
          onClick={() => window.location.href = `/reports?client=${clientId}`}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90"
        >
          <Zap size={11} /> Genera Report AI
        </button>
      }
    >
      {reportsLoading ? (
        <div className="py-4 text-center text-sm text-muted-foreground">Caricamento...</div>
      ) : reports.length === 0 ? (
        <div className="text-center py-5">
          <FileText size={28} className="mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground mb-1">Nessun report generato</p>
          <p className="text-xs text-muted-foreground">Vai alla sezione Report per generare il primo report AI mensile.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((report: any) => (
            <div key={report.id} className="flex items-start gap-3 p-3 bg-muted/40 rounded-xl border border-border/50">
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                report.status === "inviato" ? "bg-blue-100" :
                report.status === "approvato" ? "bg-emerald-100" :
                report.status === "in_revisione" ? "bg-amber-100" : "bg-muted"
              )}>
                {report.status === "inviato" ? <Send size={14} className="text-blue-600" /> :
                 report.status === "approvato" ? <ThumbsUp size={14} className="text-emerald-600" /> :
                 report.status === "in_revisione" ? <AlertTriangle size={14} className="text-amber-600" /> :
                 <FileText size={14} className="text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-semibold">{report.periodLabel}</p>
                  <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-medium", REPORT_STATUS_COLORS[report.status] ?? "bg-muted text-muted-foreground")}>
                    {REPORT_STATUS_LABELS[report.status] ?? report.status}
                  </span>
                  {report.aiFlag && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-medium flex items-center gap-1">
                      <AlertTriangle size={9} /> Performance basse
                    </span>
                  )}
                </div>
                {report.aiSummary && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{report.aiSummary}</p>
                )}
                <p className="text-[11px] text-muted-foreground mt-1">
                  {new Date(report.createdAt).toLocaleDateString("it-IT")}
                  {report.recipientEmail && ` · ${report.recipientEmail}`}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {report.status === "in_revisione" && (
                  <>
                    <button
                      onClick={() => handleApproveReport(report.id)}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-100 text-emerald-700 rounded-lg hover:opacity-90 font-medium"
                    >
                      <ThumbsUp size={11} /> Approva
                    </button>
                    <button
                      onClick={() => handleRejectReport(report.id)}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-muted text-muted-foreground rounded-lg hover:opacity-90"
                    >
                      Rimanda
                    </button>
                  </>
                )}
                {(report.status === "approvato" || report.status === "bozza") && (
                  <button
                    onClick={() => handleSendReport(report)}
                    disabled={sendingReportId === report.id}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium disabled:opacity-50"
                  >
                    {sendingReportId === report.id ? <RefreshCw size={11} className="animate-spin" /> : <Send size={11} />}
                    Invia
                  </button>
                )}
                {report.status === "inviato" && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 size={12} className="text-emerald-500" />
                    {report.sentAt ? new Date(report.sentAt).toLocaleDateString("it-IT") : "Inviato"}
                  </span>
                )}
                <button
                  onClick={() => handleDeleteReport(report.id)}
                  className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
