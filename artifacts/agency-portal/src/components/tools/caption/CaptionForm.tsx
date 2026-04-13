import { useState } from "react";
import { Link } from "wouter";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { HashtagGenerator } from "./HashtagGenerator";
import type { CaptionRequest, HashtagResult } from "@/hooks/useCaptionAi";
import type { ClientBrief } from "@/types/client";

interface CaptionFormProps {
  values: CaptionRequest;
  onChange: (next: CaptionRequest) => void;
  onGenerate: () => void;
  isLoading: boolean;
  brief: ClientBrief | null;
  onGenerateHashtags: (params: { theme: string; industry: string; platform: "instagram" | "facebook" | "linkedin" | "tiktok"; count: number }) => Promise<HashtagResult | null>;
  onSaveHashtagsToBrief: (hashtags: string[]) => void;
}

const PLATFORM_HELP: Record<string, string> = {
  instagram: "Hook entro le prime 2 righe · Usa line break · Max 30 hashtag",
  facebook: "Caption piu lunga · Call to action esplicita · Meno hashtag",
  linkedin: "Apri con insight · Aggiungi valore · Tono professionale",
  tiktok: "Brevissima · Hook nei primi 3 secondi · Max 5 hashtag",
};

const CONTENT_TYPES = ["Post foto", "Carosello", "Reel", "Stories", "Video", "Articolo"];
const OBJECTIVES = [
  "Aumentare engagement",
  "Brand awareness",
  "Promuovere prodotto/servizio",
  "Educare il pubblico",
  "Generare traffico",
  "Raccogliere UGC",
];

export function CaptionForm({ values, onChange, onGenerate, isLoading, brief, onGenerateHashtags, onSaveHashtagsToBrief }: CaptionFormProps) {
  const [keywordDraft, setKeywordDraft] = useState("");
  const [showBrief, setShowBrief] = useState(true);

  const missingBrief = !brief || !brief.toneOfVoice || !(brief.brandAdjectives?.length || brief.brandVoice);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-card-border bg-card p-4 space-y-3">
        <h2 className="font-semibold">Dettagli post</h2>
        <label className="block text-sm">
          Tema del post
          <textarea
            value={values.postDetails.theme}
            onChange={(e) => onChange({ ...values, postDetails: { ...values.postDetails, theme: e.target.value } })}
            placeholder="es. Lancio menu estivo con piatti freschi e leggeri"
            rows={4}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 resize-none"
          />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="block text-sm">
            Tipo contenuto
            <select
              value={values.postDetails.contentType}
              onChange={(e) => onChange({ ...values, postDetails: { ...values.postDetails, contentType: e.target.value } })}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2"
            >
              {CONTENT_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            Obiettivo
            <select
              value={values.postDetails.objective}
              onChange={(e) => onChange({ ...values, postDetails: { ...values.postDetails, objective: e.target.value } })}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2"
            >
              {OBJECTIVES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
        <label className="block text-sm">
          Note aggiuntive
          <textarea
            value={values.postDetails.additionalNotes ?? ""}
            onChange={(e) => onChange({ ...values, postDetails: { ...values.postDetails, additionalNotes: e.target.value } })}
            placeholder="es. Menziona la promozione del 20% valida fino a domenica"
            rows={3}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 resize-none"
          />
        </label>
        <div className="space-y-2">
          <p className="text-sm">Parole chiave da includere</p>
          <div className="flex flex-wrap gap-2">
            {(values.postDetails.keywords ?? []).map((keyword) => (
              <button
                key={keyword}
                onClick={() =>
                  onChange({
                    ...values,
                    postDetails: { ...values.postDetails, keywords: (values.postDetails.keywords ?? []).filter((item) => item !== keyword) },
                  })
                }
                className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700"
              >
                {keyword} ×
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={keywordDraft}
              onChange={(e) => setKeywordDraft(e.target.value)}
              placeholder="Aggiungi keyword"
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
            <button
              onClick={() => {
                const next = keywordDraft.trim();
                if (!next) return;
                const keywords = values.postDetails.keywords ?? [];
                if (!keywords.includes(next)) {
                  onChange({ ...values, postDetails: { ...values.postDetails, keywords: [...keywords, next] } });
                }
                setKeywordDraft("");
              }}
              className="px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm"
            >
              Aggiungi
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-card-border bg-card p-4 space-y-3">
        <h2 className="font-semibold">Piattaforma</h2>
        <div className="grid grid-cols-2 gap-2">
          {(["instagram", "facebook", "linkedin", "tiktok"] as const).map((platform) => {
            const active = values.postDetails.platform === platform;
            return (
              <button
                key={platform}
                onClick={() => onChange({ ...values, postDetails: { ...values.postDetails, platform } })}
                className={`rounded-lg border p-3 text-sm flex items-center gap-2 ${active ? "border-violet-400 bg-violet-50" : "border-input bg-background"}`}
              >
                <PlatformIcon platform={platform} />
                <span className="capitalize">{platform}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">{PLATFORM_HELP[values.postDetails.platform]}</p>
      </section>

      <section className="rounded-xl border border-card-border bg-card p-4 space-y-3">
        <h2 className="font-semibold">Opzioni generazione</h2>
        <div className="flex gap-2">
          {(["short", "medium", "long"] as const).map((size) => (
            <button
              key={size}
              onClick={() => onChange({ ...values, options: { ...values.options, length: size } })}
              className={`px-3 py-1.5 rounded-full text-xs ${values.options.length === size ? "bg-violet-100 text-violet-700" : "bg-muted text-muted-foreground"}`}
            >
              {size === "short" ? "Breve" : size === "medium" ? "Media" : "Lunga"}
            </button>
          ))}
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Numero varianti: {values.options.variants}</p>
          <input
            type="range"
            min={1}
            max={3}
            value={values.options.variants}
            onChange={(e) => onChange({ ...values, options: { ...values.options, variants: Number(e.target.value) } })}
            className="w-full"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.options.includeHashtags}
            onChange={(e) => onChange({ ...values, options: { ...values.options, includeHashtags: e.target.checked } })}
          />
          Includi hashtag
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={values.options.includeEmoji} onChange={(e) => onChange({ ...values, options: { ...values.options, includeEmoji: e.target.checked } })} />
          Includi emoji
        </label>
        <div className="flex gap-2">
          {(["italian", "english"] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => onChange({ ...values, options: { ...values.options, language: lang } })}
              className={`px-3 py-1.5 rounded-full text-xs ${values.options.language === lang ? "bg-violet-100 text-violet-700" : "bg-muted text-muted-foreground"}`}
            >
              {lang === "italian" ? "Italiano" : "Inglese"}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-card-border bg-card p-4 space-y-2">
        <button onClick={() => setShowBrief((v) => !v)} className="w-full flex items-center justify-between text-sm font-semibold">
          Brief attivo
          <span className="text-xs text-muted-foreground">{showBrief ? "Nascondi" : "Mostra"}</span>
        </button>
        {missingBrief && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
            Brief incompleto - alcune informazioni mancano. Completa il brief per risultati migliori.{" "}
            <Link href="/tools/brief" className="underline font-semibold">Apri brief</Link>
          </div>
        )}
        {showBrief && (
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong className="text-foreground">Tone:</strong> {brief?.toneOfVoice || brief?.toneOfVoiceType || "N/D"}</p>
            <p><strong className="text-foreground">Brand voice:</strong> {brief?.brandAdjectives?.join(", ") || brief?.brandVoice || "N/D"}</p>
            <p className="line-clamp-2"><strong className="text-foreground">Target:</strong> {brief?.targetAudience || "N/D"}</p>
          </div>
        )}
      </section>

      <button
        onClick={onGenerate}
        disabled={!values.postDetails.theme.trim() || !values.postDetails.platform || isLoading}
        className="w-full px-4 py-3 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-60"
      >
        {isLoading ? "Generazione in corso..." : "Genera caption"}
      </button>

      <HashtagGenerator
        industry={brief?.industryOverride || "Generico"}
        onGenerate={onGenerateHashtags}
        onSaveToBrief={onSaveHashtagsToBrief}
      />
    </div>
  );
}
