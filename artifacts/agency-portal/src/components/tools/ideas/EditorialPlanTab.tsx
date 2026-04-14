import { useEffect, useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { PlanPreview } from "@/components/tools/ideas/PlanPreview";
import { MONTH_NAMES_IT, SEASONAL_SUGGESTIONS_BY_MONTH } from "@/components/tools/ideas/constants";
import type { CampaignToPlanPrefill, IdeasRequest, PlanRequest, PlanResponse } from "@/types/content-ideas";

const DAYS = [
  { id: "lunedi", label: "Lu" },
  { id: "martedi", label: "Ma" },
  { id: "mercoledi", label: "Me" },
  { id: "giovedi", label: "Gi" },
  { id: "venerdi", label: "Ve" },
  { id: "sabato", label: "Sa" },
  { id: "domenica", label: "Do" },
] as const;

interface PlatformConfigForm {
  platform: string;
  enabled: boolean;
  postsPerWeek: number;
  preferredDays: string[];
  preferredTime: string;
}

interface EditorialPlanTabProps {
  clientId: string;
  brief: IdeasRequest["brief"];
  competitors: IdeasRequest["competitors"];
  plan: PlanResponse | null;
  isLoading: boolean;
  onGeneratePlan: (request: PlanRequest) => Promise<void>;
  onImportPlanToCalendar: (plan: PlanResponse, status: "draft" | "approved") => number;
  campaignPrefill?: CampaignToPlanPrefill | null;
}

export function EditorialPlanTab({
  clientId,
  brief,
  competitors,
  plan,
  isLoading,
  onGeneratePlan,
  onImportPlanToCalendar,
  campaignPrefill,
}: EditorialPlanTabProps) {
  const defaultMonth = new Date().getMonth() + 1;
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [weekCount, setWeekCount] = useState(4);
  const [campaignTheme, setCampaignTheme] = useState("");
  const [seasonalDraft, setSeasonalDraft] = useState("");
  const [seasonalEvents, setSeasonalEvents] = useState<string[]>(SEASONAL_SUGGESTIONS_BY_MONTH[defaultMonth] ?? []);
  const [weekThemeHints, setWeekThemeHints] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<PlatformConfigForm[]>(() =>
    brief.platforms.map((platform) => ({
      platform: platform.toLowerCase(),
      enabled: true,
      postsPerWeek: 2,
      preferredDays: ["lunedi", "mercoledi"],
      preferredTime: "09:00",
    })),
  );

  useEffect(() => {
    setPlatforms(
      brief.platforms.map((platform) => ({
        platform: platform.toLowerCase(),
        enabled: true,
        postsPerWeek: 2,
        preferredDays: ["lunedi", "mercoledi"],
        preferredTime: "09:00",
      })),
    );
  }, [brief.platforms.join("|")]);

  useEffect(() => {
    if (!campaignPrefill) return;
    if (campaignPrefill.theme) setCampaignTheme(campaignPrefill.theme);
    if (campaignPrefill.weekCount) setWeekCount(Math.max(1, Math.min(8, campaignPrefill.weekCount)));
    if (campaignPrefill.seasonalEvents?.length) setSeasonalEvents(campaignPrefill.seasonalEvents);
    if (campaignPrefill.weekThemes?.length) setWeekThemeHints(campaignPrefill.weekThemes);
    if (campaignPrefill.platformSuggestions?.length) {
      setPlatforms((prev) => prev.map((item) => {
        const suggestion = campaignPrefill.platformSuggestions?.find((entry) => entry.platform.toLowerCase() === item.platform.toLowerCase());
        if (!suggestion) return item;
        return {
          ...item,
          enabled: true,
          postsPerWeek: Math.max(0, Math.min(7, suggestion.postsPerWeek)),
        };
      }));
    }
  }, [campaignPrefill]);

  const totalPostsPerWeek = useMemo(
    () => platforms.filter((platform) => platform.enabled).reduce((sum, platform) => sum + platform.postsPerWeek, 0),
    [platforms],
  );

  const canGenerate = totalPostsPerWeek > 0;

  const toggleDay = (platformIndex: number, day: string) => {
    setPlatforms((prev) => prev.map((item, index) => {
      if (index !== platformIndex) return item;
      const exists = item.preferredDays.includes(day);
      const nextDays = exists ? item.preferredDays.filter((value) => value !== day) : [...item.preferredDays, day];
      return { ...item, preferredDays: nextDays };
    }));
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-card-border bg-card p-4 space-y-4">
        <h2 className="text-base font-semibold">Configurazione piano editoriale</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm">
            Data inizio piano
            <input type="date" className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <div className="text-sm">
            Durata piano
            <div className="mt-1 flex gap-2">
              {[1, 2, 3, 4].map((value) => (
                <button key={value} type="button" className={`rounded-lg px-3 py-2 text-xs ${weekCount === value ? "bg-violet-100 text-violet-700" : "bg-muted text-muted-foreground"}`} onClick={() => setWeekCount(value)}>
                  {value} settimana{value > 1 ? "e" : ""}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Post a settimana per piattaforma</p>
          <div className="space-y-3">
            {platforms.map((platform, index) => (
              <div key={platform.platform} className="rounded-lg border border-border bg-background p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-sm font-medium capitalize">
                    <Checkbox checked={platform.enabled} onCheckedChange={(checked) => setPlatforms((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, enabled: checked === true } : item))} />
                    {platform.platform}
                  </label>
                  <span className="ml-auto text-xs text-muted-foreground">{platform.postsPerWeek} post/settimana</span>
                </div>
                <div className="mt-2">
                  <Slider
                    value={[platform.postsPerWeek]}
                    min={0}
                    max={7}
                    step={1}
                    onValueChange={(value) => setPlatforms((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, postsPerWeek: value[0] ?? 0 } : item))}
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {DAYS.map((day) => (
                    <label key={day.id} className="flex items-center gap-1 text-xs">
                      <Checkbox checked={platform.preferredDays.includes(day.id)} onCheckedChange={() => toggleDay(index, day.id)} />
                      {day.label}
                    </label>
                  ))}
                </div>
                <label className="mt-2 block text-xs">
                  Ora preferita
                  <input type="time" className="mt-1 w-40 rounded-lg border border-input bg-background px-2 py-1.5 text-xs" value={platform.preferredTime} onChange={(event) => setPlatforms((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, preferredTime: event.target.value } : item))} />
                </label>
              </div>
            ))}
          </div>
        </div>

        <label className="block text-sm">
          Tema unificante campagna (opzionale)
          <input className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2" placeholder="Es. Primavera autentica" value={campaignTheme} onChange={(event) => setCampaignTheme(event.target.value)} />
        </label>

        {weekThemeHints.length > 0 && (
          <div className="rounded-lg border border-violet-200 bg-violet-50 p-2">
            <p className="text-xs font-semibold text-violet-700">Temi settimanali suggeriti da campagna</p>
            <div className="mt-1 grid grid-cols-1 gap-1 md:grid-cols-2">
              {Array.from({ length: weekCount }).map((_, index) => (
                <p key={`week-hint-${index}`} className="text-xs text-violet-900">
                  Settimana {index + 1}: {weekThemeHints[index] || weekThemeHints[weekThemeHints.length - 1]}
                </p>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="mb-1 text-sm">Eventi stagionali</p>
          <div className="mb-2 flex flex-wrap gap-1">
            {seasonalEvents.map((eventItem) => (
              <button key={eventItem} type="button" className="rounded-full bg-violet-100 px-2 py-1 text-xs text-violet-700" onClick={() => setSeasonalEvents((prev) => prev.filter((item) => item !== eventItem))}>
                {eventItem} x
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={seasonalDraft} onChange={(event) => setSeasonalDraft(event.target.value)} placeholder={`Es. ${MONTH_NAMES_IT[new Date(startDate).getMonth()]}`} />
            <button type="button" className="rounded-lg bg-secondary px-3 py-2 text-sm" onClick={() => {
              const value = seasonalDraft.trim();
              if (!value) return;
              setSeasonalEvents((prev) => (prev.includes(value) ? prev : [...prev, value]));
              setSeasonalDraft("");
            }}>
              Aggiungi
            </button>
          </div>
        </div>

        <button
          type="button"
          className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          disabled={!canGenerate || isLoading}
          onClick={async () => {
            const payload: PlanRequest = {
              clientId,
              brief,
              competitors,
              planConfig: {
                startDate,
                weekCount,
                postsPerWeek: totalPostsPerWeek,
                campaignTheme: campaignTheme.trim()
                  ? `${campaignTheme.trim()}${weekThemeHints.length > 0 ? ` | ${weekThemeHints.map((theme, index) => `W${index + 1}:${theme}`).join(" | ")}` : ""}`
                  : undefined,
                seasonalEvents,
                platforms: platforms
                  .filter((platform) => platform.enabled && platform.postsPerWeek > 0)
                  .map((platform) => ({
                    platform: platform.platform,
                    postsPerWeek: platform.postsPerWeek,
                    preferredDays: platform.preferredDays,
                    preferredTime: platform.preferredTime,
                  })),
              },
            };
            await onGeneratePlan(payload);
          }}
        >
          {isLoading ? "Generazione piano..." : "Genera piano"}
        </button>
      </section>

      {plan && (
        <PlanPreview
          plan={plan}
          onImportCalendar={(status) => onImportPlanToCalendar(plan, status)}
        />
      )}
    </div>
  );
}
