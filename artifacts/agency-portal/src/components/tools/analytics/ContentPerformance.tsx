import { useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

type MetricTab = "reach" | "engagement" | "count";

interface ContentPerformanceRow {
  type: "Post foto" | "Carosello" | "Reel/Video" | "Stories";
  reach: number;
  engagement: number;
  count: number;
}

export function ContentPerformance({ rows }: { rows: ContentPerformanceRow[] }) {
  const [tab, setTab] = useState<MetricTab>("reach");
  const data = useMemo(
    () =>
      rows.map((row) => ({
        name: row.type,
        value: tab === "reach" ? row.reach : tab === "engagement" ? row.engagement : row.count,
      })),
    [rows, tab],
  );

  return (
    <div className="rounded-xl border border-card-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Performance per formato</h3>
        <div className="flex items-center gap-2 text-xs">
          <button onClick={() => setTab("reach")} className={`px-2 py-1 rounded ${tab === "reach" ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground"}`}>Reach</button>
          <button onClick={() => setTab("engagement")} className={`px-2 py-1 rounded ${tab === "engagement" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>Engagement</button>
          <button onClick={() => setTab("count")} className={`px-2 py-1 rounded ${tab === "count" ? "bg-violet-100 text-violet-700" : "bg-muted text-muted-foreground"}`}>Count post</button>
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={96} />
            <Tooltip />
            <Bar dataKey="value" fill="#4F46E5" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
