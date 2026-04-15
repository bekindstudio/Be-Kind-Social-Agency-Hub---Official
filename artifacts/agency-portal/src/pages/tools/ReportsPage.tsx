import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import type { ReportSectionFlags } from "@/components/tools/reports/ReportPreview";
import type { SavedReport } from "@/components/tools/reports/ReportHistory";
import { useClientContext } from "@/context/ClientContext";
import { useMetaAnalytics } from "@/hooks/useMetaAnalytics";
import { useToast } from "@/hooks/use-toast";
import { useReportsData } from "@/hooks/useReports";
import { MetaConnectionBanner } from "@/components/shared/MetaConnectionBanner";
import { ReportMetrics } from "@/components/tools/reports/ReportMetrics";
import { ReportFilters } from "@/components/tools/reports/ReportFilters";
import { portalFetch } from "@workspace/api-client-react";
import type { ClientAnalytics } from "@/types/client";
import { buildFallbackMetrics, monthLabel } from "@/lib/reportUtils";
import { Sparkles } from "lucide-react";

const ReportPreview = lazy(async () => {
  const mod = await import("@/components/tools/reports/ReportPreview");
  return { default: mod.ReportPreview };
});

const ReportHistory = lazy(async () => {
  const mod = await import("@/components/tools/reports/ReportHistory");
  return { default: mod.ReportHistory };
});


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
  const queryClient = useQueryClient();
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [introMessage, setIntroMessage] = useState("Nel periodo analizzato abbiamo mantenuto una traiettoria positiva sui KPI principali.");
  const [nextGoals, setNextGoals] = useState("Aumentare la frequenza contenuti video e consolidare i formati best performer.");
  const [strategicNotes, setStrategicNotes] = useState("Testare 2 nuove rubriche editoriali e un boost paid per i top post.");
  const [includeCompetitors, setIncludeCompetitors] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportAnalytics, setReportAnalytics] = useState<ClientAnalytics | null>(null);
  const [isFallbackData, setIsFallbackData] = useState(false);

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
    setIsFallbackData(false);
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

  const {
    selectedClientNumericId,
    selectedMonthRange,
    history,
    syncAndFetchReportMetrics,
    handleGeneratePreview,
  } = useReportsData({
    activeClientId: activeClient?.id,
    month,
    setReportAnalytics,
    setIsFallbackData,
  });
  const handleGeneratePreviewClick = () => handleGeneratePreview(activeClient?.name, setIsGeneratingReport);

  const handleExport = async () => {
    if (!previewRef.current || !activeClient) return;
    setIsExporting(true);
    try {
      const { exportReportPdf } = await import("@/components/tools/reports/PdfExporter");
      const serverMetrics = (await syncAndFetchReportMetrics().catch(() => null)) ?? buildFallbackMetrics(effectiveAnalytics);
      setIsFallbackData(Boolean(serverMetrics?.mock));
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
        await queryClient.invalidateQueries({
          queryKey: ["reports", "history", selectedClientNumericId],
        });
      }
      await exportReportPdf(previewRef.current, `report-${activeClient.name}-${month}.pdf`);
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
          <ReportFilters
            state={{
              month,
              includeCompetitors,
              sections,
              introMessage,
              nextGoals,
              strategicNotes,
              isGeneratingReport,
              isExporting,
            }}
            setState={{
              setMonth,
              setIncludeCompetitors,
              setSections,
              setIntroMessage,
              setNextGoals,
              setStrategicNotes,
            }}
            labels={{
              sectionLabels,
              quickPresets,
            }}
            actions={{
              onApplyPreset: applyPreset,
              onSetSectionsPreset: setSectionsPreset,
              onGeneratePreview: handleGeneratePreviewClick,
              onExport: handleExport,
            }}
            historyNode={(
              <Suspense fallback={<div className="rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">Caricamento storico report...</div>}>
                <ReportHistory reports={history} onRegenerate={regenerate} />
              </Suspense>
            )}
          />

          <section className="space-y-4">
          <MetaConnectionBanner
            error={meta.error}
            isStale={meta.isStale}
            lastSyncAt={meta.lastSyncAt}
            onSync={handleGeneratePreviewClick}
            syncing={meta.isLoading || isGeneratingReport}
          />
            <ReportMetrics
              analytics={selectedAnalytics}
              isFallback={isFallbackData}
              onSync={handleGeneratePreviewClick}
            />
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
                  <Suspense fallback={<div className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">Caricamento anteprima report...</div>}>
                    <ReportPreview model={previewModel} />
                  </Suspense>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}
