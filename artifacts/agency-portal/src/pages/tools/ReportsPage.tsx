import { useMemo, useRef, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { ReportPreview, type ReportSectionFlags } from "@/components/tools/reports/ReportPreview";
import { exportReportPdf } from "@/components/tools/reports/PdfExporter";
import { ReportHistory, type SavedReport } from "@/components/tools/reports/ReportHistory";
import { useClientContext } from "@/context/ClientContext";
import { useMetaAnalytics } from "@/hooks/useMetaAnalytics";
import { useToast } from "@/hooks/use-toast";
import { MetaConnectionBanner } from "@/components/shared/MetaConnectionBanner";

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
      analytics: effectiveAnalytics,
      scheduledPosts: nextMonthPosts,
    }),
    [activeClient?.name, month, introMessage, nextGoals, strategicNotes, includeCompetitors, sections, effectiveAnalytics, nextMonthPosts],
  );

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

  const handleExport = async () => {
    if (!previewRef.current || !activeClient) return;
    setIsExporting(true);
    try {
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
            <button onClick={() => saveHistoryEntry()} className="px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium">
              Genera anteprima
            </button>
            <button onClick={handleExport} disabled={isExporting} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60">
              {isExporting ? "Generazione PDF in corso..." : "Esporta PDF"}
            </button>
          </div>

          <ReportHistory reports={history} onRegenerate={regenerate} />
        </aside>

        <section className="space-y-4">
          <MetaConnectionBanner error={meta.error} isStale={meta.isStale} lastSyncAt={meta.lastSyncAt} onSync={meta.sync} syncing={meta.isLoading} />
          <div ref={previewRef} className="overflow-auto rounded-xl bg-muted/20 p-4 border border-card-border">
            <ReportPreview model={previewModel} />
          </div>
        </section>
      </div>
    </Layout>
  );
}
