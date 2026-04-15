import { CalendarClock, Gauge, TrendingUp, Users } from "lucide-react";
import type { ClientAnalytics } from "@/types/client";

export function ReportMetrics({
  analytics,
  isFallback,
  onSync,
}: {
  analytics: ClientAnalytics | null;
  isFallback: boolean;
  onSync: () => void;
}) {
  return (
    <>
      {isFallback && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Dati non aggiornati — Sincronizza Meta per visualizzare metriche reali.
          <button
            type="button"
            onClick={onSync}
            className="ml-2 inline-flex rounded-md border border-amber-400 px-2 py-1 text-xs font-medium hover:bg-amber-100"
          >
            Sincronizza Meta
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="rounded-xl border border-card-border bg-card px-3 py-2.5">
          <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Users size={12} /> Follower</p>
          <p className="text-base font-semibold">{analytics?.followers?.toLocaleString("it-IT") ?? "0"}</p>
        </div>
        <div className="rounded-xl border border-card-border bg-card px-3 py-2.5">
          <p className="text-[11px] text-muted-foreground flex items-center gap-1"><TrendingUp size={12} /> Reach</p>
          <p className="text-base font-semibold">{analytics?.reach?.toLocaleString("it-IT") ?? "0"}</p>
        </div>
        <div className="rounded-xl border border-card-border bg-card px-3 py-2.5">
          <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Gauge size={12} /> Engagement</p>
          <p className="text-base font-semibold">{(analytics?.engagementRate ?? 0).toFixed(2)}%</p>
        </div>
        <div className="rounded-xl border border-card-border bg-card px-3 py-2.5">
          <p className="text-[11px] text-muted-foreground flex items-center gap-1"><CalendarClock size={12} /> Post</p>
          <p className="text-base font-semibold">{analytics?.postsPublished ?? 0}</p>
        </div>
      </div>
    </>
  );
}
