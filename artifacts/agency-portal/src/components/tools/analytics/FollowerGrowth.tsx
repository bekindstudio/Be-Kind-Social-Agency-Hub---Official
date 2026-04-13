import { useMemo } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceDot } from "recharts";

interface FollowerPoint {
  date: string;
  followers: number;
  delta?: number;
}

export function FollowerGrowth({ points }: { points: FollowerPoint[] }) {
  const chartData = useMemo(
    () =>
      points.map((point, index) => {
        const prev = points[index - 1]?.followers ?? point.followers;
        return {
          ...point,
          delta: point.followers - prev,
          label: new Date(point.date).toLocaleDateString("it-IT", { day: "2-digit", month: "short" }),
        };
      }),
    [points],
  );

  const highlight = chartData.reduce<{ idx: number; delta: number }>(
    (best, point, idx) => (point.delta > best.delta ? { idx, delta: point.delta ?? 0 } : best),
    { idx: -1, delta: 0 },
  );

  return (
    <div className="rounded-xl border border-card-border bg-card p-4">
      <h3 className="font-semibold mb-3">Crescita follower</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Area type="monotone" dataKey="followers" stroke="#16A34A" fill="#86EFAC" fillOpacity={0.35} strokeWidth={2} />
            {highlight.idx >= 0 && (
              <ReferenceDot
                x={chartData[highlight.idx].label}
                y={chartData[highlight.idx].followers}
                r={4}
                fill="#16A34A"
                label={{ position: "top", value: `Post virale +${highlight.delta} follower`, fontSize: 11 }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
