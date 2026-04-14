import { jsPDF } from "jspdf";
import type { CampaignResponse } from "@/types/content-ideas";

interface CampaignPreviewProps {
  campaign: CampaignResponse;
  baseTheme: string;
  onTransformToPlan: (payload: {
    theme: string;
    seasonalEvents: string[];
    weekThemes: string[];
    platformSuggestions: Array<{ platform: string; postsPerWeek: number }>;
  }) => void;
}

function normalizePlatform(value: string): string {
  return value.toLowerCase().trim();
}

export function CampaignPreview({ campaign, baseTheme, onTransformToPlan }: CampaignPreviewProps) {
  const teaser = campaign.phases?.teaser;
  const launch = campaign.phases?.launch;
  const followUp = campaign.phases?.followUp;

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-3">
        <article className="rounded-xl border border-card-border bg-card p-4">
          <h3 className="font-semibold">Fase 1 - Teaser</h3>
          <p className="mt-1 text-sm"><strong>Obiettivo:</strong> {teaser?.objective}</p>
          <p className="text-sm"><strong>Messaggio chiave:</strong> {teaser?.keyMessage}</p>
          <p className="text-sm"><strong>Tono:</strong> {teaser?.tone || "N/D"}</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {(teaser?.contents ?? []).map((item) => (
              <li key={item.title}>- {item.title} ({item.format} · {item.platform})</li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-card-border bg-card p-4">
          <h3 className="font-semibold">Fase 2 - Lancio</h3>
          <p className="mt-1 text-sm"><strong>Obiettivo:</strong> {launch?.objective}</p>
          <p className="text-sm"><strong>Messaggio chiave:</strong> {launch?.keyMessage}</p>
          {launch?.heroPost && <p className="text-sm rounded-md bg-violet-50 p-2 text-violet-700"><strong>Post eroe:</strong> {launch.heroPost}</p>}
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {(launch?.contents ?? []).map((item) => (
              <li key={item.title}>- {item.title} ({item.format} · {item.platform})</li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-card-border bg-card p-4">
          <h3 className="font-semibold">Fase 3 - Follow-up e conversione</h3>
          <p className="mt-1 text-sm"><strong>Obiettivo:</strong> {followUp?.objective}</p>
          <p className="text-sm"><strong>Messaggio chiave:</strong> {followUp?.keyMessage}</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {(followUp?.contents ?? []).map((item) => (
              <li key={item.title}>- {item.title} ({item.format} · {item.platform})</li>
            ))}
          </ul>
          <p className="mt-2 text-sm font-medium">Metriche di successo</p>
          <ul className="text-sm text-muted-foreground">
            {(followUp?.successMetrics ?? []).map((metric) => (
              <li key={metric}>- {metric}</li>
            ))}
          </ul>
        </article>
      </div>

      <aside className="space-y-3">
        <div className="rounded-xl border border-card-border bg-card p-4 text-sm">
          <h4 className="font-semibold">Sidebar campagna</h4>
          <p className="mt-2 font-medium">Messaggi chiave</p>
          <ul className="text-muted-foreground">
            {(campaign.keyMessages ?? []).map((item) => <li key={item}>- {item}</li>)}
          </ul>
          <p className="mt-2 font-medium">Hashtag campagna</p>
          <div className="flex flex-wrap gap-1">
            {(campaign.campaignHashtags ?? []).map((item) => (
              <span key={item} className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700">{item}</span>
            ))}
          </div>
          <p className="mt-2 font-medium">Metriche</p>
          <ul className="text-muted-foreground">
            {(campaign.metrics ?? []).map((item) => <li key={item}>- {item}</li>)}
          </ul>
          <p className="mt-2 font-medium">Suggerimenti visual</p>
          <ul className="text-muted-foreground">
            {(campaign.visualSuggestions ?? []).map((item) => <li key={item}>- {item}</li>)}
          </ul>
        </div>

        <button
          type="button"
          className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
          onClick={() => {
            const phaseMessages = [teaser?.keyMessage, launch?.keyMessage, followUp?.keyMessage]
              .map((item) => (item ?? "").trim())
              .filter(Boolean);
            const allContents = [...(teaser?.contents ?? []), ...(launch?.contents ?? []), ...(followUp?.contents ?? [])];
            const platformCount = allContents.reduce<Record<string, number>>((acc, item) => {
              const platform = normalizePlatform(item.platform || "instagram");
              acc[platform] = (acc[platform] ?? 0) + 1;
              return acc;
            }, {});
            const platformSuggestions = Object.entries(platformCount).map(([platform, count]) => ({
              platform,
              postsPerWeek: Math.max(1, Math.min(7, count)),
            }));
            const seasonalEvents = Array.from(new Set([
              ...(phaseMessages.slice(0, 3)),
              ...(campaign.campaignHashtags ?? []).slice(0, 3).map((item) => item.replace(/^#/, "")),
            ]));
            onTransformToPlan({
              theme: baseTheme || campaign.keyMessages?.[0] || "Campagna tematica",
              seasonalEvents,
              weekThemes: phaseMessages,
              platformSuggestions,
            });
          }}
        >
          Trasforma in piano editoriale
        </button>
        <button
          type="button"
          className="w-full rounded-lg bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground"
          onClick={() => {
            const pdf = new jsPDF();
            pdf.setFontSize(14);
            pdf.text("Brief campagna AI", 14, 16);
            pdf.setFontSize(11);
            let y = 26;
            const lines = [
              "Messaggi chiave:",
              ...(campaign.keyMessages ?? []).map((item) => `- ${item}`),
              "",
              "Metriche da monitorare:",
              ...(campaign.metrics ?? []).map((item) => `- ${item}`),
              "",
              "Hashtag:",
              ...(campaign.campaignHashtags ?? []).map((item) => `- ${item}`),
            ];
            lines.forEach((line) => {
              pdf.text(line.slice(0, 180), 14, y);
              y += 6;
            });
            pdf.save(`campagna-ai-${new Date().toISOString().slice(0, 10)}.pdf`);
          }}
        >
          Esporta come documento
        </button>
      </aside>
    </section>
  );
}
