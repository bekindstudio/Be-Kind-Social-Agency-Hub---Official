import type { ClientAnalytics, Competitor } from "@/types/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  ReferenceLine,
  LabelList,
  Cell,
} from "recharts";

interface ComparisonChartProps {
  competitors: Competitor[];
  clientAnalytics: ClientAnalytics | null;
  clientName: string;
}

export function ComparisonChart({ competitors, clientAnalytics, clientName }: ComparisonChartProps) {
  const clientPostsPerWeek = clientAnalytics ? Number((clientAnalytics.postsPublished / 4).toFixed(1)) : 0;
  const followerData = [
    ...competitors.map((c) => ({ name: c.name, value: c.followers, isClient: false })),
    { name: `${clientName} (cliente)`, value: clientAnalytics?.followers ?? 0, isClient: true },
  ];
  const engagementData = [
    ...competitors.map((c) => ({ name: c.name, value: c.engagementRate, isClient: false })),
    { name: `${clientName} (cliente)`, value: clientAnalytics?.engagementRate ?? 0, isClient: true },
  ];
  const sectorAvg = competitors.length > 0
    ? competitors.reduce((sum, c) => sum + c.engagementRate, 0) / competitors.length
    : 0;
  const scatterData = [
    ...competitors.map((c) => ({ name: c.name, x: c.postsPerWeek, y: c.engagementRate, z: 120, isClient: false })),
    { name: `${clientName} (cliente)`, x: clientPostsPerWeek, y: clientAnalytics?.engagementRate ?? 0, z: 220, isClient: true },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold mb-3">Follower (confronto)</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={followerData} layout="vertical" margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={120} />
              <Tooltip formatter={(v: number) => Number(v).toLocaleString("it-IT")} />
              <Bar dataKey="value">
                {followerData.map((row) => (
                  <Cell key={row.name} fill={row.isClient ? "#2563eb" : "#94a3b8"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold mb-3">Engagement rate (%)</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={engagementData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" interval={0} angle={-20} textAnchor="end" height={70} />
              <YAxis />
              <Tooltip formatter={(v: number) => `${Number(v).toFixed(2)}%`} />
              <ReferenceLine y={sectorAvg} stroke="#f59e0b" strokeDasharray="4 4" />
              <Bar dataKey="value">
                {engagementData.map((row) => (
                  <Cell key={row.name} fill={row.value >= sectorAvg ? "#16a34a" : "#dc2626"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold mb-3">Frequenza pubblicazione vs engagement</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey="x" name="Post/settimana" />
              <YAxis type="number" dataKey="y" name="Engagement %" />
              <ZAxis type="number" dataKey="z" range={[80, 240]} />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(v: number, _name, item: any) => [v, item?.payload?.isClient ? "Cliente" : "Competitor"]} />
              <Scatter data={scatterData} fill="#0ea5e9" shape={(props: any) => (
                props.payload?.isClient
                  ? <polygon points={`${props.cx},${props.cy - 9} ${props.cx + 3},${props.cy - 2} ${props.cx + 10},${props.cy - 2} ${props.cx + 4},${props.cy + 2} ${props.cx + 6},${props.cy + 9} ${props.cx},${props.cy + 4} ${props.cx - 6},${props.cy + 9} ${props.cx - 4},${props.cy + 2} ${props.cx - 10},${props.cy - 2} ${props.cx - 3},${props.cy - 2}`} fill="#2563eb" />
                  : <circle cx={props.cx} cy={props.cy} r={5} fill="#0ea5e9" />
              )}>
                <LabelList dataKey="name" position="top" fontSize={10} />
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
