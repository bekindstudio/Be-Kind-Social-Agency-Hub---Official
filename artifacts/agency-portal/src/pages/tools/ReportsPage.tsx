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
import { CalendarRange, Download, FileBarChart2, Sparkles, Wand2, Gauge, TrendingUp, Users, CalendarClock } from "lucide-react";

function monthLabel(value: string): string {
  const [year, month] = value.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
}

function storageKey(clientId: string): string {
  return `agency_hub_reports_${clientId}`;
}

const sectionLabels: Record<keyof ReportSectionFlags, string> = {
  overview: "Panoramica metriche",
  followerTrend: "Andamento follower",
  topPosts: "Top post del mese",
  performance: "Performance per formato",
  nextPlan: "Piano prossimo mese",
  strategicNotes: "Note strategiche",
};

const quickPresets = [
  {
    id: "growth",
    label: "Focus crescita",
    intro:
      "Nel periodo analizzato il brand ha mostrato una crescita costante sui KPI principali, con segnali positivi su copertura e coinvolgimento.",
    goals:
      "Incrementare la quota di contenuti video ad alto impatto e consolidare i format con migliore retention.",
    notes:
      "Priorita su rubriche ricorrenti e test A/B dei primi 3 secondi di hook nei contenuti video.",
  },
  {
    id: "sales",
    label: "Focus vendite",
    intro:
      "Le attivita del mese hanno sostenuto la fase di conversione con una buona base di awareness e contenuti orientati all'azione.",
    goals:
      "Aumentare la frequenza dei contenuti con CTA commerciale e rafforzare i touchpoint verso landing e WhatsApp.",
    notes:
      "Allineare calendario editoriale e promozioni attive, monitorando i contenuti con migliore rapporto reach/conversione.",
  },
  {
    id: "brand",
    label: "Focus brand",
    intro:
      "La comunicazione ha mantenuto coerenza di tone of voice e presenza costante, rafforzando il posizionamento del brand.",
    goals:
      "Consolidare i contenuti educational e storytelling per aumentare autorevolezza e riconoscibilita.",
    notes:
      "Mantenere una cadenza editoriale equilibrata tra contenuti istituzionali, community e proof social.",
  },
] as const;

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
    if (!activeClient?.id) {
      setHistory([]);
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey(activeClient.id));
      setHistory(raw ? (JSON.parse(raw) as SavedReport[]) : []);
    } catch {
      setHistory([]);
    }
  }, [activeClient?.id]);

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

  const enabledSections = (Object.values(sections) as boolean[]).filter(Boolean).length;
  const syncStatusLabel = meta.lastSyncAt ? new Date(meta.lastSyncAt).toLocaleString("it-IT") : "non disponibile";

  const applyPreset = (presetId: (typeof quickPresets)[number]["id"]) => {
    const preset = quickPresets.find((item) => item.id === presetId);
    if (!preset) return;
    setIntroMessage(preset.intro);
    setNextGoals(preset.goals);
    setStrategicNotes(preset.notes);
    toast({ title: "Preset applicato", description: `Template "${preset.label}" pronto da rifinire.` });
  };

  const setSectionsPreset = (mode: "full" | "essential") => {
    if (mode === "full") {
      setSections({
        overview: true,
        followerTrend: true,
        topPosts: true,
        performance: true,
        nextPlan: true,
        strategicNotes: true,
      });
      return;
    }
    setSections({
      overview: true,
      followerTrend: true,
      topPosts: true,
      performance: false,
      nextPlan: false,
      strategicNotes: true,
    });
  };

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-4">
        <section className="rounded-2xl border border-emerald-200/60 bg-gradient-to-r from-emerald-50 via-white to-lime-50 p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                <Sparkles size={12} />
                Report Studio
              </p>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Report Mensile {activeClient ? `· ${activeClient.name}` : ""}</h1>
              <p className="text-sm text-muted-foreground max-w-2xl">Esperienza ottimizzata per costruire report professionali in pochi click, con dati aggiornati e preview live pronta per il PDF.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl border border-emerald-200 bg-white/80 px-3 py-2">
                <p className="text-muted-foreground">Periodo</p>
                <p className="font-semibold text-foreground">{monthLabel(month)}</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-white/80 px-3 py-2">
                <p className="text-muted-foreground">Ultima sync</p>
                <p className="font-semibold text-foreground">{meta.isStale ? "Da aggiornare" : "Allineata"}</p>
              </div>
              <div className="col-span-2 rounded-xl border border-emerald-200 bg-white/80 px-3 py-2">
                <p className="text-muted-foreground">Stato dati</p>
                <p className="font-semibold text-foreground">{syncStatusLabel} · sezioni {enabledSections}/6</p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-[390px_minmax(0,1fr)] gap-4">
          <aside className="rounded-2xl border border-card-border bg-card p-4 md:p-5 h-fit xl:sticky xl:top-3 space-y-5 shadow-sm">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FileBarChart2 size={18} className="text-emerald-600" />
                Configurazione report
              </h2>
              <p className="text-sm text-muted-foreground">Personalizza contenuti, blocchi e testi strategici prima dell'export.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Periodo</span>
                <div className="relative mt-1">
                  <CalendarRange size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2"
                  />
                </div>
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 mt-5 text-sm">
                <input type="checkbox" checked={includeCompetitors} onChange={(e) => setIncludeCompetitors(e.target.checked)} />
                Includi competitors
              </label>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Blocchi nel report</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSectionsPreset("full")}
                  className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Completo
                </button>
                <button
                  type="button"
                  onClick={() => setSectionsPreset("essential")}
                  className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Essenziale
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(sections) as Array<keyof ReportSectionFlags>).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSections((prev) => ({ ...prev, [key]: !prev[key] }))}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      sections[key]
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {sectionLabels[key]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Preset rapidi</p>
              <div className="flex flex-wrap gap-2">
                {quickPresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset.id)}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={handleGeneratePreview}
                disabled={isGeneratingReport}
                className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium disabled:opacity-60 transition-all hover:-translate-y-0.5"
              >
                <Wand2 size={15} />
                {isGeneratingReport ? "Aggiorno..." : "Genera anteprima"}
              </button>
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-60 hover:bg-emerald-700 transition-all hover:-translate-y-0.5"
              >
                <Download size={15} />
                {isExporting ? "PDF in corso..." : "Esporta PDF"}
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="rounded-xl border border-card-border bg-card px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Users size={12} /> Follower</p>
                <p className="text-base font-semibold">{selectedAnalytics?.followers?.toLocaleString("it-IT") ?? "0"}</p>
              </div>
              <div className="rounded-xl border border-card-border bg-card px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground flex items-center gap-1"><TrendingUp size={12} /> Reach</p>
                <p className="text-base font-semibold">{selectedAnalytics?.reach?.toLocaleString("it-IT") ?? "0"}</p>
              </div>
              <div className="rounded-xl border border-card-border bg-card px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Gauge size={12} /> Engagement</p>
                <p className="text-base font-semibold">{(selectedAnalytics?.engagementRate ?? 0).toFixed(2)}%</p>
              </div>
              <div className="rounded-xl border border-card-border bg-card px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground flex items-center gap-1"><CalendarClock size={12} /> Post</p>
                <p className="text-base font-semibold">{selectedAnalytics?.postsPublished ?? 0}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-card-border bg-card p-3 md:p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">Anteprima live</p>
                <p className="text-xs text-muted-foreground">Template premium · PDF ready</p>
              </div>
              <div className="relative">
                {(isGeneratingReport || meta.isLoading) && (
                  <div className="absolute inset-0 z-10 rounded-xl border border-emerald-200 bg-white/85 backdrop-blur-[1px] p-4">
                    <div className="h-full w-full animate-pulse space-y-2">
                      <div className="h-3 w-1/3 rounded bg-emerald-100" />
                      <div className="h-2.5 w-2/3 rounded bg-emerald-50" />
                      <div className="h-2.5 w-1/2 rounded bg-emerald-50" />
                      <div className="mt-4 h-24 rounded bg-emerald-50" />
                      <div className="h-16 rounded bg-emerald-50" />
                    </div>
                  </div>
                )}
                <div ref={previewRef} className="overflow-auto rounded-xl bg-muted/20 p-2 md:p-3 border border-card-border">
                <ReportPreview model={previewModel} />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}
