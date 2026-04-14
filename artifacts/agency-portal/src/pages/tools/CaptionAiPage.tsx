import { useCallback, useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { useClientContext } from "@/context/ClientContext";
import { useToast } from "@/hooks/use-toast";
import { CaptionForm } from "@/components/tools/caption/CaptionForm";
import { CaptionResults } from "@/components/tools/caption/CaptionResults";
import { CaptionHistory } from "@/components/tools/caption/CaptionHistory";
import { fetchCaptionHistory, getCaptionHistory, useCaptionAi, type CaptionRequest } from "@/hooks/useCaptionAi";
import { getClientOperationalTemplateId, getOperationalTemplateById } from "@/lib/operationalTemplates";
import type { SocialPlatform } from "@/types/client";

function splitBrandVoice(value?: string): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
}

export default function CaptionAiPage() {
  const { activeClient, brief, addPost, updateBrief } = useClientContext();
  const { toast } = useToast();
  const captionAi = useCaptionAi(activeClient?.id ?? "");
  const [history, setHistory] = useState(() => getCaptionHistory(activeClient?.id ?? ""));
  const [form, setForm] = useState<CaptionRequest>({
    clientId: activeClient?.id ?? "",
    brief: {
      toneOfVoice: "",
      brandVoice: [],
      targetAudience: "",
      objectives: "",
      doNotSay: "",
      hashtags: [],
    },
    postDetails: {
      theme: "",
      contentType: "Post foto",
      objective: "Aumentare engagement",
      platform: "instagram",
      additionalNotes: "",
      keywords: [],
    },
    options: {
      length: "medium",
      includeHashtags: true,
      includeEmoji: true,
      language: "italian",
      variants: 3,
    },
  });

  const briefPayload = useMemo(
    () => ({
      toneOfVoice: brief?.toneOfVoice || brief?.toneOfVoiceType || "amichevole",
      brandVoice: brief?.brandAdjectives?.slice(0, 3) ?? splitBrandVoice(brief?.brandVoice),
      targetAudience: brief?.targetAudience || "target generale",
      objectives: brief?.primaryObjective || brief?.objectives || "brand awareness",
      doNotSay: brief?.brandDonts || "",
      hashtags: brief?.brandHashtags ?? brief?.hashtags ?? [],
    }),
    [brief],
  );

  const activeTemplate = useMemo(() => {
    if (!activeClient?.id) return null;
    const templateId = getClientOperationalTemplateId(activeClient.id);
    return getOperationalTemplateById(templateId);
  }, [activeClient?.id]);

  const loadHistory = useCallback(async () => {
    const items = await fetchCaptionHistory(activeClient?.id ?? "");
    setHistory(items);
  }, [activeClient?.id]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      clientId: activeClient?.id ?? "",
      brief: briefPayload,
      postDetails: {
        ...prev.postDetails,
        objective: activeTemplate?.captionStyle.defaultObjective ?? prev.postDetails.objective,
        additionalNotes: activeTemplate
          ? [prev.postDetails.additionalNotes ?? "", `Tone hint: ${activeTemplate.captionStyle.toneHint}`]
              .filter(Boolean)
              .join(" · ")
          : prev.postDetails.additionalNotes,
        keywords: activeTemplate?.captionStyle.keywordHints ?? prev.postDetails.keywords,
      },
      options: {
        ...prev.options,
        length: activeTemplate?.captionStyle.defaultLength ?? prev.options.length,
        includeEmoji: activeTemplate?.captionStyle.includeEmoji ?? prev.options.includeEmoji,
        includeHashtags: activeTemplate?.captionStyle.includeHashtags ?? prev.options.includeHashtags,
      },
    }));
    try {
      const raw = sessionStorage.getItem("agency_hub_caption_prefill");
      if (raw) {
        const parsed = JSON.parse(raw) as {
          theme?: string;
          description?: string;
          platform?: string;
          contentType?: string;
        };
        setForm((prev) => ({
          ...prev,
          postDetails: {
            ...prev.postDetails,
            theme: parsed.theme || parsed.description || prev.postDetails.theme,
            platform: (parsed.platform?.toLowerCase() as CaptionRequest["postDetails"]["platform"]) || prev.postDetails.platform,
            contentType: parsed.contentType || prev.postDetails.contentType,
          },
        }));
        sessionStorage.removeItem("agency_hub_caption_prefill");
      }
    } catch {
      sessionStorage.removeItem("agency_hub_caption_prefill");
    }
    captionAi.clearVariants();
    void loadHistory();
  }, [activeClient?.id, briefPayload.toneOfVoice, activeTemplate?.id]);

  return (
    <Layout>
      {/* TODO: add image generation assistant (DALL-E / Ideogram) from the same post brief. */}
      {/* TODO: add direct scheduling on Meta API after caption approval. */}
      {/* TODO: add A/B caption tests linked to analytics outcomes. */}
      <div className="p-4 md:p-8 space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Generatore Caption AI</h1>
          <p className="text-sm text-muted-foreground">
            Genera caption ottimizzate con Claude usando automaticamente il brief cliente attivo.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Generazioni oggi: {captionAi.generationsToday} · Token ultima generazione: {captionAi.tokensUsed}
          </p>
          {activeTemplate && (
            <p className="text-xs text-violet-700 mt-1">
              Template attivo: {activeTemplate.label} · stile suggerito applicato automaticamente.
            </p>
          )}
        </div>

        {captionAi.error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{captionAi.error}</div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-4 items-start">
          <aside className="space-y-4">
            <CaptionForm
              values={form}
              onChange={setForm}
              brief={brief}
              isLoading={captionAi.isLoading}
              onGenerate={async () => {
                const payload: CaptionRequest = {
                  ...form,
                  clientId: activeClient?.id ?? "",
                  brief: briefPayload,
                };
                await captionAi.generate(payload);
                await loadHistory();
              }}
              onGenerateHashtags={captionAi.generateHashtags}
              onSaveHashtagsToBrief={(hashtags) => {
                updateBrief({
                  brandHashtags: hashtags,
                  hashtags,
                });
                toast({ title: "Hashtag salvati nel brief" });
              }}
            />
            <CaptionHistory
              items={history}
              onReuse={(request) => {
                setForm(request);
                toast({ title: "Template ricaricato", description: "Parametri caricati dallo storico caption." });
              }}
            />
          </aside>

          <section>
            <CaptionResults
              variants={captionAi.variants}
              bestVariantId={captionAi.bestVariantId}
              selectedPlatform={form.postDetails.platform}
              theme={form.postDetails.theme}
              clientId={activeClient?.id ?? ""}
              brief={briefPayload}
              onUseExample={(theme) => setForm((prev) => ({ ...prev, postDetails: { ...prev.postDetails, theme } }))}
              onUpdateVariant={(id, updates) => {
                const next = captionAi.variants.map((variant) => (variant.id === id ? { ...variant, ...updates } : variant));
                captionAi.replaceVariants(next);
              }}
              onImprove={captionAi.improve}
              onAddToPlan={({ title, scheduledDate, platform, caption, clientId }) => {
                addPost({
                  clientId,
                  title,
                  caption,
                  platform: platform as SocialPlatform,
                  status: "draft",
                  scheduledDate,
                  mediaUrls: [],
                  hashtags: [],
                  internalNotes: "",
                });
                toast({ title: "Post aggiunto al calendario", description: `Pianificato per ${new Date(scheduledDate).toLocaleString("it-IT")}` });
              }}
            />
          </section>
        </div>
      </div>
    </Layout>
  );
}
