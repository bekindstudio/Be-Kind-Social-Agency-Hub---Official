import { ResponsiveContainer, AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar } from "recharts";
import type { ClientAnalytics, EditorialPost } from "@/types/client";

export interface ReportSectionFlags {
  overview: boolean;
  followerTrend: boolean;
  topPosts: boolean;
  performance: boolean;
  nextPlan: boolean;
  strategicNotes: boolean;
}

export interface ReportPreviewModel {
  clientName: string;
  periodLabel: string;
  generatedAt: string;
  introMessage: string;
  nextMonthGoals: string;
  strategicNotes: string;
  includeCompetitors: boolean;
  sections: ReportSectionFlags;
  analytics: ClientAnalytics | null;
  scheduledPosts: EditorialPost[];
}

function kpiSemaphore(value: number, target: number): "green" | "yellow" | "red" {
  if (value >= target) return "green";
  if (value >= target * 0.7) return "yellow";
  return "red";
}

export function ReportPreview({ model }: { model: ReportPreviewModel }) {
  const topPosts = (model.analytics?.topPosts ?? []).slice(0, 3);
  const formatRows = ["Post foto", "Carosello", "Reel/Video", "Stories"].map((format) => ({
    format,
    value: topPosts.filter((post) => {
      if (format === "Reel/Video") return post.mediaType === "VIDEO";
      if (format === "Carosello") return post.mediaType === "CAROUSEL_ALBUM";
      if (format === "Stories") return post.mediaType === "STORY";
      return post.mediaType === "IMAGE";
    }).length,
  }));

  const byWeek = model.scheduledPosts.reduce<Record<string, EditorialPost[]>>((acc, post) => {
    const weekKey = `${new Date(post.scheduledDate).getFullYear()}-W${Math.ceil(new Date(post.scheduledDate).getDate() / 7)}`;
    if (!acc[weekKey]) acc[weekKey] = [];
    acc[weekKey].push(post);
    return acc;
  }, {});

  return (
    <div className="mx-auto bg-white text-black rounded-lg shadow-sm border border-border overflow-hidden" style={{ width: 794 }}>
      <section className="px-10 py-12 border-b border-gray-200">
        <p className="text-sm uppercase tracking-[0.2em] text-gray-500">Be Kind Social Agency</p>
        <h1 className="text-3xl font-bold mt-3">{model.clientName}</h1>
        <p className="text-base text-gray-600 mt-1">{model.periodLabel}</p>
        <p className="text-sm text-gray-500 mt-4">Generato il {new Date(model.generatedAt).toLocaleDateString("it-IT")}</p>
      </section>

      {model.sections.overview && (
        <section className="px-10 py-8 border-b border-gray-100">
          <h2 className="text-xl font-semibold mb-4">Panoramica esecutiva</h2>
          <p className="text-sm text-gray-700 mb-5 whitespace-pre-wrap">{model.introMessage}</p>
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-md border border-gray-200 p-3">
              <p className="text-xs text-gray-500">Follower</p>
              <p className="text-xl font-semibold">{model.analytics?.followers.toLocaleString("it-IT") ?? 0}</p>
            </div>
            <div className="rounded-md border border-gray-200 p-3">
              <p className="text-xs text-gray-500">Reach</p>
              <p className="text-xl font-semibold">{model.analytics?.reach.toLocaleString("it-IT") ?? 0}</p>
            </div>
            <div className="rounded-md border border-gray-200 p-3">
              <p className="text-xs text-gray-500">Engagement</p>
              <p className="text-xl font-semibold">{model.analytics?.engagementRate.toFixed(2) ?? "0.00"}%</p>
            </div>
            <div className="rounded-md border border-gray-200 p-3">
              <p className="text-xs text-gray-500">Post pubblicati</p>
              <p className="text-xl font-semibold">{model.analytics?.postsPublished ?? 0}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3 text-xs">
            <span className={`px-2 py-1 rounded ${kpiSemaphore(model.analytics?.engagementRate ?? 0, 3.5) === "green" ? "bg-emerald-100 text-emerald-700" : kpiSemaphore(model.analytics?.engagementRate ?? 0, 3.5) === "yellow" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>
              KPI engagement
            </span>
          </div>
        </section>
      )}

      {model.sections.followerTrend && (
        <section className="px-10 py-8 border-b border-gray-100">
          <h2 className="text-xl font-semibold mb-4">Andamento nel tempo</h2>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={model.analytics?.dailyData ?? []}>
                <XAxis dataKey="date" hide />
                <YAxis />
                <Tooltip />
                <Area dataKey="followers" stroke="#16A34A" fill="#86EFAC" fillOpacity={0.35} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="h-60 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={model.analytics?.dailyData ?? []}>
                <XAxis dataKey="date" hide />
                <YAxis />
                <Tooltip />
                <Line dataKey="reach" stroke="#2563EB" dot={false} />
                <Line dataKey="impressions" stroke="#7C3AED" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {model.sections.topPosts && (
        <section className="px-10 py-8 border-b border-gray-100">
          <h2 className="text-xl font-semibold mb-4">Top post del mese</h2>
          <div className="grid grid-cols-3 gap-3">
            {topPosts.map((post) => (
              <div key={post.id} className="rounded-md border border-gray-200 p-3">
                <p className="text-xs text-gray-500">{post.mediaType}</p>
                <p className="text-sm mt-1 line-clamp-3">{post.caption || "Post senza caption"}</p>
                <p className="text-xs mt-2 text-gray-600">Engagement {post.engagementRate.toFixed(2)}%</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-700 mt-3">
            Il formato migliore del periodo e{" "}
            <strong>{topPosts[0]?.mediaType ?? "N/D"}</strong> con engagement medio del{" "}
            <strong>{topPosts[0]?.engagementRate?.toFixed(2) ?? "0.00"}%</strong>.
          </p>
        </section>
      )}

      {model.sections.performance && (
        <section className="px-10 py-8 border-b border-gray-100">
          <h2 className="text-xl font-semibold mb-4">Performance per formato</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={formatRows} layout="vertical">
                <XAxis type="number" />
                <YAxis type="category" dataKey="format" width={90} />
                <Tooltip />
                <Bar dataKey="value" fill="#4F46E5" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {model.sections.nextPlan && (
        <section className="px-10 py-8 border-b border-gray-100">
          <h2 className="text-xl font-semibold mb-4">Piano prossimo mese</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap mb-3">{model.nextMonthGoals}</p>
          {Object.entries(byWeek).map(([week, entries]) => (
            <div key={week} className="mb-2">
              <p className="text-xs uppercase text-gray-500">{week}</p>
              <ul className="text-sm text-gray-700">
                {entries.map((entry) => (
                  <li key={entry.id}>- {entry.title} ({entry.platform})</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {model.sections.strategicNotes && (
        <section className="px-10 py-8">
          <h2 className="text-xl font-semibold mb-4">Note strategiche</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{model.strategicNotes}</p>
          {model.includeCompetitors && (
            <p className="mt-3 text-xs text-gray-500">Inclusa comparazione con dati competitors dove disponibili.</p>
          )}
        </section>
      )}
    </div>
  );
}
