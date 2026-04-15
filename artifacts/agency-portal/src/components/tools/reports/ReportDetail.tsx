import { Bar, Line } from "react-chartjs-2";
import type { ChartOptions } from "chart.js";
import {
  AlertTriangle,
  BarChart2,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  DollarSign,
  Download,
  Eye,
  FileText,
  Globe,
  Grid3X3,
  Heart,
  Image,
  Loader2,
  Mail,
  Megaphone,
  MousePointerClick,
  Pencil,
  Play,
  RefreshCw,
  Save,
  Send,
  Share2,
  Target,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Users,
  X,
  Zap,
  ArrowUpRight,
  Bookmark,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { cn } from "@/lib/utils";
import type { ReportDetailState } from "@/types/client";

type ReportView = "list" | "create" | "detail" | "edit";

type ReportTocItem = {
  id: string;
  label: string;
};

type ReportEditForm = Partial<ReportDetailState> & {
  recipientEmail?: string;
  subject?: string;
};

type SetReportEditForm = (updater: (form: ReportEditForm) => ReportEditForm) => void;

type SendResult = {
  sent?: boolean;
  to?: string;
  previewHtml?: string;
  error?: string;
} | null;

type IgSummary = {
  followers?: number;
  followerGrowth?: number;
  followerGrowthPct?: number;
  reach?: number;
  engagementRate?: number;
};

type MetaSummary = {
  totalSpend?: number;
  roas?: number;
  impressions?: number;
  reach?: number;
  ctr?: number;
  cpc?: number;
};

type TopPost = {
  mediaType?: string;
  thumbnailUrl?: string;
  mediaUrl?: string;
  permalink?: string;
  description?: string;
  date?: string;
  type?: string;
  caption?: string;
  likes?: number;
  comments?: number;
  saves?: number;
  reach?: number;
};

type FeaturedPost = {
  award?: string;
};

interface ReportDetailViewModel {
  selectedReport: ReportDetailState;
  setView: (view: ReportView) => void;
  setSelectedReport: (report: ReportDetailState | null) => void;
  view: ReportView;
  STATUS_COLORS: Record<string, string>;
  STATUS_LABELS: Record<string, string>;
  TIPO_LABELS: Record<string, string>;
  qualityScore: number;
  isLive: boolean;
  canEdit: boolean;
  isEditing: boolean;
  handleSaveEdits: () => void;
  saving: boolean;
  canSubmitReview: boolean;
  doAction: (action: string, body?: Record<string, unknown>) => Promise<unknown>;
  actionLoading: string;
  canApprove: boolean;
  setShowRejectModal: (open: boolean) => void;
  canSend: boolean;
  setSendResult: (result: SendResult) => void;
  setShowSendModal: (open: boolean) => void;
  canConfirmClient: boolean;
  handleExportPDF: () => void;
  handleDelete: (id: number) => void;
  handleRefreshLive: () => void;
  liveLoading: boolean;
  liveDateFrom: string;
  setLiveDateFrom: (value: string) => void;
  liveDateTo: string;
  setLiveDateTo: (value: string) => void;
  AiReportButton: React.ComponentType<{ report: ReportDetailState; igSummary: IgSummary; metaSummary: MetaSummary }>;
  igSummary: IgSummary;
  metaSummary: MetaSummary;
  REPORT_TOC: ReadonlyArray<ReportTocItem>;
  activeTocId: string;
  printRef: React.RefObject<HTMLDivElement | null>;
  editForm: ReportEditForm;
  setEditForm: SetReportEditForm;
  hasNoData: boolean;
  hasIg: boolean;
  hasMeta: boolean;
  hasGoogle: boolean;
  KpiCard: React.ComponentType<{
    label: string;
    value: string | number;
    sub?: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    trend?: { value: number; positive?: boolean };
    color?: string;
  }>;
  fmt: (n: number, prefix?: string) => string;
  fmtEur: (n: number) => string;
  ig: {
    followerTrend?: { labels?: string[]; data?: number[] };
    postEngagement?: { labels?: string[]; likes?: number[]; comments?: number[]; saves?: number[] };
  };
  meta: {
    spendTrend?: { labels?: string[]; spend?: number[]; conversions?: number[] };
  };
  google: {
    summary?: { spend?: number };
  };
  topPosts: TopPost[];
  featuredPosts: FeaturedPost[];
  igUsername: string;
  lineOptions: ChartOptions<"line">;
  barOptions: ChartOptions<"bar">;
  dualAxisOptions: ChartOptions<"line">;
  showRejectModal: boolean;
  rejectNote: string;
  setRejectNote: (value: string) => void;
  showSendModal: boolean;
  sendResult: SendResult;
  sendEmail: string;
  setSendEmail: (value: string) => void;
  handleSend: () => void;
  setShowSendModalState: (open: boolean) => void;
  setSendResultState: (result: SendResult) => void;
  setLiveData: (data: unknown | null) => void;
}

export function ReportDetail({ state }: { state: ReportDetailViewModel | { selectedReport: null } }) {
  if (!state.selectedReport) {
    return (
      <Layout>
        <div className="p-8 flex items-center justify-center">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      </Layout>
    );
  }

  const {
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
    setShowSendModalState,
    setSendResultState,
  } = state;

  const r = selectedReport;

  return (
    <Layout>
      <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
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

        {r.approvals && r.approvals.length > 0 && (
          <div className="mb-6 bg-muted/30 border border-card-border rounded-xl p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Storico revisioni</p>
            <div className="space-y-2">
              {r.approvals.map((a, i: number) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className={cn("mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-white text-xs", a.azione === "approvato" ? "bg-emerald-500" : "bg-amber-500")}>
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

        {r.aiFlag && r.aiFlags && r.aiFlags.length > 0 && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2"><AlertTriangle size={14} /> Problemi rilevati dall'AI</p>
            <ul className="space-y-1">
              {r.aiFlags.map((f, i: number) => <li key={i} className="text-xs text-amber-700 flex items-start gap-1.5"><span className="mt-0.5">-</span>{f}</li>)}
            </ul>
          </div>
        )}

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
              <button onClick={() => state.setLiveData(null)} className="text-xs text-muted-foreground hover:text-foreground underline">
                Ripristina salvati
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_280px] gap-4 items-start">
          <aside className="hidden lg:block sticky top-6 bg-card border border-card-border rounded-xl p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Indice report</p>
            <div className="space-y-1">
              {REPORT_TOC.map((s) => (
                <button key={s.id} onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className={cn("w-full text-left text-xs px-2 py-1.5 rounded-md transition-colors", activeTocId === s.id ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted text-muted-foreground hover:text-foreground")}>
                  {s.label}
                </button>
              ))}
            </div>
          </aside>

          <div ref={printRef} className="space-y-6 bg-white">
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

            <section id="exec" className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
              <h3 className="text-base font-bold mb-4 flex items-center gap-2"><FileText size={16} className="text-primary" /> Riepilogo Esecutivo</h3>
              {isEditing ? (
                <textarea value={editForm.riepilogoEsecutivo ?? ""} onChange={(e) => setEditForm((form) => ({ ...form, riepilogoEsecutivo: e.target.value }))}
                  rows={8} className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
              ) : (
                <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">
                  {r.riepilogoEsecutivo || r.aiSummary || <span className="text-muted-foreground italic">Nessun riepilogo compilato</span>}
                </div>
              )}
              {!hasNoData && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
                  {hasIg && (
                    <>
                      <KpiCard label="Follower" value={fmt(igSummary.followers ?? 0)} icon={Users} trend={igSummary.followerGrowthPct ? { value: igSummary.followerGrowthPct } : undefined} sub={igSummary.followerGrowth ? `+${fmt(igSummary.followerGrowth)}` : undefined} />
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
                  {hasGoogle && <KpiCard label="Google Ads" value={fmtEur(google.summary?.spend ?? 0)} icon={Globe} color="sky" />}
                </div>
              )}
            </section>

            {hasNoData && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
                <AlertTriangle size={24} className="text-amber-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-amber-800 mb-1">Nessun dato disponibile</p>
                <p className="text-xs text-amber-600">Collega l'account Meta e/o Google Ads dal dettaglio cliente per includere dati reali nei report.</p>
              </div>
            )}

            {hasIg && (
              <section id="top-content" className="bg-card border border-card-border rounded-xl p-6 shadow-sm print:break-before-page">
                <h3 className="text-base font-bold mb-4 flex items-center gap-2"><Share2 size={16} className="text-primary" /> Social Media Organico</h3>
                <div className="space-y-6">
                  {ig.followerTrend && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Crescita follower</p>
                      <div className="h-52">
                        <Line data={{ labels: ig.followerTrend.labels ?? [], datasets: [{ label: "Follower", data: ig.followerTrend.data ?? [], borderColor: "#7a8f5c", backgroundColor: "rgba(122,143,92,0.12)", borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0 }] }} options={lineOptions} />
                      </div>
                    </div>
                  )}
                  {ig.postEngagement && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Engagement per contenuto</p>
                      <div className="h-52">
                        <Bar data={{ labels: ig.postEngagement.labels ?? [], datasets: [{ label: "Like", data: ig.postEngagement.likes ?? [], backgroundColor: "#7a8f5c", borderRadius: 4 }, { label: "Commenti", data: ig.postEngagement.comments ?? [], backgroundColor: "#a4b87a", borderRadius: 4 }, { label: "Salvataggi", data: ig.postEngagement.saves ?? [], backgroundColor: "#c8d9a0", borderRadius: 4 }] }} options={barOptions} />
                      </div>
                    </div>
                  )}
                  {topPosts.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Top contenuti</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {topPosts.slice(0, 3).map((p, i: number) => {
                          const imgSrc = p.mediaType === "VIDEO" ? (p.thumbnailUrl ? `/api/meta/media-proxy?url=${encodeURIComponent(p.thumbnailUrl)}` : null) : (p.mediaUrl ? `/api/meta/media-proxy?url=${encodeURIComponent(p.mediaUrl)}` : null);
                          const awardLabel = featuredPosts[i]?.award ?? null;
                          return (
                            <div key={i} className="bg-white border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                              <a href={p.permalink ?? "#"} target="_blank" rel="noopener noreferrer" className="block relative aspect-square bg-muted">
                                {imgSrc ? <img src={imgSrc} alt={p.description ?? ""} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).parentElement!.querySelector(".fallback")?.classList.remove("hidden"); }} /> : null}
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
                                {awardLabel && <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] font-semibold px-2 py-0.5 rounded-full">{awardLabel}</div>}
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
                                  {p.reach != null && p.reach > 0 && <span className="flex items-center gap-1"><Eye size={11} /> {fmt(p.reach)}</span>}
                                </div>
                                {igUsername && <p className="text-[10px] text-muted-foreground mt-2">Via Instagram · @{igUsername}</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {hasMeta && (
              <section id="meta" className="bg-card border border-card-border rounded-xl p-6 shadow-sm print:break-before-page">
                <h3 className="text-base font-bold mb-4 flex items-center gap-2"><Megaphone size={16} className="text-primary" /> Meta Ads</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
                  <KpiCard label="Spesa totale" value={fmtEur(metaSummary.totalSpend ?? 0)} icon={DollarSign} color="amber" />
                  <KpiCard label="Impression" value={fmt(metaSummary.impressions ?? 0)} icon={Eye} color="indigo" />
                  <KpiCard label="Reach" value={fmt(metaSummary.reach ?? 0)} icon={Users} />
                  <KpiCard label="CTR" value={`${(metaSummary.ctr ?? 0).toFixed(2)}%`} icon={MousePointerClick} color="sky" />
                  <KpiCard label="CPC" value={`EUR ${(metaSummary.cpc ?? 0).toFixed(2)}`} icon={DollarSign} />
                </div>
                {meta.spendTrend && (
                  <div className="mb-6">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Spesa giornaliera</p>
                    <div className="h-52">
                      <Line data={{ labels: meta.spendTrend.labels ?? [], datasets: [{ label: "Spesa (EUR)", data: meta.spendTrend.spend ?? [], borderColor: "#7a8f5c", backgroundColor: "rgba(122,143,92,0.12)", borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0, yAxisID: "y" }, { label: "Conversioni", data: meta.spendTrend.conversions ?? [], borderColor: "#4a6741", backgroundColor: "transparent", borderWidth: 2, borderDash: [4, 3], tension: 0.4, pointRadius: 0, yAxisID: "y1" }] }} options={dualAxisOptions} />
                    </div>
                  </div>
                )}
              </section>
            )}

            <section id="insights" className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
              <h3 className="text-base font-bold mb-4 flex items-center gap-2"><BarChart2 size={16} className="text-primary" /> Analisi e Insights</h3>
              {isEditing ? (
                <textarea value={editForm.analisiInsights ?? ""} onChange={(e) => setEditForm((form) => ({ ...form, analisiInsights: e.target.value }))} rows={6} placeholder="Cosa ha funzionato bene, cosa ha funzionato meno, motivazioni e contesto..." className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
              ) : (
                <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">{r.analisiInsights || <span className="text-muted-foreground italic">Nessuna analisi compilata</span>}</div>
              )}
            </section>

            <section id="strategy" className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
              <h3 className="text-base font-bold mb-4 flex items-center gap-2"><Target size={16} className="text-primary" /> Strategia Prossimo Periodo</h3>
              {isEditing ? (
                <textarea value={editForm.strategiaProssimoPeriodo ?? ""} onChange={(e) => setEditForm((form) => ({ ...form, strategiaProssimoPeriodo: e.target.value }))} rows={6} placeholder="Azioni pianificate, modifiche alla strategia, obiettivi, budget consigliato..." className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
              ) : (
                <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">{r.strategiaProssimoPeriodo || <span className="text-muted-foreground italic">Nessuna strategia compilata</span>}</div>
              )}
            </section>

            <section id="notes" className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
              <h3 className="text-base font-bold mb-4 flex items-center gap-2"><FileText size={16} className="text-muted-foreground" /> Note Aggiuntive</h3>
              {isEditing ? (
                <textarea value={editForm.noteAggiuntive ?? ""} onChange={(e) => setEditForm((form) => ({ ...form, noteAggiuntive: e.target.value }))} rows={4} placeholder="Comunicazioni extra per il cliente..." className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
              ) : (
                <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">{r.noteAggiuntive || <span className="text-muted-foreground italic">Nessuna nota</span>}</div>
              )}
            </section>
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

        {showRejectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-base">Richiedi modifiche</h3>
                <button onClick={() => setShowRejectModal(false)} className="p-1 hover:bg-muted rounded-lg"><X size={16} /></button>
              </div>
              <textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} rows={4} placeholder="Nota per il team: cosa modificare..." className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none mb-4" />
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowRejectModal(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Annulla</button>
                <button onClick={async () => { await doAction("reject", { nota: rejectNote }); setShowRejectModal(false); setRejectNote(""); }} disabled={!!actionLoading} className="px-4 py-2 bg-rose-500 text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                  {actionLoading ? <Loader2 size={14} className="animate-spin" /> : "Invia richiesta"}
                </button>
              </div>
            </div>
          </div>
        )}

        {showSendModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-base">Invia report al cliente</h3>
                <button onClick={() => setShowSendModalState(false)} className="p-1 hover:bg-muted rounded-lg"><X size={16} /></button>
              </div>
              {sendResult ? (
                <div>
                  {sendResult.sent ? (
                    <div className="text-center py-6">
                      <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-3" />
                      <p className="font-semibold text-lg">Report inviato</p>
                      <p className="text-sm text-muted-foreground mt-1">Email inviata a {sendResult.to ?? "destinatario"}</p>
                    </div>
                  ) : sendResult.previewHtml ? (
                    <div>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                        <p className="text-sm text-amber-700">{sendResult.error}</p>
                      </div>
                      <button onClick={() => {
                        const w = window.open("", "_blank");
                        if (w) { w.document.write(sendResult.previewHtml ?? ""); w.document.close(); }
                      }} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90">
                        <Eye size={14} /> Visualizza anteprima email
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-rose-600 text-sm">{sendResult.error ?? "Errore sconosciuto"}</div>
                  )}
                  <div className="mt-4 flex justify-end">
                    <button onClick={() => { setShowSendModalState(false); setSendResultState(null); }} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Chiudi</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground block mb-1">Destinatario</label>
                      <input type="email" value={sendEmail} onChange={(e) => setSendEmail(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground block mb-1">Oggetto</label>
                      <input type="text" value={r.subject ?? ""} disabled className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-muted text-muted-foreground" />
                    </div>
                    <div className="bg-muted/50 rounded-xl p-4 text-sm text-muted-foreground">
                      <p>L'email conterr il riepilogo del report con KPI e analisi. Il team Be Kind verr indicato come mittente.</p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowSendModalState(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Annulla</button>
                    <button onClick={handleSend} disabled={!!actionLoading || !sendEmail} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
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
