import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useClientContext } from "@/context/ClientContext";
import { useContentIdeas } from "@/hooks/useContentIdeas";
import { QuickIdeasTab } from "@/components/tools/ideas/QuickIdeasTab";
import { EditorialPlanTab } from "@/components/tools/ideas/EditorialPlanTab";
import { CampaignTab } from "@/components/tools/ideas/CampaignTab";
import { SavedIdeasPanel } from "@/components/tools/ideas/SavedIdeasPanel";
import { BulkAddIdeasModal } from "@/components/tools/ideas/BulkAddIdeasModal";
import type { CampaignToPlanPrefill, ContentIdea, IdeasRequest, PlanResponse } from "@/types/content-ideas";
import type { SocialPlatform } from "@/types/client";

type BulkSchedulePreset = "daily" | "weekdays" | "mon_wed_fri" | "custom_interval";

function splitCsv(value?: string): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildBulkDates(
  start: Date,
  count: number,
  preset: BulkSchedulePreset,
  dayInterval: number,
): Date[] {
  if (count <= 0) return [];

  const result: Date[] = [];
  if (preset === "daily") {
    for (let index = 0; index < count; index += 1) {
      const date = new Date(start);
      date.setDate(date.getDate() + index);
      result.push(date);
    }
    return result;
  }

  if (preset === "custom_interval") {
    for (let index = 0; index < count; index += 1) {
      const date = new Date(start);
      if (dayInterval > 0) {
        date.setDate(date.getDate() + index * dayInterval);
      } else {
        date.setMinutes(date.getMinutes() + index * 30);
      }
      result.push(date);
    }
    return result;
  }

  const allowedDays = preset === "weekdays" ? [1, 2, 3, 4, 5] : [1, 3, 5];
  const cursor = new Date(start);
  while (result.length < count) {
    if (allowedDays.includes(cursor.getDay())) {
      result.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

export default function ContentIdeasPage() {
  const { activeClient, brief, competitors, posts, addPost } = useClientContext();
  const { toast } = useToast();
  const ideasAi = useContentIdeas(activeClient?.id ?? "");
  const [activeTab, setActiveTab] = useState("quick");
  const [visibleIdeas, setVisibleIdeas] = useState<ContentIdea[]>([]);
  const [campaignPrefill, setCampaignPrefill] = useState<CampaignToPlanPrefill | null>(null);
  const [bulkModalState, setBulkModalState] = useState<{ open: boolean; ideas: ContentIdea[] }>({
    open: false,
    ideas: [],
  });

  useEffect(() => {
    setVisibleIdeas(ideasAi.ideas);
  }, [ideasAi.ideas]);

  useEffect(() => {
    setActiveTab("quick");
    setCampaignPrefill(null);
  }, [activeClient?.id]);

  const briefPayload = useMemo<IdeasRequest["brief"]>(() => {
    const industry = activeClient?.industry ?? brief?.industryOverride ?? "Generico";
    const topicsToAvoid = [
      ...(brief?.topicsToAvoid ?? []),
      ...posts.slice(0, 6).map((post) => post.title),
    ].join(", ");
    return {
      industry,
      objectives: brief?.primaryObjective || brief?.objectives || "Brand awareness e crescita community",
      targetAudience: brief?.targetAudience || "Target generale",
      toneOfVoice: brief?.toneOfVoice || brief?.toneOfVoiceType || "Amichevole",
      brandVoice: brief?.brandAdjectives?.length ? brief.brandAdjectives : splitCsv(brief?.brandVoice),
      platforms: (brief?.activePlatforms ?? ["instagram"]).map((platform) => platform.toLowerCase()),
      topicsToAvoid,
      topicsToTreat: brief?.topicsToCover ?? splitCsv(brief?.notes),
    };
  }, [activeClient?.industry, brief, posts]);

  const competitorsPayload = useMemo<IdeasRequest["competitors"]>(
    () => competitors.map((item) => ({
      name: item.name,
      observedStrategy: item.observedStrategy,
      strengths: item.strengths ?? [],
    })),
    [competitors],
  );

  const addIdeaToPlan = (payload: { title: string; scheduledDate: string; platform: SocialPlatform; caption: string; clientId: string }) => {
    addPost({
      clientId: payload.clientId,
      title: payload.title,
      caption: payload.caption,
      platform: payload.platform,
      status: "draft",
      scheduledDate: payload.scheduledDate,
      mediaUrls: [],
      hashtags: [],
      internalNotes: "Creato da Ideatore Contenuti AI",
    });
    toast({ title: "Post aggiunto al calendario" });
  };

  const addIdeasInBulk = (items: ContentIdea[], config: {
    baseDate: string;
    baseTime: string;
    dayInterval: number;
    schedulePreset: BulkSchedulePreset;
  }) => {
    const start = new Date(`${config.baseDate}T${config.baseTime}:00`);
    const dates = buildBulkDates(start, items.length, config.schedulePreset, config.dayInterval);
    items.forEach((idea, index) => {
      const date = dates[index] ?? start;
      addPost({
        clientId: activeClient?.id ?? "",
        title: idea.title,
        caption: idea.captionDraft || idea.description,
        platform: (idea.platform || "instagram").toLowerCase() as SocialPlatform,
        status: "draft",
        scheduledDate: date.toISOString(),
        mediaUrls: [],
        hashtags: idea.hashtags,
        internalNotes: "Bulk import da Ideatore Contenuti AI",
      });
    });
  };

  const importPlanPosts = (plan: PlanResponse, _status: "draft" | "approved"): number => {
    let count = 0;
    plan.weeks.forEach((week) => {
      week.posts.forEach((post) => {
        addPost({
          clientId: activeClient?.id ?? "",
          title: post.title,
          caption: post.caption,
          platform: (post.platform || "instagram").toLowerCase() as SocialPlatform,
          status: "draft",
          scheduledDate: post.scheduledDate,
          mediaUrls: [],
          hashtags: post.hashtags,
          internalNotes: `Import da piano AI - settimana ${week.weekNumber}`,
        });
        count += 1;
      });
    });
    return count;
  };

  if (!activeClient) {
    return (
      <Layout>
        <div className="p-8 text-sm text-muted-foreground">Seleziona un cliente per usare Ideatore Contenuti AI.</div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* TODO: generazione immagini AI per ogni idea direttamente dalla card. */}
      {/* TODO: integrazione trend Instagram/TikTok reali via API esterne. */}
      {/* TODO: scoring automatico idee basato su performance storiche cliente. */}
      <div className="space-y-4 p-4 md:p-8">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Ideatore Contenuti AI</h1>
          <p className="text-sm text-muted-foreground">
            Genera idee contenuto, campagne e piani editoriali completi partendo dal brief cliente, stagionalità e competitor.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Cliente attivo: {activeClient.name} · Token ultima generazione: {ideasAi.tokensUsed}
          </p>
          {ideasAi.error && <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">{ideasAi.error}</p>}
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="quick">Idee rapide</TabsTrigger>
            <TabsTrigger value="plan">Piano editoriale</TabsTrigger>
            <TabsTrigger value="campaign">Campagna</TabsTrigger>
          </TabsList>

          <TabsContent value="quick">
            <QuickIdeasTab
              clientId={activeClient.id}
              clientName={activeClient.name}
              brief={briefPayload}
              competitors={competitorsPayload}
              competitorsCount={competitorsPayload.length}
              ideas={visibleIdeas}
              isLoading={ideasAi.isLoading && ideasAi.loadingType === "ideas"}
              onGenerateIdeas={async (request) => {
                await ideasAi.generateIdeas(request);
              }}
              onSaveIdea={ideasAi.saveIdea}
              onDiscardIdea={(id) => setVisibleIdeas((prev) => prev.filter((idea) => idea.id !== id))}
              onAddAllToPlan={(items) => {
                if (items.length === 0) return;
                setBulkModalState({ open: true, ideas: items });
              }}
              onAddToPlan={addIdeaToPlan}
            />
          </TabsContent>

          <TabsContent value="plan">
            <EditorialPlanTab
              clientId={activeClient.id}
              brief={briefPayload}
              competitors={competitorsPayload}
              plan={ideasAi.plan}
              isLoading={ideasAi.isLoading && ideasAi.loadingType === "plan"}
              onGeneratePlan={ideasAi.generatePlan}
              onImportPlanToCalendar={importPlanPosts}
              campaignPrefill={campaignPrefill}
            />
          </TabsContent>

          <TabsContent value="campaign">
            <CampaignTab
              clientId={activeClient.id}
              brief={briefPayload}
              campaign={ideasAi.campaign}
              isLoading={ideasAi.isLoading && ideasAi.loadingType === "campaign"}
              onGenerateCampaign={ideasAi.generateCampaign}
              onTransformToPlan={(payload) => {
                setCampaignPrefill(payload);
                setActiveTab("plan");
                toast({ title: "Dati campagna passati al tab Piano editoriale" });
              }}
            />
          </TabsContent>
        </Tabs>
      </div>

      <SavedIdeasPanel
        savedIdeas={ideasAi.savedIdeas}
        onRemove={ideasAi.removeSavedIdea}
        onClear={() => ideasAi.replaceSavedIdeas([])}
        onReorder={ideasAi.replaceSavedIdeas}
        onAddAllToPlan={(items) => {
          if (items.length === 0) return;
          setBulkModalState({ open: true, ideas: items });
        }}
      />

      <BulkAddIdeasModal
        open={bulkModalState.open}
        ideas={bulkModalState.ideas}
        onClose={() => setBulkModalState({ open: false, ideas: [] })}
        onConfirm={(config) => {
          addIdeasInBulk(bulkModalState.ideas, config);
          toast({ title: `Importate ${bulkModalState.ideas.length} idee nel calendario` });
        }}
      />
    </Layout>
  );
}
