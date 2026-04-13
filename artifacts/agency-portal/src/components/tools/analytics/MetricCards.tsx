import { ArrowDownRight, ArrowUpRight, Users, Radio, Heart, FileText } from "lucide-react";

type BenchmarkMap = Record<string, number>;

const INDUSTRY_BENCHMARKS: BenchmarkMap = {
  ristorazione: 4.2,
  salute: 2.7,
  "fashion retail": 3.8,
  default: 3.0,
};

interface MetricCardsProps {
  followers: number;
  followersPrevious: number;
  reach: number;
  reachPrevious: number;
  engagementRate: number;
  engagementRatePrevious: number;
  postsPublished: number;
  postsPublishedPrevious: number;
  industry?: string;
}

function delta(current: number, previous: number): number {
  return current - previous;
}

function deltaPercent(current: number, previous: number): number {
  if (!previous) return 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function getBenchmark(industry?: string): number {
  if (!industry) return INDUSTRY_BENCHMARKS.default;
  const key = industry.trim().toLowerCase();
  return INDUSTRY_BENCHMARKS[key] ?? INDUSTRY_BENCHMARKS.default;
}

function TrendValue({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span className={`text-xs font-semibold inline-flex items-center gap-1 ${positive ? "text-emerald-600" : "text-rose-600"}`}>
      {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {positive ? "+" : ""}
      {value}
    </span>
  );
}

export function MetricCards({
  followers,
  followersPrevious,
  reach,
  reachPrevious,
  engagementRate,
  engagementRatePrevious,
  postsPublished,
  postsPublishedPrevious,
  industry,
}: MetricCardsProps) {
  const followersDelta = delta(followers, followersPrevious);
  const reachDeltaPct = deltaPercent(reach, reachPrevious);
  const engagementDelta = Number((engagementRate - engagementRatePrevious).toFixed(2));
  const postsDelta = delta(postsPublished, postsPublishedPrevious);
  const benchmark = getBenchmark(industry);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      <div className="rounded-xl border border-card-border bg-card p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Follower Totali</p>
          <Users size={14} className="text-primary" />
        </div>
        <p className="text-2xl font-bold mt-2">{followers.toLocaleString("it-IT")}</p>
        <p className="mt-1"><TrendValue value={followersDelta} /></p>
      </div>

      <div className="rounded-xl border border-card-border bg-card p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Reach Totale</p>
          <Radio size={14} className="text-blue-500" />
        </div>
        <p className="text-2xl font-bold mt-2">{reach.toLocaleString("it-IT")}</p>
        <p className="mt-1"><TrendValue value={reachDeltaPct} /> <span className="text-xs text-muted-foreground">vs periodo precedente</span></p>
      </div>

      <div className="rounded-xl border border-card-border bg-card p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Engagement Rate</p>
          <Heart size={14} className="text-emerald-500" />
        </div>
        <p className="text-2xl font-bold mt-2">{engagementRate.toFixed(2)}%</p>
        <p className="mt-1"><TrendValue value={engagementDelta} /> <span className="text-xs text-muted-foreground">benchmark {benchmark.toFixed(1)}%</span></p>
      </div>

      <div className="rounded-xl border border-card-border bg-card p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Post Pubblicati</p>
          <FileText size={14} className="text-violet-500" />
        </div>
        <p className="text-2xl font-bold mt-2">{postsPublished}</p>
        <p className="mt-1"><TrendValue value={postsDelta} /> <span className="text-xs text-muted-foreground">vs periodo precedente</span></p>
      </div>
    </div>
  );
}
