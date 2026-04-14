import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { SeasonalCalendar } from "@/components/tools/ideas/SeasonalCalendar";
import { IdeasResultsPanel } from "@/components/tools/ideas/IdeasResultsPanel";
import { MONTH_NAMES_IT, SEASONAL_SUGGESTIONS_BY_MONTH } from "@/components/tools/ideas/constants";
import type { ContentIdea, IdeasRequest } from "@/types/content-ideas";
import type { SocialPlatform } from "@/types/client";

type MixKey = "reels" | "carousels" | "photos" | "stories";

const MIX_LABELS: Record<MixKey, string> = {
  reels: "Reel",
  carousels: "Carosello",
  photos: "Foto",
  stories: "Stories",
};

function redistributeMix(previous: Record<MixKey, number>, changedKey: MixKey, nextValue: number): Record<MixKey, number> {
  const clamped = Math.max(0, Math.min(100, Math.round(nextValue)));
  const otherKeys = (Object.keys(previous) as MixKey[]).filter((key) => key !== changedKey);
  const remaining = 100 - clamped;
  const currentOtherTotal = otherKeys.reduce((sum, key) => sum + previous[key], 0);

  const result: Record<MixKey, number> = { ...previous, [changedKey]: clamped };
  if (otherKeys.length === 0) return result;

  if (currentOtherTotal <= 0) {
    const even = Math.floor(remaining / otherKeys.length);
    otherKeys.forEach((key) => {
      result[key] = even;
    });
  } else {
    otherKeys.forEach((key) => {
      result[key] = Math.round((previous[key] / currentOtherTotal) * remaining);
    });
  }

  const diff = 100 - (result.reels + result.carousels + result.photos + result.stories);
  if (diff !== 0) {
    result[otherKeys[0]] = Math.max(0, Math.min(100, result[otherKeys[0]] + diff));
  }
  return result;
}

interface QuickIdeasTabProps {
  clientId: string;
  clientName: string;
  brief: IdeasRequest["brief"];
  competitors: IdeasRequest["competitors"];
  competitorsCount: number;
  ideas: ContentIdea[];
  isLoading: boolean;
  onGenerateIdeas: (request: IdeasRequest) => Promise<void>;
  onSaveIdea: (idea: ContentIdea) => void;
  onDiscardIdea: (id: string) => void;
  onAddAllToPlan: (ideas: ContentIdea[]) => void;
  onAddToPlan: (payload: { title: string; scheduledDate: string; platform: SocialPlatform; caption: string; clientId: string }) => void;
}

export function QuickIdeasTab({
  clientId,
  clientName,
  brief,
  competitors,
  competitorsCount,
  ideas,
  isLoading,
  onGenerateIdeas,
  onSaveIdea,
  onDiscardIdea,
  onAddAllToPlan,
  onAddToPlan,
}: QuickIdeasTabProps) {
  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [periodMonth, setPeriodMonth] = useState(defaultPeriod);
  const [seasonalEvents, setSeasonalEvents] = useState<string[]>(SEASONAL_SUGGESTIONS_BY_MONTH[now.getMonth() + 1] ?? []);
  const [seasonalDraft, setSeasonalDraft] = useState("");
  const [campaignObjective, setCampaignObjective] = useState("");
  const [focusPlatform, setFocusPlatform] = useState("all");
  const [weekCount, setWeekCount] = useState(4);
  const [postsPerWeek, setPostsPerWeek] = useState(4);
  const [contentMix, setContentMix] = useState<Record<MixKey, number>>({
    reels: 30,
    carousels: 30,
    photos: 20,
    stories: 20,
  });
  const [ideaCount, setIdeaCount] = useState(10);
  const [creativityLevel, setCreativityLevel] = useState<"safe" | "balanced" | "bold">("balanced");
  const [includeCaption, setIncludeCaption] = useState(true);
  const [includeCTA, setIncludeCTA] = useState(true);
  const [lastRequest, setLastRequest] = useState<IdeasRequest | null>(null);

  const monthNumber = Number(periodMonth.split("-")[1] ?? now.getMonth() + 1);
  const year = Number(periodMonth.split("-")[0] ?? now.getFullYear());
  const monthLabel = `${MONTH_NAMES_IT[Math.max(0, monthNumber - 1)]} ${year}`;

  const totalMix = contentMix.reels + contentMix.carousels + contentMix.photos + contentMix.stories;
  const isValid = campaignObjective.trim().length > 4 && totalMix === 100;

  const request = useMemo<IdeasRequest>(() => ({
    clientId,
    brief,
    competitors,
    context: {
      period: monthLabel,
      seasonalEvents,
      campaignObjective,
      focusPlatform: focusPlatform === "all" ? undefined : focusPlatform,
      contentMix,
      weekCount,
      postsPerWeek,
    },
    options: {
      count: ideaCount,
      includeCaption,
      includeCTA,
      language: "italian",
      creativityLevel,
    },
  }), [
    brief,
    campaignObjective,
    clientId,
    competitors,
    contentMix,
    creativityLevel,
    focusPlatform,
    ideaCount,
    includeCTA,
    includeCaption,
    monthLabel,
    postsPerWeek,
    seasonalEvents,
    weekCount,
  ]);

  const addEvent = (value: string) => {
    const next = value.trim();
    if (!next) return;
    if (!seasonalEvents.includes(next)) setSeasonalEvents((prev) => [...prev, next]);
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[430px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <section className="rounded-xl border border-card-border bg-card p-4 space-y-4">
          <h2 className="text-base font-semibold">Contesto</h2>
          <label className="block text-sm">
            Periodo di riferimento
            <input
              type="month"
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2"
              value={periodMonth}
              onChange={(event) => {
                setPeriodMonth(event.target.value);
                const nextMonth = Number(event.target.value.split("-")[1] ?? now.getMonth() + 1);
                setSeasonalEvents(SEASONAL_SUGGESTIONS_BY_MONTH[nextMonth] ?? []);
              }}
            />
          </label>
          <div>
            <p className="mb-1 text-sm">Eventi stagionali</p>
            <div className="mb-2 flex flex-wrap gap-1">
              {seasonalEvents.map((eventItem) => (
                <button key={eventItem} type="button" onClick={() => setSeasonalEvents((prev) => prev.filter((item) => item !== eventItem))} className="rounded-full bg-violet-100 px-2 py-1 text-xs text-violet-700">
                  {eventItem} x
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                value={seasonalDraft}
                onChange={(event) => setSeasonalDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addEvent(seasonalDraft);
                    setSeasonalDraft("");
                  }
                }}
                placeholder="Aggiungi evento stagionale"
              />
              <button type="button" className="rounded-lg bg-secondary px-3 py-2 text-sm" onClick={() => {
                addEvent(seasonalDraft);
                setSeasonalDraft("");
              }}>
                Aggiungi
              </button>
            </div>
          </div>
          <label className="block text-sm">
            Obiettivo campagna
            <textarea
              rows={3}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 resize-none"
              value={campaignObjective}
              onChange={(event) => setCampaignObjective(event.target.value)}
              placeholder="Es. aumentare prenotazioni weekend con format informativi e UGC"
            />
          </label>
          <label className="block text-sm">
            Piattaforma focus
            <select className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2" value={focusPlatform} onChange={(event) => setFocusPlatform(event.target.value)}>
              <option value="all">Tutte</option>
              {brief.platforms.map((platform) => (
                <option key={platform} value={platform.toLowerCase()}>
                  {platform}
                </option>
              ))}
            </select>
          </label>
        </section>

        <SeasonalCalendar month={monthNumber} year={year} onSelectEvent={addEvent} />

        <section className="rounded-xl border border-card-border bg-card p-4 space-y-3">
          <h2 className="text-base font-semibold">Mix contenuti</h2>
          {(Object.keys(contentMix) as MixKey[]).map((key) => (
            <div key={key}>
              <p className="mb-1 flex items-center justify-between text-xs">
                <span>{MIX_LABELS[key]}</span>
                <strong>{contentMix[key]}%</strong>
              </p>
              <Slider value={[contentMix[key]]} min={0} max={100} step={1} onValueChange={(value) => setContentMix((prev) => redistributeMix(prev, key, value[0] ?? 0))} />
            </div>
          ))}
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-violet-500" style={{ width: `${contentMix.reels}%`, float: "left" }} />
            <div className="h-full bg-sky-500" style={{ width: `${contentMix.carousels}%`, float: "left" }} />
            <div className="h-full bg-emerald-500" style={{ width: `${contentMix.photos}%`, float: "left" }} />
            <div className="h-full bg-amber-500" style={{ width: `${contentMix.stories}%`, float: "left" }} />
          </div>
          <p className={`text-xs ${totalMix === 100 ? "text-emerald-600" : "text-rose-600"}`}>Totale mix: {totalMix}%</p>
        </section>

        <section className="rounded-xl border border-card-border bg-card p-4 space-y-3">
          <h2 className="text-base font-semibold">Opzioni</h2>
          <p className="text-xs">Numero idee: {ideaCount}</p>
          <Slider value={[ideaCount]} min={5} max={20} step={1} onValueChange={(value) => setIdeaCount(value[0] ?? 10)} />
          <p className="text-xs">Frequenza: {postsPerWeek} post / settimana</p>
          <Slider value={[postsPerWeek]} min={1} max={7} step={1} onValueChange={(value) => setPostsPerWeek(value[0] ?? 4)} />
          <p className="text-xs">Durata: {weekCount} settimane</p>
          <Slider value={[weekCount]} min={1} max={8} step={1} onValueChange={(value) => setWeekCount(value[0] ?? 4)} />
          <div className="flex gap-2">
            {([
              { key: "safe", label: "Sicuro", desc: "Format classici e collaudati" },
              { key: "balanced", label: "Bilanciato", desc: "Mix di idee affidabili e originali" },
              { key: "bold", label: "Audace", desc: "Approcci creativi e fuori schema" },
            ] as const).map((item) => (
              <button
                key={item.key}
                type="button"
                className={`flex-1 rounded-lg border px-2 py-2 text-left text-xs ${creativityLevel === item.key ? "border-violet-400 bg-violet-50 text-violet-700" : "border-border"}`}
                onClick={() => setCreativityLevel(item.key)}
              >
                <strong className="block">{item.label}</strong>
                <span>{item.desc}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Includi bozza caption</span>
            <Switch checked={includeCaption} onCheckedChange={setIncludeCaption} />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Includi CTA</span>
            <Switch checked={includeCTA} onCheckedChange={setIncludeCTA} />
          </div>
        </section>

        <Accordion type="single" collapsible defaultValue="brief" className="rounded-xl border border-card-border bg-card px-4">
          <AccordionItem value="brief" className="border-0">
            <AccordionTrigger className="py-3">Brief attivo</AccordionTrigger>
            <AccordionContent className="space-y-1 text-xs text-muted-foreground">
              <p><strong className="text-foreground">Settore:</strong> {brief.industry}</p>
              <p><strong className="text-foreground">Obiettivi:</strong> {brief.objectives}</p>
              <p><strong className="text-foreground">Target:</strong> {brief.targetAudience}</p>
              <p><strong className="text-foreground">Tone:</strong> {brief.toneOfVoice}</p>
              <p><strong className="text-foreground">Topic da trattare:</strong> {brief.topicsToTreat.join(", ") || "N/D"}</p>
              <p><strong className="text-foreground">Topic da evitare:</strong> {brief.topicsToAvoid || "N/D"}</p>
              {competitorsCount > 0 && <p className="text-violet-700">Sto considerando {competitorsCount} competitor nella generazione delle idee.</p>}
              {brief.objectives.length < 3 && (
                <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-700">
                  Brief incompleto. <Link href="/tools/brief" className="underline">Apri brief</Link>
                </p>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <button
          type="button"
          className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          disabled={isLoading || !isValid}
          onClick={async () => {
            setLastRequest(request);
            await onGenerateIdeas(request);
          }}
        >
          {isLoading ? "Generazione in corso..." : "Genera idee"}
        </button>
      </aside>

      <IdeasResultsPanel
        ideas={ideas}
        clientName={clientName}
        period={monthLabel}
        isLoading={isLoading}
        clientId={clientId}
        onSaveIdea={onSaveIdea}
        onDiscardIdea={onDiscardIdea}
        onRegenerate={async () => {
          if (!lastRequest) return;
          await onGenerateIdeas(lastRequest);
        }}
        onAddAllToPlan={onAddAllToPlan}
        onAddToPlan={onAddToPlan}
      />
    </div>
  );
}
