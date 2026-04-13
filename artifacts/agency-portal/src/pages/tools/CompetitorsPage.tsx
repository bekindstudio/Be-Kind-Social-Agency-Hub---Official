import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { useClientContext } from "@/context/ClientContext";
import { AddCompetitorModal } from "@/components/tools/competitors/AddCompetitorModal";
import { CompetitorCard } from "@/components/tools/competitors/CompetitorCard";
import { ComparisonChart } from "@/components/tools/competitors/ComparisonChart";
import { InsightPanel } from "@/components/tools/competitors/InsightPanel";
import type { Competitor } from "@/types/client";
import { Plus } from "lucide-react";

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export default function CompetitorsPage() {
  const {
    activeClient,
    brief,
    analytics,
    competitors,
    removeCompetitor,
  } = useClientContext();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Competitor | null>(null);
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string | null>(null);
  const [prefillName, setPrefillName] = useState<string | undefined>(undefined);

  useEffect(() => {
    setEditing(null);
    setSelectedCompetitorId(null);
    setModalOpen(false);
    setPrefillName(undefined);
  }, [activeClient?.id]);

  const averageFollowers = useMemo(
    () => Math.round(avg(competitors.map((c) => c.followers))),
    [competitors],
  );
  const averageEngagement = useMemo(
    () => avg(competitors.map((c) => c.engagementRate)),
    [competitors],
  );
  const averagePostsPerWeek = useMemo(
    () => avg(competitors.map((c) => c.postsPerWeek)),
    [competitors],
  );

  const briefCompetitorNames = (brief?.competitors ?? []).map((name) => name.trim()).filter(Boolean);
  const analyzedNames = new Set(competitors.map((c) => c.name.trim().toLowerCase()));
  const pendingBriefCompetitors = briefCompetitorNames.filter((name) => !analyzedNames.has(name.toLowerCase()));

  const openAddModal = (name?: string) => {
    setEditing(null);
    setPrefillName(name);
    setModalOpen(true);
  };

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Analisi Competitors</h1>
            <p className="text-sm text-muted-foreground">
              Monitoraggio interno competitor per {activeClient?.name ?? "cliente selezionato"}.
            </p>
          </div>
          <button onClick={() => openAddModal()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            <Plus size={16} />
            Aggiungi competitor
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Media follower competitors</p>
            <p className="mt-1 text-2xl font-bold">{averageFollowers.toLocaleString("it-IT")}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Media engagement rate</p>
            <p className="mt-1 text-2xl font-bold">{averageEngagement.toFixed(2)}%</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Media post a settimana</p>
            <p className="mt-1 text-2xl font-bold">{averagePostsPerWeek.toFixed(1)}</p>
          </div>
        </div>

        {pendingBriefCompetitors.length > 0 && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
            <p className="text-sm font-medium text-amber-900">
              Hai {pendingBriefCompetitors.length} competitor nel brief non ancora analizzati.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {pendingBriefCompetitors.map((name) => (
                <button key={name} onClick={() => openAddModal(name)} className="text-xs rounded-full bg-white/80 px-3 py-1 border border-amber-300 hover:bg-white">
                  Aggiungi "{name}"
                </button>
              ))}
            </div>
          </div>
        )}

        {competitors.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <svg width="74" height="74" viewBox="0 0 74 74" className="mx-auto mb-3 text-muted-foreground">
              <circle cx="37" cy="37" r="30" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.35" />
              <circle cx="37" cy="37" r="18" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.5" />
              <circle cx="37" cy="37" r="7" fill="currentColor" opacity="0.7" />
            </svg>
            <h2 className="text-lg font-semibold">Nessun competitor monitorato</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Aggiungi i competitor del cliente per iniziare l'analisi comparativa.
            </p>
            {pendingBriefCompetitors.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">
                  Hai gia indicato {pendingBriefCompetitors.length} competitor nel brief: vuoi aggiungerli ora?
                </p>
                <button onClick={() => openAddModal(pendingBriefCompetitors[0])} className="mt-2 text-sm rounded-lg bg-primary px-3 py-2 text-primary-foreground">
                  Apri modal precompilato
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {competitors.map((competitor) => (
              <div key={competitor.id} onClick={() => setSelectedCompetitorId(competitor.id)}>
                <CompetitorCard
                  competitor={competitor}
                  clientEngagementRate={analytics?.engagementRate ?? 0}
                  onEdit={(current) => {
                    setEditing(current);
                    setModalOpen(true);
                  }}
                  onDelete={(current) => {
                    const ok = window.confirm(`Eliminare ${current.name}?`);
                    if (!ok) return;
                    removeCompetitor(current.id);
                    if (selectedCompetitorId === current.id) setSelectedCompetitorId(null);
                  }}
                />
              </div>
            ))}
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <h2 className="text-base font-semibold">Confronto visivo</h2>
          <ComparisonChart competitors={competitors} clientAnalytics={analytics} clientName={activeClient?.name ?? "Cliente"} />
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="text-base font-semibold">Insight strategici</h2>
          <InsightPanel clientId={activeClient?.id ?? "unknown"} clientAnalytics={analytics} competitors={competitors} />
        </div>
      </div>

      <AddCompetitorModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
          setPrefillName(undefined);
        }}
        competitor={editing}
        initialName={prefillName}
      />
      {/* TODO: Integrate automatic competitor metric fetching from social APIs. */}
    </Layout>
  );
}
