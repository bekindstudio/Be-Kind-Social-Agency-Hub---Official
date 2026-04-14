import { useMemo, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { CampaignPreview } from "@/components/tools/ideas/CampaignPreview";
import type { CampaignRequest, CampaignResponse, CampaignToPlanPrefill, IdeasRequest } from "@/types/content-ideas";

interface CampaignTabProps {
  clientId: string;
  brief: IdeasRequest["brief"];
  campaign: CampaignResponse | null;
  isLoading: boolean;
  onGenerateCampaign: (request: CampaignRequest) => Promise<void>;
  onTransformToPlan: (payload: CampaignToPlanPrefill) => void;
}

export function CampaignTab({
  clientId,
  brief,
  campaign,
  isLoading,
  onGenerateCampaign,
  onTransformToPlan,
}: CampaignTabProps) {
  const [theme, setTheme] = useState("");
  const [duration, setDuration] = useState("3 settimane");
  const [mainObjective, setMainObjective] = useState("Brand awareness");
  const [budget, setBudget] = useState("Medio");
  const [includeOrganic, setIncludeOrganic] = useState(true);
  const [includePaid, setIncludePaid] = useState(true);

  const payload = useMemo<CampaignRequest>(() => ({
    clientId,
    brief,
    campaignDetails: {
      theme,
      duration,
      mainObjective,
      budget,
      includeOrganic,
      includePaid,
    },
  }), [brief, budget, clientId, duration, includeOrganic, includePaid, mainObjective, theme]);

  const weekCountFromDuration = useMemo(() => Math.max(1, Math.min(8, Number(duration.match(/\d+/)?.[0] ?? 4))), [duration]);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-card-border bg-card p-4 space-y-3">
        <h2 className="text-base font-semibold">Generazione campagna tematica</h2>
        <label className="block text-sm">
          Tema campagna
          <input
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2"
            value={theme}
            onChange={(event) => setTheme(event.target.value)}
            placeholder="es. Lancio menu estivo / Riapertura dopo ferie / Back to School"
          />
        </label>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="text-sm">
            Durata campagna
            <select className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2" value={duration} onChange={(event) => setDuration(event.target.value)}>
              <option>1 settimana</option>
              <option>2 settimane</option>
              <option>3 settimane</option>
              <option>4 settimane</option>
            </select>
          </label>
          <label className="text-sm">
            Obiettivo principale
            <select className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2" value={mainObjective} onChange={(event) => setMainObjective(event.target.value)}>
              <option>Brand awareness</option>
              <option>Vendite/conversioni</option>
              <option>Lancio prodotto</option>
              <option>Crescita follower</option>
              <option>Engagement</option>
              <option>Traffico sito</option>
            </select>
          </label>
          <label className="text-sm">
            Budget indicativo
            <select className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2" value={budget} onChange={(event) => setBudget(event.target.value)}>
              <option>Basso</option>
              <option>Medio</option>
              <option>Alto</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm">
            Includi contenuti organici
            <Switch checked={includeOrganic} onCheckedChange={setIncludeOrganic} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm">
            Includi suggerimenti paid
            <Switch checked={includePaid} onCheckedChange={setIncludePaid} />
          </div>
        </div>
        <button
          type="button"
          className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          disabled={isLoading || theme.trim().length < 3}
          onClick={async () => onGenerateCampaign(payload)}
        >
          {isLoading ? "Generazione campagna..." : "Genera campagna"}
        </button>
      </section>

      {campaign && (
        <CampaignPreview
          campaign={campaign}
          baseTheme={theme}
          onTransformToPlan={(next) => {
            const weekThemes: string[] = [];
            if (weekCountFromDuration === 1) {
              weekThemes.push(next.weekThemes[1] || next.weekThemes[0] || "Settimana campagna");
            } else if (weekCountFromDuration === 2) {
              weekThemes.push(next.weekThemes[0] || "Teaser");
              weekThemes.push(next.weekThemes[1] || "Lancio");
            } else {
              const teaserTheme = next.weekThemes[0] || "Teaser";
              const launchTheme = next.weekThemes[1] || "Lancio";
              const followTheme = next.weekThemes[2] || "Follow-up";
              weekThemes.push(teaserTheme);
              for (let week = 0; week < weekCountFromDuration - 2; week += 1) {
                weekThemes.push(launchTheme);
              }
              weekThemes.push(followTheme);
            }
            onTransformToPlan({
              ...next,
              weekCount: weekCountFromDuration,
              weekThemes,
              platformSuggestions: (next.platformSuggestions ?? []).map((item) => ({
                ...item,
                postsPerWeek: Math.max(1, Math.min(7, Math.ceil(item.postsPerWeek / weekCountFromDuration))),
              })),
            });
          }}
        />
      )}
    </div>
  );
}
