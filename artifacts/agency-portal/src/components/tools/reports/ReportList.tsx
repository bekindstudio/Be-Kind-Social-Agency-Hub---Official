import { AlertCircle, Calendar, Clock, Eye, FileText, Loader2, Plus, Search, Send, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ReportRow = {
  id: number;
  clientId: number;
  clientName?: string;
  tipo: string;
  periodLabel: string;
  status: string;
  titolo?: string;
  createdBy?: string;
  sentAt?: string;
  inviatoAt?: string;
};

interface ReportListProps {
  activeBackendClientId?: number | null;
  defaultMonth: string;
  filteredReports: ReportRow[];
  pendingApproval: ReportRow[];
  pendingSend: ReportRow[];
  drafts: number;
  reportsSentThisMonth: number;
  loading: boolean;
  selectedReportIds: number[];
  setSelectedReportIds: React.Dispatch<React.SetStateAction<number[]>>;
  allSelected: boolean;
  allFilteredIds: number[];
  searchText: string;
  setSearchText: (value: string) => void;
  filterClient: number | "";
  setFilterClient: (value: number | "") => void;
  filterStatus: string;
  setFilterStatus: (value: string) => void;
  filterTipo: string;
  setFilterTipo: (value: string) => void;
  filterAuthor: string;
  setFilterAuthor: (value: string) => void;
  filterFrom: string;
  setFilterFrom: (value: string) => void;
  filterTo: string;
  setFilterTo: (value: string) => void;
  clientList: Array<{ id: number | string; name: string }>;
  authors: string[];
  TIPO_LABELS: Record<string, string>;
  STATUS_LABELS: Record<string, string>;
  STATUS_COLORS: Record<string, string>;
  openReport: (report: ReportRow) => void;
  handleDelete: (id: number) => void;
  handleBulkDelete: () => void;
  onCreateNew: (params: { defaultClientId: string; defaultMonth: string }) => void;
}

function StatCard({ label, value, accent = "default", icon: Icon }: {
  label: string;
  value: number;
  accent?: "default" | "amber" | "indigo" | "sky";
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  const accentMap: Record<string, string> = {
    default: "bg-primary/10 text-primary",
    amber: "bg-amber-100 text-amber-700",
    indigo: "bg-indigo-100 text-indigo-700",
    sky: "bg-sky-100 text-sky-700",
  };

  return (
    <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
      <div className={cn("mb-2 inline-flex rounded-lg p-2", accentMap[accent])}>
        <Icon size={16} />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xl font-bold mt-0.5">{value}</p>
    </div>
  );
}

export function ReportList(props: ReportListProps) {
  const {
    activeBackendClientId,
    defaultMonth,
    filteredReports,
    pendingApproval,
    pendingSend,
    drafts,
    reportsSentThisMonth,
    loading,
    selectedReportIds,
    setSelectedReportIds,
    allSelected,
    allFilteredIds,
    searchText,
    setSearchText,
    filterClient,
    setFilterClient,
    filterStatus,
    setFilterStatus,
    filterTipo,
    setFilterTipo,
    filterAuthor,
    setFilterAuthor,
    filterFrom,
    setFilterFrom,
    filterTo,
    setFilterTo,
    clientList,
    authors,
    TIPO_LABELS,
    STATUS_LABELS,
    STATUS_COLORS,
    openReport,
    handleDelete,
    handleBulkDelete,
    onCreateNew,
  } = props;

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Report</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestione report clienti</p>
        </div>
        <button
          onClick={() => {
            const defaultClientId = Number.isFinite(Number(activeBackendClientId))
              ? String(Number(activeBackendClientId))
              : "";
            onCreateNew({ defaultClientId, defaultMonth });
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90"
        >
          <Plus size={16} /> Nuovo report
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Report totali inviati"
          value={filteredReports.filter((r) => ["inviato", "confermato_cliente"].includes(r.status)).length}
          icon={Send}
        />
        <StatCard label="In attesa di approvazione" value={pendingApproval.length} icon={Clock} accent="amber" />
        <StatCard label="Bozze da completare" value={drafts} icon={FileText} accent="indigo" />
        <StatCard label="Report inviati questo mese" value={reportsSentThisMonth} icon={Calendar} accent="sky" />
      </div>

      {pendingApproval.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-amber-700 mb-3 flex items-center gap-2">
            <AlertCircle size={14} /> Da approvare ({pendingApproval.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingApproval.map((r) => (
              <button key={r.id} onClick={() => openReport(r)} className="text-left bg-amber-50 border border-amber-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">{TIPO_LABELS[r.tipo]}</span>
                  <span className="text-xs text-muted-foreground">{r.periodLabel}</span>
                </div>
                <p className="font-semibold text-sm">{r.clientName}</p>
                <p className="text-xs text-muted-foreground mt-1 truncate">{r.titolo}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {pendingSend.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-700 mb-3 flex items-center gap-2">
            <Send size={14} /> Da inviare ({pendingSend.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingSend.map((r) => (
              <button key={r.id} onClick={() => openReport(r)} className="text-left bg-emerald-50 border border-emerald-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">Approvato</span>
                  <span className="text-xs text-muted-foreground">{r.periodLabel}</span>
                </div>
                <p className="font-semibold text-sm">{r.clientName}</p>
                <p className="text-xs text-muted-foreground mt-1 truncate">{r.titolo}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Cerca cliente o titolo..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select value={filterClient} onChange={(e) => setFilterClient(e.target.value ? parseInt(e.target.value, 10) : "")} className="px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="">Tutti i clienti</option>
          {clientList.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="">Tutti gli stati</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className="px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="">Tutti i tipi</option>
          {Object.entries(TIPO_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select value={filterAuthor} onChange={(e) => setFilterAuthor(e.target.value)} className="px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="">Tutti gli autori</option>
          {authors.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
        <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="animate-spin mr-2" size={18} /> Caricamento...
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="text-center py-20">
          <FileText size={40} className="text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Nessun report trovato</p>
          <p className="text-xs text-muted-foreground mt-1">Crea il primo report per un cliente</p>
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border/60 bg-muted/20 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {selectedReportIds.length > 0
                ? `${selectedReportIds.length} selezionati`
                : "Seleziona più report per azioni rapide"}
            </p>
            <div className="flex items-center gap-2">
              {selectedReportIds.length > 0 && (
                <button onClick={() => setSelectedReportIds([])} className="px-2.5 py-1.5 text-xs border border-input rounded-lg hover:bg-muted">
                  Annulla selezione
                </button>
              )}
              <button onClick={handleBulkDelete} disabled={selectedReportIds.length === 0} className="px-2.5 py-1.5 text-xs bg-destructive text-destructive-foreground rounded-lg disabled:opacity-50">
                Elimina selezionati
              </button>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedReportIds(allFilteredIds);
                      else setSelectedReportIds([]);
                    }}
                  />
                </th>
                <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cliente</th>
                <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tipo</th>
                <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Periodo</th>
                <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Stato</th>
                <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Autore</th>
                <th className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Data invio</th>
                <th className="text-right py-3 px-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((r) => (
                <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => openReport(r)}>
                  <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedReportIds.includes(r.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedReportIds((prev) => (prev.includes(r.id) ? prev : [...prev, r.id]));
                        } else {
                          setSelectedReportIds((prev) => prev.filter((id) => id !== r.id));
                        }
                      }}
                    />
                  </td>
                  <td className="py-3 px-4 font-medium">{r.clientName ?? `#${r.clientId}`}</td>
                  <td className="py-3 px-4">
                    <span className="text-xs px-2 py-0.5 bg-muted rounded-full font-medium">{TIPO_LABELS[r.tipo] ?? r.tipo}</span>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{r.periodLabel}</td>
                  <td className="py-3 px-4">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_COLORS[r.status])}>
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">{r.createdBy ?? "—"}</td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">
                    {(r.sentAt || r.inviatoAt)
                      ? new Date((r.sentAt || r.inviatoAt) as string).toLocaleDateString("it-IT")
                      : "—"}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => openReport(r)} className="p-1.5 text-muted-foreground hover:text-primary rounded-lg hover:bg-muted">
                        <Eye size={14} />
                      </button>
                      <button onClick={() => handleDelete(r.id)} className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-muted">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
