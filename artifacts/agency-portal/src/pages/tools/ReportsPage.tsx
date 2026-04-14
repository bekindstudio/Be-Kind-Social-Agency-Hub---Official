import { useEffect, useMemo, useRef, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { ReportPreview, type ReportSectionFlags } from "@/components/tools/reports/ReportPreview";
import { exportReportPdf } from "@/components/tools/reports/PdfExporter";
import { ReportHistory, type SavedReport } from "@/components/tools/reports/ReportHistory";
import { useClientContext } from "@/context/ClientContext";
import { useMetaAnalytics } from "@/hooks/useMetaAnalytics";
import { useToast } from "@/hooks/use-toast";
import { MetaConnectionBanner } from "@/components/shared/MetaConnectionBanner";
import { portalFetch } from "@workspace/api-client-react";
import type { ClientAnalytics } from "@/types/client";

function monthLabel(value: string): string {
  const [year, month] = value.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
}

function storageKey(clientId: string): string {
  return `agency_hub_reports_${clientId}`;
}

export default function ReportsPage() {
  const { activeClient, analytics, posts } = useClientContext();
  const { toast } = useToast();
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [introMessage, setIntroMessage] = useState("Nel periodo analizzato abbiamo mantenuto una traiettoria positiva sui KPI principali.");
  const [nextGoals, setNextGoals] = useState("Aumentare la frequenza contenuti video e consolidare i formati best performer.");
  const [strategicNotes, setStrategicNotes] = useState("Testare 2 nuove rubriche editoriali e un boost paid per i top post.");
  const [includeCompetitors, setIncludeCompetitors] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportAnalytics, setReportAnalytics] = useState<ClientAnalytics | null>(null);
  const [history, setHistory] = useState<SavedReport[]>(() => {
    if (!activeClient?.id) return [];
    try {
      const raw = localStorage.getItem(storageKey(activeClient.id));
      return raw ? (JSON.parse(raw) as SavedReport[]) : [];
    } catch {
      return [];
    }
  });

  const [sections, setSections] = useState<ReportSectionFlags>({
    overview: true,
    followerTrend: true,
    topPosts: true,
    performance: true,
    nextPlan: true,
    strategicNotes: true,
  });

  const meta = useMetaAnalytics(activeClient?.id ?? "", "30d");
  useEffect(() => {
    setReportAnalytics(null);
  }, [activeClient?.id, month]);
  const effectiveAnalytics = useMemo(() => {
    if (!analytics) return null;
    if (!meta.data?.daily?.length && !meta.posts.length) return analytics;
    return {
      ...analytics,
      dailyData: meta.data?.daily?.map((item) => ({
        date: item.date,
        followers: item.followerCount,
        reach: item.reach,
        impressions: item.impressions,
        engagement: item.engagement ?? 0,
      })) ?? analytics.dailyData,
      topPosts: (meta.posts.length
        ? meta.posts.map((post) => ({
            id: post.id,
            caption: post.caption,
            mediaType: post.mediaType,
            timestamp: post.timestamp,
            likeCount: post.likeCount,
            commentsCount: post.commentsCount,
            reach: post.reach,
            engagementRate: post.engagementRate,
            thumbnailUrl: post.thumbnailUrl,
          }))
        : analytics.topPosts),
    };
  }, [analytics, meta.data?.daily, meta.posts]);

  const selectedAnalytics = reportAnalytics ?? effectiveAnalytics;

  const nextMonthPosts = useMemo(
    () =>
      posts.filter((post) => {
        const scheduled = new Date(post.scheduledDate);
        const selected = new Date(`${month}-01`);
        const nextMonth = new Date(selected.getFullYear(), selected.getMonth() + 1, 1);
        return scheduled.getMonth() === nextMonth.getMonth() && scheduled.getFullYear() === nextMonth.getFullYear();
      }),
    [posts, month],
  );

  const previewModel = useMemo(
    () => ({
      clientName: activeClient?.name ?? "Cliente",
      periodLabel: monthLabel(month),
      generatedAt: new Date().toISOString(),
      introMessage,
      nextMonthGoals: nextGoals,
      strategicNotes,
      includeCompetitors,
      sections,
      analytics: selectedAnalytics,
      scheduledPosts: nextMonthPosts,
    }),
    [activeClient?.name, month, introMessage, nextGoals, strategicNotes, includeCompetitors, sections, selectedAnalytics, nextMonthPosts],
  );

  const selectedClientNumericId = useMemo(() => {
    const raw = Number(activeClient?.id);
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  }, [activeClient?.id]);

  const selectedMonthRange = useMemo(() => {
    const [year, monthNum] = month.split("-").map(Number);
    const start = new Date(year, (monthNum ?? 1) - 1, 1);
    const end = new Date(year, monthNum ?? 1, 0);
    return {
      since: start.toISOString().slice(0, 10),
      until: end.toISOString().slice(0, 10),
    };
  }, [month]);

  const buildFallbackMetrics = () => ({
    mock: true,
    instagram: {
      summary: {
        followers: effectiveAnalytics?.followers ?? 0,
        followerGrowth: effectiveAnalytics?.followersGrowth ?? 0,
        reach: effectiveAnalytics?.reach ?? 0,
        impressions: effectiveAnalytics?.impressions ?? 0,
        engagementRate: effectiveAnalytics?.engagementRate ?? 0,
        profileViews: effectiveAnalytics?.profileViews ?? 0,
      },
      topPosts: (effectiveAnalytics?.topPosts ?? []).map((post) => ({
        id: post.id,
        caption: post.caption,
        mediaType: post.mediaType,
        timestamp: post.timestamp,
        likes: post.likeCount,
        comments: post.commentsCount,
        reach: post.reach,
        impressions: 0,
        engagementRate: post.engagementRate,
      })),
    },
    metaAds: null,
  });

  const mapPayloadToAnalytics = (payload: any): ClientAnalytics | null => {
    const ig = payload?.instagram;
    if (!ig?.summary) return null;
    const summary = ig.summary;
    const labels: string[] = Array.isArray(ig.followerTrend?.labels) ? ig.followerTrend.labels : [];
    const data: number[] = Array.isArray(ig.followerTrend?.data) ? ig.followerTrend.data : [];
    const reachTotal = Number(summary.reach ?? 0);
    const impressionsTotal = Number(summary.impressions ?? 0);
    const dailyData = labels.map((label, index) => ({
      date: label,
      followers: Number(data[index] ?? summary.followers ?? 0),
      reach: Math.round(reachTotal / Math.max(1, labels.length || 1)),
      impressions: Math.round(impressionsTotal / Math.max(1, labels.length || 1)),
      engagement: Number(summary.engagementRate ?? 0),
    }));
    const topPosts = (ig.topPosts ?? []).map((post: any, index: number) => ({
      id: String(post.id ?? `report-post-${index}`),
      caption: String(post.caption ?? post.description ?? ""),
      mediaType: String(post.mediaType ?? post.type ?? "IMAGE"),
      timestamp: String(post.timestamp ?? post.date ?? new Date().toISOString()),
      likeCount: Number(post.likeCount ?? post.likes ?? 0),
      commentsCount: Number(post.commentsCount ?? post.comments ?? 0),
      reach: Number(post.reach ?? 0),
      engagementRate: Number(post.engagementRate ?? post.engagement ?? 0),
      thumbnailUrl: post.thumbnailUrl,
    }));
    return {
      clientId: activeClient?.id ?? "",
      period: "report",
      followers: Number(summary.followers ?? 0),
      followersPrevious: Math.max(0, Number(summary.followers ?? 0) - Number(summary.followerGrowth ?? 0)),
      followersGrowth: Number(summary.followerGrowthPct ?? 0),
      reach: reachTotal,
      reachPrevious: 0,
      impressions: impressionsTotal,
      engagementRate: Number(summary.engagementRate ?? 0),
      engagementRatePrevious: 0,
      postsPublished: topPosts.length,
      profileViews: Number(summary.profileViews ?? 0),
      dailyData,
      topPosts,
      updatedAt: new Date().toISOString(),
    };
  };

  const syncAndFetchReportMetrics = async () => {
    if (!selectedClientNumericId) return null;
    const qs = new URLSearchParams({
      range: "30d",
      since: selectedMonthRange.since,
      until: selectedMonthRange.until,
      sync: "true",
    });
    await portalFetch(`/api/meta/sync/${selectedClientNumericId}?since=${selectedMonthRange.since}&until=${selectedMonthRange.until}`, {
      method: "POST",
      credentials: "include",
    }).catch(() => null);
    const res = await portalFetch(`/api/meta/insights/${selectedClientNumericId}?${qs.toString()}`, {
      credentials: "include",
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(payload?.error ?? "Errore caricamento metriche Meta");
    }
    const mapped = mapPayloadToAnalytics(payload);
    if (mapped) setReportAnalytics(mapped);
    return payload;
  };

  const persistHistory = (records: SavedReport[]) => {
    if (!activeClient?.id) return;
    localStorage.setItem(storageKey(activeClient.id), JSON.stringify(records));
    setHistory(records);
  };

  const saveHistoryEntry = () => {
    if (!activeClient?.id) return;
    const entry: SavedReport = {
      id: crypto.randomUUID(),
      clientId: activeClient.id,
      period: monthLabel(month),
      generatedAt: new Date().toISOString(),
      sections: Object.entries(sections)
        .filter(([, enabled]) => enabled)
        .map(([name]) => name),
      notes: strategicNotes,
    };
    persistHistory([entry, ...history].slice(0, 20));
  };

  const handleGeneratePreview = async () => {
    if (!activeClient) return;
    setIsGeneratingReport(true);
    try {
      await syncAndFetchReportMetrics();
      saveHistoryEntry();
      toast({ title: "Anteprima aggiornata", description: "Dati aggiornati dal token Meta collegato." });
    } catch (err: any) {
      saveHistoryEntry();
      toast({
        title: "Anteprima salvata",
        description: err?.message ?? "Aggiornamento Meta non disponibile: uso dati locali.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleExport = async () => {
    if (!previewRef.current || !activeClient) return;
    setIsExporting(true);
    try {
      const serverMetrics = (await syncAndFetchReportMetrics().catch(() => null)) ?? buildFallbackMetrics();
      if (selectedClientNumericId) {
        await portalFetch("/api/reports", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: selectedClientNumericId,
            tipo: "mensile",
            period: month,
            periodLabel: monthLabel(month),
            periodoInizio: selectedMonthRange.since,
            periodoFine: selectedMonthRange.until,
            metrics: serverMetrics,
            isRealData: !serverMetrics?.mock,
            riepilogoEsecutivo: introMessage,
            strategiaProssimoPeriodo: nextGoals,
            noteAggiuntive: strategicNotes,
          }),
        });
      }
      await exportReportPdf(previewRef.current, `report-${activeClient.name}-${month}.pdf`);
      saveHistoryEntry();
      toast({ title: "Report scaricato", description: "Esportazione PDF completata con successo." });
    } catch {
      toast({ title: "Errore export PDF", description: "Non sono riuscito a esportare il report." });
    } finally {
      setIsExporting(false);
    }
  };

  const regenerate = (saved: SavedReport) => {
    const date = new Date(saved.generatedAt);
    setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
    setStrategicNotes(saved.notes);
    setSections((prev) => {
      const next: ReportSectionFlags = { ...prev };
      (Object.keys(next) as Array<keyof ReportSectionFlags>).forEach((key) => {
        next[key] = saved.sections.includes(key);
      });
      return next;
    });
    toast({ title: "Template caricato", description: `Configurazione ${saved.period} ripristinata.` });
  };

  return (
    <Layout>
      <div className="p-4 md:p-8 grid grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)] gap-4">
        <aside className="rounded-xl border border-card-border bg-card p-4 h-fit space-y-4">
          <h1 className="text-xl font-bold">Report Mensile</h1>
          <p className="text-sm text-muted-foreground">Configura le sezioni e genera il PDF professionale da consegnare al cliente.</p>
          <label className="block text-sm">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Periodo</span>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2" />
          </label>

          <div className="space-y-2">
            {(Object.keys(sections) as Array<keyof ReportSectionFlags>).map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={sections[key]} onChange={(e) => setSections((prev) => ({ ...prev, [key]: e.target.checked }))} />
                {key === "overview" && "Panoramica metriche"}
                {key === "followerTrend" && "Andamento follower"}
                {key === "topPosts" && "Top post del mese"}
                {key === "performance" && "Performance per formato"}
                {key === "nextPlan" && "Piano prossimo mese"}
                {key === "strategicNotes" && "Note strategiche"}
              </label>
            ))}
          </div>

          <label className="block text-sm">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Messaggio introduttivo</span>
            <textarea value={introMessage} onChange={(e) => setIntroMessage(e.target.value)} rows={4} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 resize-none" />
          </label>

          <label className="block text-sm">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Obiettivi prossimo mese</span>
            <textarea value={nextGoals} onChange={(e) => setNextGoals(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 resize-none" />
          </label>

          <label className="block text-sm">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Note strategiche</span>
            <textarea value={strategicNotes} onChange={(e) => setStrategicNotes(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 resize-none" />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={includeCompetitors} onChange={(e) => setIncludeCompetitors(e.target.checked)} />
            Includi dati competitors
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <button onClick={handleGeneratePreview} disabled={isGeneratingReport} className="px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium disabled:opacity-60">
              {isGeneratingReport ? "Aggiornamento dati..." : "Genera anteprima"}
            </button>
            <button onClick={handleExport} disabled={isExporting} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60">
              {isExporting ? "Generazione PDF in corso..." : "Esporta PDF"}
            </button>
          </div>

          <ReportHistory reports={history} onRegenerate={regenerate} />
        </aside>

        <section className="space-y-4">
          <MetaConnectionBanner
            error={meta.error}
            isStale={meta.isStale}
            lastSyncAt={meta.lastSyncAt}
            onSync={handleGeneratePreview}
            syncing={meta.isLoading || isGeneratingReport}
          />
          <div ref={previewRef} className="overflow-auto rounded-xl bg-muted/20 p-4 border border-card-border">
            <ReportPreview model={previewModel} />
          </div>
        </section>
      </div>
    </Layout>
  );
}
