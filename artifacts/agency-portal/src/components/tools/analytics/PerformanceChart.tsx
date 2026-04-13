import { useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from "recharts";

interface PerformancePoint {
  date: string;
  reach: number;
  impressions: number;
  engagement: number;
}

export function PerformanceChart({ data }: { data: PerformancePoint[] }) {
  const [showReach, setShowReach] = useState(true);
  const [showImpressions, setShowImpressions] = useState(true);
  const [showEngagement, setShowEngagement] = useState(true);

  const chartData = useMemo(
    () =>
      data.map((point) => ({
        ...point,
        label: new Date(point.date).toLocaleDateString("it-IT", { day: "2-digit", month: "short" }),
      })),
    [data],
  );

  return (
    <div className="rounded-xl border border-card-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Andamento nel tempo</h3>
        <div className="flex items-center gap-2 text-xs">
          <button onClick={() => setShowReach((v) => !v)} className={`px-2 py-1 rounded ${showReach ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground"}`}>Reach</button>
          <button onClick={() => setShowImpressions((v) => !v)} className={`px-2 py-1 rounded ${showImpressions ? "bg-violet-100 text-violet-700" : "bg-muted text-muted-foreground"}`}>Impression</button>
          <button onClick={() => setShowEngagement((v) => !v)} className={`px-2 py-1 rounded ${showEngagement ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>Engagement</button>
        </div>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Legend />
            {showReach && <Line type="monotone" dataKey="reach" stroke="#2563EB" strokeWidth={2} dot={false} />}
            {showImpressions && <Line type="monotone" dataKey="impressions" stroke="#7C3AED" strokeDasharray="6 4" strokeWidth={2} dot={false} />}
            {showEngagement && <Line type="monotone" dataKey="engagement" stroke="#16A34A" strokeWidth={2} dot={false} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
