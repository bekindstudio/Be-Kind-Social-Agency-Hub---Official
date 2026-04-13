import { useState, useRef, useEffect, useCallback } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import { Layout } from "@/components/layout/Layout";
import { cn } from "@/lib/utils";
import { portalFetch } from "@workspace/api-client-react";
import {
  TrendingUp,
  TrendingDown,
  BarChart2,
  Download,
  RefreshCw,
  Target,
  Eye,
  Heart,
  MousePointerClick,
  DollarSign,
  Zap,
  ChevronDown,
  Users,
  ExternalLink,
  AlertCircle,
  FileText,
  Send,
  AlertTriangle,
  X,
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  ChevronLeft,
  Pencil,
  Save,
  Trash2,
  Filter,
  Search,
  Share2,
  Calendar,
  ArrowRight,
  ThumbsUp,
  ThumbsDown,
  Mail,
  Globe,
  Megaphone,
  ArrowUpRight,
  Play,
  Bookmark,
  Image,
  UserPlus,
  Grid3X3,
  Sparkles,
} from "lucide-react";
import { useListClients } from "@workspace/api-client-react";
import { useAiChat } from "@/components/ai-chat/AiChatContext";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

const PRIMARY = "#7a8f5c";
const PRIMARY_LIGHT = "rgba(122,143,92,0.12)";

const TIPO_LABELS: Record<string, string> = { settimanale: "Settimanale", mensile: "Mensile", trimestrale: "Trimestrale", custom: "Custom" };
const STATUS_LABELS: Record<string, string> = { bozza: "Bozza", in_revisione: "In revisione", approvato: "Approvato", inviato: "Inviato", confermato_cliente: "Confermato dal cliente" };
const STATUS_COLORS: Record<string, string> = {
  bozza: "bg-gray-100 text-gray-600",
  in_revisione: "bg-amber-100 text-amber-700",
  approvato: "bg-emerald-100 text-emerald-700",
  inviato: "bg-blue-100 text-blue-700",
  confermato_cliente: "bg-teal-100 text-teal-700",
};

const MONTHS_IT = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];

type Report = {
  id: number;
  clientId: number;
  tipo: string;
  period: string;
  periodLabel: string;
  status: string;
  titolo?: string;
  riepilogoEsecutivo?: string;
  analisiInsights?: string;
  strategiaProssimoPeriodo?: string;
  noteAggiuntive?: string;
  aiSummary?: string;
  aiFlag?: boolean;
  aiFlags?: string[];
  metricsJson?: any;
  kpiSocialJson?: any;
  kpiMetaJson?: any;
  kpiGoogleJson?: any;
  topContenutiJson?: any[];
  recipientEmail?: string;
  subject?: string;
  approvedBy?: string;
  approvedAt?: string;
  sentAt?: string;
  inviatoAt?: string;
  createdBy?: string;
  createdAt?: string;
  clientName?: string;
  clientEmail?: string;
  approvals?: any[];
};

function AiReportButton({ report, igSummary, metaSummary }: { report: any; igSummary: any; metaSummary: any }) {
  const { openDrawer } = useAiChat();
  return (
    <button
      onClick={() => openDrawer({
        type: "report",
        data: {
          id: report.id,
          clientName: report.clientName ?? report.client?.name,
          period: report.periodo ?? report.tipo,
          kpi: {
            followers: igSummary?.followers,
            reach: igSummary?.reach,
            engagementRate: igSummary?.engagementRate,
            adSpend: metaSummary?.totalSpend,
            roas: metaSummary?.roas,
          },
        },
      })}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 text-violet-700 rounded-lg hover:bg-violet-100 transition-colors border border-violet-200 text-xs font-medium print:hidden"
    >
      <Sparkles size={12} /> Chiedi all'AI
    </button>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, trend, color = "primary" }: {
  label: string; value: string | number; sub?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  trend?: { value: number; positive?: boolean };
  color?: string;
}) {
  const colors: Record<string, string> = {
    primary: "bg-primary/10 text-primary", indigo: "bg-indigo-100 text-indigo-600",
    amber: "bg-amber-100 text-amber-600", violet: "bg-violet-100 text-violet-600",
    sky: "bg-sky-100 text-sky-600", rose: "bg-rose-100 text-rose-600",
  };
  return (
    <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <div className={cn("p-2 rounded-lg text-sm", colors[color] ?? colors.primary)}><Icon size={16} /></div>
        {trend && (
          <div className={cn("flex items-center gap-0.5 text-xs font-medium", trend.positive !== false && trend.value > 0 ? "text-emerald-600" : "text-rose-500")}>
            {trend.value > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(trend.value)}%
          </div>
        )}
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xl font-bold mt-0.5 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

const CHART_DEFAULTS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { backgroundColor: "#1a2410", titleColor: "#e8ede0", bodyColor: "#a8b89a", padding: 10, cornerRadius: 8 } },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number, prefix = "") => `${prefix}${n.toLocaleString("it-IT")}`;
const fmtEur = (n: number) => `EUR ${n.toLocaleString("it-IT", { maximumFractionDigits: 0 })}`;

function getPeriodDates(tipo: string, period: string): { inizio: string; fine: string } {
  if (tipo === "settimanale") {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return { inizio: d.toISOString().split("T")[0], fine: new Date().toISOString().split("T")[0] };
  }
  if (tipo === "trimestrale") {
    const [y, q] = period.split("-Q");
    const qn = parseInt(q) || 1;
    const startMonth = (qn - 1) * 3;
    return {
      inizio: `${y}-${String(startMonth + 1).padStart(2, "0")}-01`,
      fine: `${y}-${String(startMonth + 3).padStart(2, "0")}-${[31, 30, 31, 30][qn - 1] ?? 30}`,
    };
  }
  const [y, m] = period.split("-");
  const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
  return { inizio: `${period}-01`, fine: `${period}-${lastDay}` };
}

function getPeriodLabel(tipo: string, period: string): string {
  if (tipo === "settimanale") {
    const d = new Date();
    const end = d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
    d.setDate(d.getDate() - 6);
    const start = d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
    return `${start} - ${end}`;
  }
  if (tipo === "trimestrale") {
    const [y, q] = period.split("-Q");
    return `Q${q} ${y}`;
  }
  const [y, m] = period.split("-");
  return `${MONTHS_IT[parseInt(m) - 1] ?? m} ${y}`;
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────

export default function Reports() {
  const { data: clients } = useListClients();
  const clientList = Array.isArray(clients) ? clients : [];

  // View state
  const [view, setView] = useState<"list" | "create" | "detail" | "edit">("list");
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  const [liveData, setLiveData] = useState<any>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveDateFrom, setLiveDateFrom] = useState("");
  const [liveDateTo, setLiveDateTo] = useState("");

  // List state
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterClient, setFilterClient] = useState<number | "">(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get("client");
    return c ? parseInt(c) : "";
  });
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterTipo, setFilterTipo] = useState<string>("");
  const [filterAuthor, setFilterAuthor] = useState<string>("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [searchText, setSearchText] = useState("");

  // Create form
  const [createForm, setCreateForm] = useState({
    clientId: "", tipo: "mensile" as string, period: "",
    customFrom: "", customTo: "", title: "",
    riepilogoEsecutivo: "", analisiInsights: "", strategiaProssimoPeriodo: "", noteAggiuntive: "",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Detail/edit
  const [editForm, setEditForm] = useState<Partial<Report>>({});
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendEmail, setSendEmail] = useState("");
  const [sendResult, setSendResult] = useState<any>(null);

  const printRef = useRef<HTMLDivElement>(null);

  // ── Fetch reports ──
  const fetchReports = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterClient) params.set("clientId", String(filterClient));
      if (filterStatus) params.set("status", filterStatus);
      if (filterTipo) params.set("tipo", filterTipo);
      if (filterAuthor) params.set("author", filterAuthor);
      if (filterFrom) params.set("from", filterFrom);
      if (filterTo) params.set("to", filterTo);
      const res = await portalFetch(`/api/reports?${params}`);
      const data = await res.json();
      setReports(Array.isArray(data) ? data : []);
    } catch { if (!silent) setReports([]); }
    finally { setLoading(false); }
  }, [filterClient, filterStatus, filterTipo, filterAuthor, filterFrom, filterTo]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  useEffect(() => {
    const interval = setInterval(() => { fetchReports(true); }, 30000);
    return () => clearInterval(interval);
  }, [fetchReports]);

  const fetchReportDetail = useCallback(async (id: number) => {
    try {
      const res = await portalFetch(`/api/reports/detail/${id}`);
      const data = await res.json();
      setSelectedReport(data);
      setEditForm({
        riepilogoEsecutivo: data.riepilogoEsecutivo ?? "",
        analisiInsights: data.analisiInsights ?? "",
        strategiaProssimoPeriodo: data.strategiaProssimoPeriodo ?? "",
        noteAggiuntive: data.noteAggiuntive ?? "",
        recipientEmail: data.recipientEmail ?? data.clientEmail ?? "",
        subject: data.subject ?? "",
      });
      setSendEmail(data.recipientEmail ?? data.clientEmail ?? "");
      setLiveData(null);
      if (data.periodoInizio) setLiveDateFrom(data.periodoInizio);
      else {
        const d = new Date(); d.setDate(d.getDate() - 30);
        setLiveDateFrom(d.toISOString().slice(0, 10));
      }
      if (data.periodoFine) setLiveDateTo(data.periodoFine);
      else setLiveDateTo(new Date().toISOString().slice(0, 10));
    } catch { }
  }, []);

  const handleRefreshLive = useCallback(async () => {
    if (!selectedReport) return;
    setLiveLoading(true);
    try {
      const params = new URLSearchParams();
      if (liveDateFrom) params.set("since", liveDateFrom);
      if (liveDateTo) params.set("until", liveDateTo);
      params.set("sync", "true");
      const syncRes = await portalFetch(`/api/meta/sync/${selectedReport.clientId}?${params}`, { method: "POST" });
      if (!syncRes.ok) throw new Error("Errore sync");
      const daysDiff = liveDateFrom && liveDateTo
        ? Math.max(1, Math.ceil((new Date(liveDateTo).getTime() - new Date(liveDateFrom).getTime()) / (1000 * 60 * 60 * 24)))
        : 30;
      const range = daysDiff <= 7 ? "7d" : daysDiff <= 30 ? "30d" : "90d";
      const freshRes = await portalFetch(`/api/meta/insights/${selectedReport.clientId}?range=${range}&${params}`);
      const data = await freshRes.json();
      setLiveData(data);
    } catch (err: any) {
      console.error("Live refresh error:", err);
    } finally {
      setLiveLoading(false);
    }
  }, [selectedReport, liveDateFrom, liveDateTo]);

  // ── Create report ──
  const handleCreate = async () => {
    if (!createForm.clientId) { setCreateError("Seleziona un cliente"); return; }
    if (createForm.tipo !== "custom" && !createForm.period) { setCreateError("Seleziona un periodo"); return; }
    if (createForm.tipo === "custom" && (!createForm.customFrom || !createForm.customTo)) { setCreateError("Seleziona un intervallo date custom"); return; }
    setCreating(true);
    setCreateError("");
    try {
      const tipo = createForm.tipo;
      const period = createForm.period;
      const periodLabel = getPeriodLabel(tipo, period);
      const dates = tipo === "custom" ? { inizio: createForm.customFrom, fine: createForm.customTo } : getPeriodDates(tipo, period);

      const range = tipo === "settimanale" ? "7d" : tipo === "trimestrale" ? "90d" : "30d";
      const insightsParams = new URLSearchParams({ range });
      if (dates.inizio) insightsParams.set("since", dates.inizio);
      if (dates.fine) insightsParams.set("until", dates.fine);
      const insightsRes = await portalFetch(`/api/meta/insights/${createForm.clientId}?${insightsParams}`).then((r) => r.json()).catch(() => null);

      const res = await portalFetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: createForm.clientId,
          tipo,
          period,
          periodLabel: tipo === "custom" ? `${createForm.customFrom} - ${createForm.customTo}` : periodLabel,
          periodoInizio: dates.inizio,
          periodoFine: dates.fine,
          titolo: createForm.title || undefined,
          metrics: insightsRes ?? null,
          isRealData: insightsRes && !insightsRes.mock,
          riepilogoEsecutivo: createForm.riepilogoEsecutivo || undefined,
          analisiInsights: createForm.analisiInsights || undefined,
          strategiaProssimoPeriodo: createForm.strategiaProssimoPeriodo || undefined,
          noteAggiuntive: createForm.noteAggiuntive || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setView("detail");
      setSelectedReportId(data.id);
      await fetchReportDetail(data.id);
      await fetchReports();
    } catch (err: any) {
      setCreateError(err.message ?? "Errore durante la creazione");
    } finally {
      setCreating(false);
    }
  };

  // ── Save edits ──
  const handleSaveEdits = async () => {
    if (!selectedReportId) return;
    setSaving(true);
    try {
      await portalFetch(`/api/reports/${selectedReportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      await fetchReportDetail(selectedReportId);
      setView("detail");
      await fetchReports();
    } finally { setSaving(false); }
  };

  // ── Actions ──
  const doAction = async (action: string, body: any = {}) => {
    if (!selectedReportId) return;
    setActionLoading(action);
    try {
      const res = await portalFetch(`/api/reports/${selectedReportId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error ?? "Errore"); return data; }
      await fetchReportDetail(selectedReportId);
      await fetchReports();
      return data;
    } finally { setActionLoading(""); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Eliminare questo report?")) return;
    await portalFetch(`/api/reports/${id}`, { method: "DELETE" });
    if (selectedReportId === id) { setView("list"); setSelectedReport(null); }
    await fetchReports();
  };

  const handleSend = async () => {
    const data = await doAction("send", { recipientEmail: sendEmail });
    if (data) setSendResult(data);
  };

  const handleExportPDF = async () => {
    if (!printRef.current) return;
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const container = printRef.current;

      const toDataUrl = (url: string): Promise<string> =>
        fetch(url)
          .then((r) => r.blob())
          .then(
            (blob) =>
              new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = () => resolve("");
                reader.readAsDataURL(blob);
              }),
          )
          .catch(() => "");

      const images = container.querySelectorAll("img");
      const origSrcs: { img: HTMLImageElement; src: string }[] = [];
      const inlinePromises: Promise<void>[] = [];
      images.forEach((img) => {
        const src = img.src;
        if (src && (src.includes("/api/meta/media-proxy") || src.startsWith("http"))) {
          origSrcs.push({ img, src });
          inlinePromises.push(
            toDataUrl(src).then((dataUrl) => {
              if (dataUrl) img.src = dataUrl;
            }),
          );
        }
      });
      await Promise.all(inlinePromises);

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        imageTimeout: 15000,
      });

      origSrcs.forEach(({ img, src }) => { img.src = src; });

      const imgData = canvas.toDataURL("image/jpeg", 0.92);

      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = pdfWidth / imgWidth;
      const totalHeight = imgHeight * ratio;

      let position = 0;
      let page = 0;

      while (position < totalHeight) {
        if (page > 0) pdf.addPage();

        const srcY = position / ratio;
        const srcH = Math.min(pdfHeight / ratio, imgHeight - srcY);
        const destH = srcH * ratio;

        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = imgWidth;
        pageCanvas.height = Math.ceil(srcH);
        const ctx = pageCanvas.getContext("2d")!;
        ctx.drawImage(canvas, 0, srcY, imgWidth, srcH, 0, 0, imgWidth, srcH);

        const pageData = pageCanvas.toDataURL("image/jpeg", 0.92);
        pdf.addImage(pageData, "JPEG", 0, 0, pdfWidth, destH);

        const pageNum = page + 1;
        pdf.setFontSize(8);
        pdf.setTextColor(150);
        pdf.text(`Be Kind Social Agency HUB · Michael Balleroni · Pagina ${pageNum}`, pdfWidth / 2, pdfHeight - 5, { align: "center" });

        position += pdfHeight;
        page++;
      }

      const filename = `report_${selectedReport?.clientName ?? "cliente"}_${selectedReport?.periodLabel ?? "periodo"}.pdf`.replace(/\s+/g, "_");
      pdf.save(filename);
    } catch (err: any) {
      console.error("PDF export error:", err?.message ?? err?.name ?? String(err), err);
      alert("Errore durante l'esportazione PDF. Riprova.");
    }
  };

  // ── Auto-refresh when date range changes ──
  const dateRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!selectedReport || view !== "detail" || !liveDateFrom || !liveDateTo) return;
    if (new Date(liveDateFrom) >= new Date(liveDateTo)) return;
    if (dateRefreshTimer.current) clearTimeout(dateRefreshTimer.current);
    dateRefreshTimer.current = setTimeout(() => {
      handleRefreshLive();
    }, 600);
    return () => { if (dateRefreshTimer.current) clearTimeout(dateRefreshTimer.current); };
  }, [liveDateFrom, liveDateTo]);

  // ── Default period ──
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const defaultQuarter = `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`;

  useEffect(() => {
    if (createForm.tipo === "mensile" && !createForm.period) setCreateForm((f) => ({ ...f, period: defaultMonth }));
    if (createForm.tipo === "trimestrale" && !createForm.period) setCreateForm((f) => ({ ...f, period: defaultQuarter }));
    if (createForm.tipo === "settimanale" && !createForm.period) setCreateForm((f) => ({ ...f, period: defaultMonth }));
  }, [createForm.tipo]);

  // ── Open detail ──
  const openReport = (r: Report) => {
    setSelectedReportId(r.id);
    fetchReportDetail(r.id);
    setView("detail");
  };

  // ── Filtered reports ──
  const filteredReports = reports.filter((r) => {
    if (searchText) {
      const s = searchText.toLowerCase();
      if (!(r.clientName?.toLowerCase().includes(s) || r.titolo?.toLowerCase().includes(s) || r.periodLabel?.toLowerCase().includes(s))) return false;
    }
    return true;
  });

  const pendingApproval = filteredReports.filter((r) => r.status === "in_revisione");
  const pendingSend = filteredReports.filter((r) => r.status === "approvato");
  const reportsSentThisMonth = filteredReports.filter((r) => {
    const s = r.sentAt || r.inviatoAt;
    return s ? new Date(s).getMonth() === new Date().getMonth() : false;
  }).length;
  const drafts = filteredReports.filter((r) => r.status === "bozza").length;
  const authors = Array.from(new Set(filteredReports.map((r) => r.createdBy).filter(Boolean)));

  // ═════════════════════════════════════════════════════════════════════════════
  // ── LIST VIEW ──
  // ═════════════════════════════════════════════════════════════════════════════

  if (view === "list") {
    return (
      <Layout>
        <div className="p-8 max-w-6xl">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Report</h1>
              <p className="text-muted-foreground text-sm mt-1">Gestione report clienti</p>
            </div>
            <button
              onClick={() => { setView("create"); setCreateForm({ clientId: "", tipo: "mensile", period: defaultMonth, customFrom: "", customTo: "", title: "", riepilogoEsecutivo: "", analisiInsights: "", strategiaProssimoPeriodo: "", noteAggiuntive: "" }); setCreateError(""); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90"
            >
              <Plus size={16} /> Nuovo report
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <KpiCard label="Report totali inviati" value={filteredReports.filter((r) => ["inviato", "confermato_cliente"].includes(r.status)).length} icon={Send} />
            <KpiCard label="In attesa di approvazione" value={pendingApproval.length} icon={Clock} color="amber" />
            <KpiCard label="Bozze da completare" value={drafts} icon={FileText} color="indigo" />
            <KpiCard label="Report inviati questo mese" value={reportsSentThisMonth} icon={Calendar} color="sky" />
          </div>

          {/* Quick sections */}
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

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" placeholder="Cerca cliente o titolo..." value={searchText} onChange={(e) => setSearchText(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <select value={filterClient} onChange={(e) => setFilterClient(e.target.value ? parseInt(e.target.value) : "")}
              className="px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">Tutti i clienti</option>
              {clientList.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">Tutti gli stati</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}
              className="px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">Tutti i tipi</option>
              {Object.entries(TIPO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select value={filterAuthor} onChange={(e) => setFilterAuthor(e.target.value)}
              className="px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">Tutti gli autori</option>
              {authors.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)}
              className="px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)}
              className="px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          {/* Reports table */}
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="animate-spin mr-2" size={18} /> Caricamento...</div>
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-20">
              <FileText size={40} className="text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground text-sm">Nessun report trovato</p>
              <p className="text-xs text-muted-foreground mt-1">Crea il primo report per un cliente</p>
            </div>
          ) : (
            <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
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
                      <td className="py-3 px-4 font-medium">{r.clientName ?? `#${r.clientId}`}</td>
                      <td className="py-3 px-4"><span className="text-xs px-2 py-0.5 bg-muted rounded-full font-medium">{TIPO_LABELS[r.tipo] ?? r.tipo}</span></td>
                      <td className="py-3 px-4 text-muted-foreground">{r.periodLabel}</td>
                      <td className="py-3 px-4"><span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_COLORS[r.status])}>{STATUS_LABELS[r.status] ?? r.status}</span></td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">{r.createdBy ?? "—"}</td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">{(r.sentAt || r.inviatoAt) ? new Date((r.sentAt || r.inviatoAt) as string).toLocaleDateString("it-IT") : "—"}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => openReport(r)} className="p-1.5 text-muted-foreground hover:text-primary rounded-lg hover:bg-muted"><Eye size={14} /></button>
                          <button onClick={() => handleDelete(r.id)} className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-muted"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Layout>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // ── CREATE VIEW ──
  // ═════════════════════════════════════════════════════════════════════════════

  if (view === "create") {
    const selectedClient = clientList.find((c: any) => String(c.id) === String(createForm.clientId)) as any;
    const metaConnected = !!(selectedClient?.metaPageId);
    const googleConnected = !!(selectedClient?.googleAdsId);
    const autoTitle = createForm.clientId
      ? `Report ${TIPO_LABELS[createForm.tipo] ?? "Mensile"} — ${selectedClient?.name ?? "Cliente"} — ${createForm.tipo === "custom" ? `${createForm.customFrom || "..." }/${createForm.customTo || "..."}` : getPeriodLabel(createForm.tipo, createForm.period || defaultMonth)}`
      : "";
    return (
      <Layout>
        <div className="p-8 max-w-3xl">
          <button onClick={() => setView("list")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4">
            <ChevronLeft size={16} /> Torna ai report
          </button>

          <h1 className="text-2xl font-bold tracking-tight mb-1">Nuovo Report</h1>
          <p className="text-muted-foreground text-sm mb-6">Compila i dati e genera un report per il cliente</p>

          <div className="space-y-5">
            {/* Cliente */}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground block mb-1.5">Cliente</label>
              <select value={createForm.clientId} onChange={(e) => setCreateForm((f) => ({ ...f, clientId: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Seleziona un cliente...</option>
                {clientList.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Tipo */}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground block mb-1.5">Tipo report</label>
              <div className="grid grid-cols-3 gap-2">
                {(["settimanale", "mensile", "trimestrale", "custom"] as const).map((t) => (
                  <button key={t} onClick={() => setCreateForm((f) => ({ ...f, tipo: t, period: t === "mensile" ? defaultMonth : t === "trimestrale" ? defaultQuarter : defaultMonth }))}
                    className={cn("py-2.5 rounded-xl text-sm font-medium border transition-all",
                      createForm.tipo === t ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input hover:border-primary/50")}>
                  {TIPO_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            {/* Periodo */}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground block mb-1.5">Periodo</label>
              {createForm.tipo === "mensile" && (
                <input type="month" value={createForm.period} onChange={(e) => setCreateForm((f) => ({ ...f, period: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
              )}
              {createForm.tipo === "trimestrale" && (
                <select value={createForm.period} onChange={(e) => setCreateForm((f) => ({ ...f, period: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                  {[1, 2, 3, 4].map((q) => {
                    const y = now.getFullYear();
                    return <option key={q} value={`${y}-Q${q}`}>Q{q} {y}</option>;
                  })}
                </select>
              )}
              {createForm.tipo === "settimanale" && (
                <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">Ultimi 7 giorni (automatico)</p>
              )}
              {createForm.tipo === "custom" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input type="date" value={createForm.customFrom} onChange={(e) => setCreateForm((f) => ({ ...f, customFrom: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                  <input type="date" value={createForm.customTo} onChange={(e) => setCreateForm((f) => ({ ...f, customTo: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              )}
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground block mb-1.5">Titolo report</label>
              <input value={createForm.title || autoTitle} onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>

            {!!selectedClient && !metaConnected && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 text-sm flex items-center justify-between gap-2">
                <span>Account Meta non collegato — i dati ads non saranno disponibili</span>
                <button onClick={() => (window.location.href = `/clients/${selectedClient.id}`)} className="text-xs font-semibold underline">Collega ora →</button>
              </div>
            )}
            {!!selectedClient && !googleConnected && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 text-sm flex items-center justify-between gap-2">
                <span>Account Google Ads non collegato — i dati ads non saranno disponibili</span>
                <button onClick={() => (window.location.href = `/clients/${selectedClient.id}`)} className="text-xs font-semibold underline">Collega ora →</button>
              </div>
            )}

            {/* Text sections */}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground block mb-1.5">
                Riepilogo esecutivo <span className="font-normal text-muted-foreground/60">(opzionale — compilato dall'AI se vuoto)</span>
              </label>
              <textarea value={createForm.riepilogoEsecutivo} onChange={(e) => setCreateForm((f) => ({ ...f, riepilogoEsecutivo: e.target.value }))}
                rows={4} placeholder="Sintesi del periodo, highlights principali..."
                className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground block mb-1.5">Analisi e insights</label>
              <textarea value={createForm.analisiInsights} onChange={(e) => setCreateForm((f) => ({ ...f, analisiInsights: e.target.value }))}
                rows={3} placeholder="Cosa ha funzionato, cosa migliorare..."
                className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground block mb-1.5">Strategia prossimo periodo</label>
              <textarea value={createForm.strategiaProssimoPeriodo} onChange={(e) => setCreateForm((f) => ({ ...f, strategiaProssimoPeriodo: e.target.value }))}
                rows={3} placeholder="Azioni pianificate, obiettivi..."
                className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground block mb-1.5">Note aggiuntive</label>
              <textarea value={createForm.noteAggiuntive} onChange={(e) => setCreateForm((f) => ({ ...f, noteAggiuntive: e.target.value }))}
                rows={2} placeholder="Comunicazioni extra per il cliente..."
                className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
            </div>

            {createError && (
              <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">
                <AlertCircle size={14} /> {createError}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button onClick={handleCreate} disabled={creating}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                {creating ? <><Loader2 size={14} className="animate-spin" /> Generazione in corso...</> : <><Zap size={14} /> Genera report</>}
              </button>
              <button onClick={() => setView("list")} className="px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground">Annulla</button>
            </div>

            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Zap size={11} /> I dati verranno recuperati dalle API Meta collegate. Se non collegati, i grafici risulteranno vuoti. Il riepilogo esecutivo viene generato dall'AI.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // ── DETAIL / EDIT VIEW ──
  // ═════════════════════════════════════════════════════════════════════════════

  if (!selectedReport) {
    return (
      <Layout>
        <div className="p-8 flex items-center justify-center">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      </Layout>
    );
  }

  const r = selectedReport;
  const savedIg = r.kpiSocialJson ?? r.metricsJson?.instagram ?? null;
  const savedMeta = r.kpiMetaJson ?? r.metricsJson?.metaAds ?? null;
  const ig = liveData?.instagram ?? savedIg;
  const meta = liveData?.metaAds ?? savedMeta;
  const google = r.kpiGoogleJson ?? r.metricsJson?.googleAds ?? null;
  const topPosts = (liveData?.instagram?.topPosts) ?? r.topContenutiJson ?? ig?.topPosts ?? [];
  const featuredPosts = (liveData?.instagram?.featuredPosts) ?? ig?.featuredPosts ?? [];
  const isEditing = view === "edit";
  const canEdit = r.status === "bozza";
  const canSubmitReview = r.status === "bozza";
  const canApprove = r.status === "in_revisione";
  const canSend = r.status === "approvato";
  const canConfirmClient = r.status === "inviato";
  const isLive = !!liveData;

  const igSummary = ig?.summary ?? ig ?? {};
  const metaSummary = meta?.summary ?? meta ?? {};
  const igUsername = igSummary.username ?? "";

  const lineOptions = {
    ...CHART_DEFAULTS,
    scales: {
      y: { grid: { color: "rgba(0,0,0,0.04)" }, ticks: { font: { size: 11 } } },
      x: { grid: { display: false }, ticks: { font: { size: 11 }, maxRotation: 0, maxTicksLimit: 8 } },
    },
  };

  const barOptions = {
    ...CHART_DEFAULTS,
    plugins: { ...CHART_DEFAULTS.plugins, legend: { display: true, position: "top" as const, labels: { boxWidth: 12, padding: 16, font: { size: 11 } } } },
    scales: {
      y: { grid: { color: "rgba(0,0,0,0.04)" }, ticks: { font: { size: 11 } } },
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
    },
  };

  const dualAxisOptions = {
    ...CHART_DEFAULTS,
    plugins: { ...CHART_DEFAULTS.plugins, legend: { display: true, position: "top" as const, labels: { boxWidth: 12, padding: 16, font: { size: 11 } } } },
    scales: {
      y: { position: "left" as const, grid: { color: "rgba(0,0,0,0.04)" }, ticks: { font: { size: 11 } } },
      y1: { position: "right" as const, grid: { drawOnChartArea: false }, ticks: { font: { size: 11 } } },
      x: { grid: { display: false }, ticks: { font: { size: 11 }, maxRotation: 0, maxTicksLimit: 8 } },
    },
  };

  const hasIg = ig && (igSummary.followers || igSummary.reach || igSummary.impressions);
  const hasMeta = meta && (metaSummary.totalSpend || metaSummary.impressions || metaSummary.reach);
  const hasGoogle = google && (google.summary?.spend || google.summary?.impressions);
  const hasNoData = !hasIg && !hasMeta && !hasGoogle;
  const tocSections = [
    { id: "cover", label: "1. Copertina" },
    { id: "exec", label: "2. Riepilogo Esecutivo" },
    { id: "top-content", label: "3. Top Contenuti del Periodo" },
    { id: "calendar", label: "4. Calendario Contenuti" },
    { id: "audience", label: "5. Crescita e Audience" },
    { id: "organic", label: "6. Performance Organica" },
    { id: "meta", label: "7. Meta Ads" },
    { id: "google", label: "8. Google Ads" },
    { id: "insights", label: "9. Analisi e Insights" },
    { id: "strategy", label: "10. Strategia Prossimo Periodo" },
    { id: "notes", label: "11. Note Aggiuntive" },
  ];
  const [activeTocId, setActiveTocId] = useState<string>("cover");
  const qualitySignals = [
    Boolean(r.riepilogoEsecutivo || r.aiSummary),
    Boolean(topPosts.length > 0),
    Boolean(hasIg),
    Boolean(hasMeta),
    Boolean(hasGoogle),
    Boolean(r.analisiInsights),
    Boolean(r.strategiaProssimoPeriodo),
    Boolean(r.noteAggiuntive),
  ];
  const qualityScore = Math.round((qualitySignals.filter(Boolean).length / qualitySignals.length) * 100);

  useEffect(() => {
    const ids = tocSections.map((s) => s.id);
    const elements = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => Boolean(el));
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) {
          setActiveTocId(visible.target.id);
        }
      },
      { rootMargin: "-25% 0px -55% 0px", threshold: [0.2, 0.4, 0.7] },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [r.id, liveData, liveDateFrom, liveDateTo]);

  return (
    <Layout>
      <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => { setView("list"); setSelectedReport(null); }} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
            <ChevronLeft size={16} /> Torna ai report
          </button>
        </div>

        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between mb-6 rounded-2xl border border-card-border bg-gradient-to-br from-primary/10 via-background to-background p-5">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold tracking-tight">{r.titolo ?? "Report"}</h1>
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_COLORS[r.status])}>{STATUS_LABELS[r.status]}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {r.clientName} · {TIPO_LABELS[r.tipo]} · {r.periodLabel}
              {r.createdAt && <> · Creato il {new Date(r.createdAt).toLocaleDateString("it-IT")}</>}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[11px] px-2 py-1 rounded-md bg-primary/15 text-primary font-medium">Qualita report {qualityScore}%</span>
              {isLive ? (
                <span className="text-[11px] px-2 py-1 rounded-md bg-emerald-100 text-emerald-700 font-medium">Live data attivi</span>
              ) : (
                <span className="text-[11px] px-2 py-1 rounded-md bg-muted text-muted-foreground font-medium">Dati salvati</span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && !isEditing && (
              <button onClick={() => setView("edit")} className="flex items-center gap-1.5 px-3 py-2 bg-secondary text-secondary-foreground rounded-lg text-xs font-medium hover:opacity-90">
                <Pencil size={12} /> Modifica
              </button>
            )}
            {isEditing && (
              <>
                <button onClick={handleSaveEdits} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50">
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Salva
                </button>
                <button onClick={() => setView("detail")} className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground">Annulla</button>
              </>
            )}
            {canSubmitReview && !isEditing && (
              <button onClick={() => doAction("submit-review")} disabled={!!actionLoading}
                className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-white rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50">
                {actionLoading === "submit-review" ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Invia per approvazione
              </button>
            )}
            {canApprove && (
              <>
                <button onClick={() => doAction("approve")} disabled={!!actionLoading}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50">
                  {actionLoading === "approve" ? <Loader2 size={12} className="animate-spin" /> : <ThumbsUp size={12} />} Approva
                </button>
                <button onClick={() => setShowRejectModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-rose-500 text-white rounded-lg text-xs font-medium hover:opacity-90">
                  <ThumbsDown size={12} /> Richiedi modifiche
                </button>
              </>
            )}
            {canSend && (
              <button onClick={() => { setSendResult(null); setShowSendModal(true); }}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:opacity-90">
                <Mail size={12} /> Invia al cliente
              </button>
            )}
            {canConfirmClient && (
              <button onClick={() => doAction("confirm-client")}
                className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 text-white rounded-lg text-xs font-medium hover:opacity-90">
                <CheckCircle2 size={12} /> Confermato dal cliente
              </button>
            )}
            <button onClick={handleExportPDF} className="flex items-center gap-1.5 px-3 py-2 bg-secondary text-secondary-foreground rounded-lg text-xs font-medium hover:opacity-90">
              <Download size={12} /> PDF
            </button>
            <button onClick={() => handleDelete(r.id)} className="p-2 text-muted-foreground hover:text-destructive rounded-lg hover:bg-muted">
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Approval history */}
        {r.approvals && r.approvals.length > 0 && (
          <div className="mb-6 bg-muted/30 border border-card-border rounded-xl p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Storico revisioni</p>
            <div className="space-y-2">
              {r.approvals.map((a: any, i: number) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className={cn("mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-white text-xs",
                    a.azione === "approvato" ? "bg-emerald-500" : "bg-amber-500")}>
                    {a.azione === "approvato" ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                  </span>
                  <div className="flex-1">
                    <span className="font-medium">{a.azione === "approvato" ? "Approvato" : "Modifiche richieste"}</span>
                    {a.nota && <p className="text-xs text-muted-foreground mt-0.5">{a.nota}</p>}
                    <p className="text-[11px] text-muted-foreground">{a.createdAt ? new Date(a.createdAt).toLocaleString("it-IT") : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Flags */}
        {r.aiFlag && r.aiFlags && r.aiFlags.length > 0 && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2"><AlertTriangle size={14} /> Problemi rilevati dall'AI</p>
            <ul className="space-y-1">
              {r.aiFlags.map((f, i) => <li key={i} className="text-xs text-amber-700 flex items-start gap-1.5"><span className="mt-0.5">-</span>{f}</li>)}
            </ul>
          </div>
        )}

        {/* Date range & refresh */}
        <div className="mb-6 bg-card border border-card-border rounded-xl p-4 flex flex-wrap items-center gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Periodo dati</span>
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={liveDateFrom} onChange={(e) => setLiveDateFrom(e.target.value)}
              className="px-2.5 py-1.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
            <span className="text-xs text-muted-foreground">—</span>
            <input type="date" value={liveDateTo} onChange={(e) => setLiveDateTo(e.target.value)}
              className="px-2.5 py-1.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <button onClick={handleRefreshLive} disabled={liveLoading || !liveDateFrom || !liveDateTo}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-all">
            {liveLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            {liveLoading ? "Aggiornamento..." : "Aggiorna dati"}
          </button>
          <AiReportButton report={r} igSummary={igSummary} metaSummary={metaSummary} />
          {isLive && (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <Zap size={12} /> Dati in tempo reale
              </span>
              <button onClick={() => setLiveData(null)} className="text-xs text-muted-foreground hover:text-foreground underline">
                Ripristina salvati
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_280px] gap-4 items-start">
          <aside className="hidden lg:block sticky top-6 bg-card border border-card-border rounded-xl p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Indice report</p>
            <div className="space-y-1">
              {tocSections.map((s) => (
                <button key={s.id} onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className={cn(
                    "w-full text-left text-xs px-2 py-1.5 rounded-md transition-colors",
                    activeTocId === s.id
                      ? "bg-primary/10 text-primary font-semibold"
                      : "hover:bg-muted text-muted-foreground hover:text-foreground",
                  )}>
                  {s.label}
                </button>
              ))}
            </div>
          </aside>

          {/* Print container */}
          <div ref={printRef} className="space-y-6 bg-white">

          {/* ── COPERTINA ── */}
          <div id="cover" className="bg-gradient-to-br from-[hsl(83,28%,42%)] to-[hsl(88,28%,26%)] rounded-2xl p-8 text-white text-center print:break-after-page">
            <img src="/logo-bekind.png" alt="Be Kind" className="h-12 mx-auto mb-4 brightness-0 invert" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <h2 className="text-2xl font-bold mb-1">Be Kind Social Agency HUB</h2>
            <p className="text-white/60 text-sm mb-6">Michael Balleroni</p>
            <div className="bg-white/10 rounded-xl p-6 max-w-md mx-auto">
              <p className="text-lg font-semibold">{r.clientName}</p>
              <p className="text-white/80 text-sm mt-1">Report {TIPO_LABELS[r.tipo]}</p>
              <p className="text-white/80 text-sm">{r.periodLabel}</p>
              {liveDateFrom && liveDateTo && (
                <p className="text-white/60 text-xs mt-2">
                  {new Date(liveDateFrom).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })} — {new Date(liveDateTo).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })}
                </p>
              )}
              {r.sentAt && <p className="text-white/60 text-xs mt-3">Inviato il {new Date(r.sentAt).toLocaleDateString("it-IT")}</p>}
            </div>
          </div>

          {/* ── SEZ 1: RIEPILOGO ESECUTIVO ── */}
          <section id="exec" className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
            <h3 className="text-base font-bold mb-4 flex items-center gap-2"><FileText size={16} className="text-primary" /> Riepilogo Esecutivo</h3>
            {isEditing ? (
              <textarea value={editForm.riepilogoEsecutivo ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, riepilogoEsecutivo: e.target.value }))}
                rows={8} className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
            ) : (
              <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">
                {r.riepilogoEsecutivo || r.aiSummary || <span className="text-muted-foreground italic">Nessun riepilogo compilato</span>}
              </div>
            )}

            {/* KPI cards */}
            {!hasNoData && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
                {hasIg && (
                  <>
                    <KpiCard label="Follower" value={fmt(igSummary.followers ?? 0)} icon={Users}
                      trend={igSummary.followerGrowthPct ? { value: igSummary.followerGrowthPct } : undefined}
                      sub={igSummary.followerGrowth ? `+${fmt(igSummary.followerGrowth)}` : undefined} />
                    <KpiCard label="Reach" value={fmt(igSummary.reach ?? 0)} icon={Eye} color="indigo" />
                    <KpiCard label="Engagement" value={`${(igSummary.engagementRate ?? 0).toFixed(1)}%`} icon={Heart} color="rose" />
                  </>
                )}
                {hasMeta && (
                  <>
                    <KpiCard label="Spesa Ads" value={fmtEur(metaSummary.totalSpend ?? 0)} icon={DollarSign} color="amber" />
                    <KpiCard label="ROAS" value={`${(metaSummary.roas ?? 0).toFixed(1)}x`} icon={Target} color="violet" />
                  </>
                )}
                {hasGoogle && (
                  <KpiCard label="Google Ads" value={fmtEur(google.summary?.spend ?? 0)} icon={Globe} color="sky" />
                )}
              </div>
            )}
          </section>

          {/* No data banner */}
          {hasNoData && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
              <AlertTriangle size={24} className="text-amber-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-amber-800 mb-1">Nessun dato disponibile</p>
              <p className="text-xs text-amber-600">Collega l'account Meta e/o Google Ads dal dettaglio cliente per includere dati reali nei report.</p>
            </div>
          )}

          {/* ── SEZ 2: SOCIAL MEDIA ORGANICO ── */}
          {hasIg && (
            <section id="top-content" className="bg-card border border-card-border rounded-xl p-6 shadow-sm print:break-before-page">
              <h3 className="text-base font-bold mb-4 flex items-center gap-2"><Share2 size={16} className="text-primary" /> Social Media Organico</h3>

              {!hasIg && (
                <div className="text-center py-8">
                  <AlertTriangle size={20} className="text-amber-400 mx-auto mb-2" />
                  <p className="text-sm text-amber-700">Account Meta non collegato. I dati social non sono disponibili.</p>
                </div>
              )}

              {hasIg && (
                <div className="space-y-6">
                  {/* Follower trend */}
                  {ig.followerTrend && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Crescita follower</p>
                      <div className="h-52">
                        <Line data={{
                          labels: ig.followerTrend.labels ?? [],
                          datasets: [{ label: "Follower", data: ig.followerTrend.data ?? [], borderColor: PRIMARY, backgroundColor: PRIMARY_LIGHT, borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0 }],
                        }} options={lineOptions as any} />
                      </div>
                    </div>
                  )}

                  {/* Post engagement */}
                  {ig.postEngagement && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Engagement per contenuto</p>
                      <div className="h-52">
                        <Bar data={{
                          labels: ig.postEngagement.labels ?? [],
                          datasets: [
                            { label: "Like", data: ig.postEngagement.likes ?? [], backgroundColor: PRIMARY, borderRadius: 4 },
                            { label: "Commenti", data: ig.postEngagement.comments ?? [], backgroundColor: "#a4b87a", borderRadius: 4 },
                            { label: "Salvataggi", data: ig.postEngagement.saves ?? [], backgroundColor: "#c8d9a0", borderRadius: 4 },
                          ],
                        }} options={barOptions as any} />
                      </div>
                    </div>
                  )}

                  {/* Top posts with media cards */}
                  {topPosts.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Top contenuti</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {topPosts.slice(0, 3).map((p: any, i: number) => {
                          const imgSrc = p.mediaType === "VIDEO"
                            ? (p.thumbnailUrl ? `/api/meta/media-proxy?url=${encodeURIComponent(p.thumbnailUrl)}` : null)
                            : (p.mediaUrl ? `/api/meta/media-proxy?url=${encodeURIComponent(p.mediaUrl)}` : null);
                          const awardLabel = featuredPosts[i]?.award ?? null;
                          return (
                            <div key={i} className="bg-white border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                              <a href={p.permalink ?? "#"} target="_blank" rel="noopener noreferrer" className="block relative aspect-square bg-muted">
                                {imgSrc ? (
                                  <img src={imgSrc} alt={p.description ?? ""} className="w-full h-full object-cover"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).parentElement!.querySelector('.fallback')?.classList.remove('hidden'); }} />
                                ) : null}
                                <div className={cn("fallback absolute inset-0 flex flex-col items-center justify-center bg-muted text-muted-foreground", imgSrc ? "hidden" : "")}>
                                  <Image size={32} className="mb-2 opacity-40" />
                                  <span className="text-xs">Media non disponibile</span>
                                </div>
                                {p.mediaType === "VIDEO" && imgSrc && (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
                                      <Play size={20} className="text-white ml-0.5" fill="white" />
                                    </div>
                                  </div>
                                )}
                                {p.mediaType === "CAROUSEL_ALBUM" && (
                                  <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <Grid3X3 size={10} /> Carosello
                                  </div>
                                )}
                                {awardLabel && (
                                  <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                    {awardLabel}
                                  </div>
                                )}
                                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-8">
                                  <div className="flex items-center gap-2 text-white text-xs">
                                    <Calendar size={11} /> {p.date} <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px]">{p.type}</span>
                                  </div>
                                </div>
                              </a>
                              <div className="p-3">
                                <p className="text-sm text-foreground line-clamp-2 mb-2">{p.caption || p.description || "—"}</p>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground border-t border-border/50 pt-2">
                                  <span className="flex items-center gap-1"><Heart size={11} className="text-rose-400" /> {fmt(p.likes ?? 0)}</span>
                                  <span className="flex items-center gap-1"><Megaphone size={11} /> {fmt(p.comments ?? 0)}</span>
                                  <span className="flex items-center gap-1"><Bookmark size={11} /> {fmt(p.saves ?? 0)}</span>
                                  {p.reach > 0 && <span className="flex items-center gap-1"><Eye size={11} /> {fmt(p.reach)}</span>}
                                </div>
                                {igUsername && (
                                  <p className="text-[10px] text-muted-foreground mt-2">Via Instagram · @{igUsername}</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* ── SEZ 3: META ADS ── */}
          {hasMeta && (
            <section id="meta" className="bg-card border border-card-border rounded-xl p-6 shadow-sm print:break-before-page">
              <h3 className="text-base font-bold mb-4 flex items-center gap-2"><Megaphone size={16} className="text-primary" /> Meta Ads</h3>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
                <KpiCard label="Spesa totale" value={fmtEur(metaSummary.totalSpend ?? 0)} icon={DollarSign} color="amber" />
                <KpiCard label="Impression" value={fmt(metaSummary.impressions ?? 0)} icon={Eye} color="indigo" />
                <KpiCard label="Reach" value={fmt(metaSummary.reach ?? 0)} icon={Users} />
                <KpiCard label="CTR" value={`${(metaSummary.ctr ?? 0).toFixed(2)}%`} icon={MousePointerClick} color="sky" />
                <KpiCard label="CPC" value={`EUR ${(metaSummary.cpc ?? 0).toFixed(2)}`} icon={DollarSign} />
                {(metaSummary.linkClicks > 0) && <KpiCard label="Link Click" value={fmt(metaSummary.linkClicks)} icon={MousePointerClick} color="emerald" />}
                {(metaSummary.videoViews > 0) && <KpiCard label="Video Views" value={fmt(metaSummary.videoViews)} icon={Eye} color="rose" />}
                {(metaSummary.newFollowers > 0) && <KpiCard label="Nuovi follower (ads)" value={fmt(metaSummary.newFollowers)} icon={UserPlus} color="sky" />}
                {(metaSummary.costPerFollower > 0) && <KpiCard label="Costo per follower" value={fmtEur(metaSummary.costPerFollower)} icon={UserPlus} color="amber" />}
                {(metaSummary.roas > 0) && <KpiCard label="ROAS" value={`${metaSummary.roas.toFixed(1)}x`} icon={Target} color="violet" />}
              </div>

              {/* Spend trend */}
              {meta.spendTrend && (
                <div className="mb-6">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Spesa giornaliera</p>
                  <div className="h-52">
                    <Line data={{
                      labels: meta.spendTrend.labels ?? [],
                      datasets: [
                        { label: "Spesa (EUR)", data: meta.spendTrend.spend ?? [], borderColor: PRIMARY, backgroundColor: PRIMARY_LIGHT, borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0, yAxisID: "y" },
                        { label: "Conversioni", data: meta.spendTrend.conversions ?? [], borderColor: "#4a6741", backgroundColor: "transparent", borderWidth: 2, borderDash: [4, 3], tension: 0.4, pointRadius: 0, yAxisID: "y1" },
                      ],
                    }} options={dualAxisOptions as any} />
                  </div>
                </div>
              )}

              {/* Campaigns table */}
              {meta.campaigns && meta.campaigns.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Campagne</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          {["Campagna", "Stato", "Obiettivo"].map((h) => (
                            <th key={h} className="text-left py-2 px-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {meta.campaigns.map((c: any, i: number) => {
                          const objMap: Record<string, string> = {
                            OUTCOME_ENGAGEMENT: "Interazioni", OUTCOME_AWARENESS: "Notorieta", OUTCOME_TRAFFIC: "Traffico",
                            OUTCOME_LEADS: "Lead", OUTCOME_SALES: "Vendite", OUTCOME_APP_PROMOTION: "App",
                          };
                          return (
                            <tr key={i} className="border-b border-border/50">
                              <td className="py-2.5 px-2.5 font-medium max-w-[250px] truncate">{c.name}</td>
                              <td className="py-2.5 px-2.5"><span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", c.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500")}>{c.status === "active" ? "Attiva" : "Pausa"}</span></td>
                              <td className="py-2.5 px-2.5 text-sm text-muted-foreground">{objMap[c.objective] ?? c.objective ?? "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}

          <section id="calendar" className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
            <h3 className="text-base font-bold mb-3">Calendario Contenuti del Periodo</h3>
            <p className="text-sm text-muted-foreground">
              Pubblicazioni rilevate: {(topPosts ?? []).length}. Seleziona un contenuto per vedere l’anteprima nel dettaglio del report.
            </p>
          </section>

          <section id="audience" className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
            <h3 className="text-base font-bold mb-3">Crescita e Audience</h3>
            {hasIg ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Nuovi follower" value={fmt(igSummary.followerGrowth ?? 0)} icon={Users} />
                <KpiCard label="Reach totale" value={fmt(igSummary.reach ?? 0)} icon={Eye} color="indigo" />
                <KpiCard label="Engagement medio" value={`${(igSummary.engagementRate ?? 0).toFixed(1)}%`} icon={Heart} color="rose" />
                <KpiCard label="Visite profilo" value={fmt(igSummary.profileViews ?? 0)} icon={ArrowUpRight} color="sky" />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Connetti Instagram Business per vedere i dati demografici e di audience.</p>
            )}
          </section>

          <section id="organic" className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
            <h3 className="text-base font-bold mb-3">Performance Organica</h3>
            <p className="text-sm text-muted-foreground">
              Confronto periodo corrente/precedente disponibile quando entrambi i periodi hanno dati completi.
            </p>
          </section>

          {/* ── SEZ 4: GOOGLE ADS ── */}
          {hasGoogle ? (
            <section id="google" className="bg-card border border-card-border rounded-xl p-6 shadow-sm print:break-before-page">
              <h3 className="text-base font-bold mb-4 flex items-center gap-2"><Globe size={16} className="text-blue-500" /> Google Ads</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <KpiCard label="Spesa" value={fmtEur(google.summary?.spend ?? 0)} icon={DollarSign} color="amber" />
                <KpiCard label="Click" value={fmt(google.summary?.clicks ?? 0)} icon={MousePointerClick} color="sky" />
                <KpiCard label="Conversioni" value={fmt(google.summary?.conversions ?? 0)} icon={Target} color="violet" />
                <KpiCard label="CPC medio" value={`EUR ${(google.summary?.cpc ?? 0).toFixed(2)}`} icon={BarChart2} />
              </div>

              {google.clicksTrend && (
                <div className="mb-6">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Click e conversioni</p>
                  <div className="h-52">
                    <Line data={{
                      labels: google.clicksTrend.labels ?? [],
                      datasets: [
                        { label: "Click", data: google.clicksTrend.clicks ?? [], borderColor: "#4285f4", backgroundColor: "rgba(66,133,244,0.1)", borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0, yAxisID: "y" },
                        { label: "Conversioni", data: google.clicksTrend.conversions ?? [], borderColor: "#34a853", backgroundColor: "transparent", borderWidth: 2, borderDash: [4, 3], tension: 0.4, pointRadius: 0, yAxisID: "y1" },
                      ],
                    }} options={dualAxisOptions as any} />
                  </div>
                </div>
              )}

              {google.campaigns && google.campaigns.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Campagne Google</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          {["Campagna", "Spesa", "Impression", "Click", "CTR", "CPC", "Conv."].map((h) => (
                            <th key={h} className="text-left py-2 px-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {google.campaigns.map((c: any, i: number) => (
                          <tr key={i} className="border-b border-border/50">
                            <td className="py-2.5 px-2.5 font-medium max-w-[180px] truncate">{c.name}</td>
                            <td className="py-2.5 px-2.5 tabular-nums">{fmtEur(c.spend ?? 0)}</td>
                            <td className="py-2.5 px-2.5 tabular-nums">{fmt(c.impressions ?? 0)}</td>
                            <td className="py-2.5 px-2.5 tabular-nums">{fmt(c.clicks ?? 0)}</td>
                            <td className="py-2.5 px-2.5 tabular-nums">{(c.ctr ?? 0).toFixed(2)}%</td>
                            <td className="py-2.5 px-2.5 tabular-nums">EUR {(c.cpc ?? 0).toFixed(2)}</td>
                            <td className="py-2.5 px-2.5 tabular-nums">{c.conversions ?? 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          ) : (
            <section className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
              <h3 className="text-base font-bold mb-3 flex items-center gap-2"><Globe size={16} className="text-blue-500" /> Google Ads</h3>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                <p className="text-sm text-amber-700">Account Google Ads non collegato. I dati Google Ads non sono disponibili.</p>
              </div>
            </section>
          )}

          {/* ── SEZ 5: ANALISI E INSIGHTS ── */}
          <section id="insights" className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
            <h3 className="text-base font-bold mb-4 flex items-center gap-2"><BarChart2 size={16} className="text-primary" /> Analisi e Insights</h3>
            {isEditing ? (
              <textarea value={editForm.analisiInsights ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, analisiInsights: e.target.value }))}
                rows={6} placeholder="Cosa ha funzionato bene, cosa ha funzionato meno, motivazioni e contesto..."
                className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
            ) : (
              <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">
                {r.analisiInsights || <span className="text-muted-foreground italic">Nessuna analisi compilata</span>}
              </div>
            )}
          </section>

          {/* ── SEZ 6: STRATEGIA PROSSIMO PERIODO ── */}
          <section id="strategy" className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
            <h3 className="text-base font-bold mb-4 flex items-center gap-2"><Target size={16} className="text-primary" /> Strategia Prossimo Periodo</h3>
            {isEditing ? (
              <textarea value={editForm.strategiaProssimoPeriodo ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, strategiaProssimoPeriodo: e.target.value }))}
                rows={6} placeholder="Azioni pianificate, modifiche alla strategia, obiettivi, budget consigliato..."
                className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
            ) : (
              <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">
                {r.strategiaProssimoPeriodo || <span className="text-muted-foreground italic">Nessuna strategia compilata</span>}
              </div>
            )}
          </section>

          {/* ── SEZ 7: NOTE AGGIUNTIVE ── */}
          <section id="notes" className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
            <h3 className="text-base font-bold mb-4 flex items-center gap-2"><FileText size={16} className="text-muted-foreground" /> Note Aggiuntive</h3>
            {isEditing ? (
              <textarea value={editForm.noteAggiuntive ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, noteAggiuntive: e.target.value }))}
                rows={4} placeholder="Comunicazioni extra per il cliente..."
                className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
            ) : (
              <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">
                {r.noteAggiuntive || <span className="text-muted-foreground italic">Nessuna nota</span>}
              </div>
            )}
          </section>

          {/* PDF footer area */}
          <div className="hidden print:block text-center text-xs text-muted-foreground py-4 border-t border-border">
            Be Kind Social Agency HUB · Michael Balleroni · info@bekind.agency
          </div>
          </div>

          <aside className="hidden lg:block sticky top-6 bg-card border border-card-border rounded-xl p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Strumenti</p>
            <div className="mb-3 rounded-lg border border-primary/15 bg-primary/5 p-2.5">
              <p className="text-[11px] font-semibold text-primary mb-1">Stato report</p>
              <div className="h-1.5 rounded-full bg-primary/20 overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${qualityScore}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{qualityScore}% contenuti compilati e dati disponibili</p>
            </div>
            <div className="space-y-2">
              <button onClick={handleRefreshLive} disabled={liveLoading} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-secondary rounded-lg text-xs">
                {liveLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Refresh dati
              </button>
              <button onClick={handleExportPDF} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-secondary rounded-lg text-xs">
                <Download size={12} /> Anteprima/PDF
              </button>
              <button onClick={() => canSubmitReview && doAction("submit-review")} disabled={!canSubmitReview || !!actionLoading} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-100 text-amber-800 rounded-lg text-xs disabled:opacity-50">
                <Send size={12} /> Invia approvazione
              </button>
            </div>
          </aside>
        </div>

        {/* ── REJECT MODAL ── */}
        {showRejectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-base">Richiedi modifiche</h3>
                <button onClick={() => setShowRejectModal(false)} className="p-1 hover:bg-muted rounded-lg"><X size={16} /></button>
              </div>
              <textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)}
                rows={4} placeholder="Nota per il team: cosa modificare..."
                className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none mb-4" />
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowRejectModal(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Annulla</button>
                <button onClick={async () => { await doAction("reject", { nota: rejectNote }); setShowRejectModal(false); setRejectNote(""); }}
                  disabled={!!actionLoading}
                  className="px-4 py-2 bg-rose-500 text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                  {actionLoading ? <Loader2 size={14} className="animate-spin" /> : "Invia richiesta"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── SEND MODAL ── */}
        {showSendModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-base">Invia report al cliente</h3>
                <button onClick={() => setShowSendModal(false)} className="p-1 hover:bg-muted rounded-lg"><X size={16} /></button>
              </div>

              {sendResult ? (
                <div>
                  {sendResult.sent ? (
                    <div className="text-center py-6">
                      <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-3" />
                      <p className="font-semibold text-lg">Report inviato</p>
                      <p className="text-sm text-muted-foreground mt-1">Email inviata a {sendResult.to}</p>
                    </div>
                  ) : sendResult.previewHtml ? (
                    <div>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                        <p className="text-sm text-amber-700">{sendResult.error}</p>
                      </div>
                      <button onClick={() => {
                        const w = window.open("", "_blank");
                        if (w) { w.document.write(sendResult.previewHtml); w.document.close(); }
                      }} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90">
                        <Eye size={14} /> Visualizza anteprima email
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-rose-600 text-sm">{sendResult.error ?? "Errore sconosciuto"}</div>
                  )}
                  <div className="mt-4 flex justify-end">
                    <button onClick={() => { setShowSendModal(false); setSendResult(null); }} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Chiudi</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground block mb-1">Destinatario</label>
                      <input type="email" value={sendEmail} onChange={(e) => setSendEmail(e.target.value)}
                        className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground block mb-1">Oggetto</label>
                      <input type="text" value={r.subject ?? ""} disabled
                        className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-muted text-muted-foreground" />
                    </div>
                    <div className="bg-muted/50 rounded-xl p-4 text-sm text-muted-foreground">
                      <p>L'email conterr il riepilogo del report con KPI e analisi. Il team Be Kind verr indicato come mittente.</p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowSendModal(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Annulla</button>
                    <button onClick={handleSend} disabled={!!actionLoading || !sendEmail}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                      {actionLoading === "send" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Invia email
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
