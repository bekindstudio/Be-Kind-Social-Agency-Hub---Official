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
import { useAiChat } from "@/components/ai-chat/AiChatContext";
import { ReportList } from "@/components/tools/reports/ReportList";
import { ReportCreate } from "@/components/tools/reports/ReportCreate";
import { ReportDetail } from "@/components/tools/reports/ReportDetail";
import { useReports } from "@/hooks/useReports";

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

const REPORT_TOC = [
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
] as const;

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
  const { clientList, activeBackendClientId } = useReports();

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
  const [selectedReportIds, setSelectedReportIds] = useState<number[]>([]);

  useEffect(() => {
    const numericId = Number(activeBackendClientId);
    if (!Number.isFinite(numericId)) return;
    setFilterClient(numericId);
    setCreateForm((prev) => ({
      ...prev,
      clientId: prev.clientId || String(numericId),
    }));
  }, [activeBackendClientId]);

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
  const [activeTocId, setActiveTocId] = useState<string>("cover");

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

  const handleBulkDelete = async () => {
    if (selectedReportIds.length === 0) return;
    const ok = confirm(`Eliminare ${selectedReportIds.length} report selezionati?`);
    if (!ok) return;
    await Promise.all(
      selectedReportIds.map((id) =>
        portalFetch(`/api/reports/${id}`, { method: "DELETE" }).catch(() => null),
      ),
    );
    setSelectedReportIds([]);
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

  useEffect(() => {
    if (view !== "detail" || !selectedReport) return;
    const ids = REPORT_TOC.map((s) => s.id);
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
  }, [view, selectedReport?.id, liveData, liveDateFrom, liveDateTo]);

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
  const authors = Array.from(
    new Set(
      filteredReports
        .map((r) => r.createdBy)
        .filter((author): author is string => typeof author === "string" && author.length > 0),
    ),
  );
  const allFilteredIds = filteredReports.map((r) => r.id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedReportIds.includes(id));

  // ═════════════════════════════════════════════════════════════════════════════
  // ── LIST VIEW ──
  // ═════════════════════════════════════════════════════════════════════════════

  if (view === "list") {
    return (
      <Layout>
        <ReportList
          activeBackendClientId={activeBackendClientId}
          defaultMonth={defaultMonth}
          filteredReports={filteredReports}
          pendingApproval={pendingApproval}
          pendingSend={pendingSend}
          drafts={drafts}
          reportsSentThisMonth={reportsSentThisMonth}
          loading={loading}
          selectedReportIds={selectedReportIds}
          setSelectedReportIds={setSelectedReportIds}
          allSelected={allSelected}
          allFilteredIds={allFilteredIds}
          searchText={searchText}
          setSearchText={setSearchText}
          filterClient={filterClient}
          setFilterClient={setFilterClient}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          filterTipo={filterTipo}
          setFilterTipo={setFilterTipo}
          filterAuthor={filterAuthor}
          setFilterAuthor={setFilterAuthor}
          filterFrom={filterFrom}
          setFilterFrom={setFilterFrom}
          filterTo={filterTo}
          setFilterTo={setFilterTo}
          clientList={clientList}
          authors={authors}
          TIPO_LABELS={TIPO_LABELS}
          STATUS_LABELS={STATUS_LABELS}
          STATUS_COLORS={STATUS_COLORS}
          openReport={openReport}
          handleDelete={handleDelete}
          handleBulkDelete={handleBulkDelete}
          onCreateNew={({ defaultClientId, defaultMonth: month }) => {
            setView("create");
            setCreateForm({
              clientId: defaultClientId,
              tipo: "mensile",
              period: month,
              customFrom: "",
              customTo: "",
              title: "",
              riepilogoEsecutivo: "",
              analisiInsights: "",
              strategiaProssimoPeriodo: "",
              noteAggiuntive: "",
            });
            setCreateError("");
          }}
        />
      </Layout>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // ── CREATE VIEW ──
  // ═════════════════════════════════════════════════════════════════════════════

  if (view === "create") {
    return (
      <ReportCreate
        state={{
          view,
          clientList,
          createForm,
          setCreateForm,
          defaultMonth,
          defaultQuarter,
          now,
          TIPO_LABELS,
          getPeriodLabel,
          creating,
          createError,
          handleCreate,
          setView,
        }}
      />
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // ── DETAIL / EDIT VIEW ──
  // ═════════════════════════════════════════════════════════════════════════════

  if (!selectedReport) {
    return <ReportDetail state={{ selectedReport: null }} />;
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

  return (
    <ReportDetail
      state={{
        selectedReport,
        setView,
        setSelectedReport,
        view,
        STATUS_COLORS,
        STATUS_LABELS,
        TIPO_LABELS,
        qualityScore,
        isLive,
        canEdit,
        isEditing,
        handleSaveEdits,
        saving,
        canSubmitReview,
        doAction,
        actionLoading,
        canApprove,
        setShowRejectModal,
        canSend,
        setSendResult,
        setShowSendModal,
        canConfirmClient,
        handleExportPDF,
        handleDelete,
        handleRefreshLive,
        liveLoading,
        liveDateFrom,
        setLiveDateFrom,
        liveDateTo,
        setLiveDateTo,
        AiReportButton,
        igSummary,
        metaSummary,
        REPORT_TOC,
        activeTocId,
        printRef,
        editForm,
        setEditForm,
        hasNoData,
        hasIg,
        hasMeta,
        hasGoogle,
        KpiCard,
        fmt,
        fmtEur,
        ig,
        meta,
        google,
        topPosts,
        featuredPosts,
        igUsername,
        lineOptions,
        barOptions,
        dualAxisOptions,
        showRejectModal,
        rejectNote,
        setRejectNote,
        showSendModal,
        sendResult,
        sendEmail,
        setSendEmail,
        handleSend,
        setShowSendModalState: setShowSendModal,
        setSendResultState: setSendResult,
        setLiveData,
      }}
    />
  );
}
