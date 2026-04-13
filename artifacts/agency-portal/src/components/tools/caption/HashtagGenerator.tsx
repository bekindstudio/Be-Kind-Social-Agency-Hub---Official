import { useState } from "react";
import type { HashtagResult } from "@/hooks/useCaptionAi";

interface HashtagGeneratorProps {
  industry: string;
  onGenerate: (params: { theme: string; industry: string; platform: "instagram" | "facebook" | "linkedin" | "tiktok"; count: number }) => Promise<HashtagResult | null>;
  onSaveToBrief: (hashtags: string[]) => void;
}

export function HashtagGenerator({ industry, onGenerate, onSaveToBrief }: HashtagGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState("");
  const [platform, setPlatform] = useState<"instagram" | "facebook" | "linkedin" | "tiktok">("instagram");
  const [count, setCount] = useState(20);
  const [result, setResult] = useState<HashtagResult | null>(null);
  const [loading, setLoading] = useState(false);

  const copy = async (items: string[]) => {
    await navigator.clipboard.writeText(items.join(" "));
  };

  return (
    <div className="rounded-xl border border-card-border bg-card p-3">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between text-sm font-semibold">
        Generatore hashtag
        <span className="text-xs text-muted-foreground">{open ? "Nascondi" : "Mostra"}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <input
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="Tema/settore"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <select value={platform} onChange={(e) => setPlatform(e.target.value as typeof platform)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm">
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="linkedin">LinkedIn</option>
              <option value="tiktok">TikTok</option>
            </select>
            <div className="rounded-lg border border-input bg-background px-3 py-2">
              <input type="range" min={10} max={30} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-full" />
              <p className="text-xs text-muted-foreground">{count} hashtag</p>
            </div>
          </div>
          <button
            onClick={async () => {
              if (!theme.trim()) return;
              setLoading(true);
              const payload = await onGenerate({ theme: theme.trim(), industry, platform, count });
              setResult(payload);
              setLoading(false);
            }}
            disabled={!theme.trim() || loading}
            className="w-full px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium disabled:opacity-60"
          >
            {loading ? "Generazione..." : "Genera hashtag"}
          </button>

          {result && (
            <div className="space-y-3">
              {Object.entries(result.categories).map(([category, tags]) => (
                <div key={category} className="rounded-lg border border-border p-2">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs uppercase text-muted-foreground">{category}</p>
                    <button onClick={() => copy(tags)} className="text-xs text-violet-700 underline">Copia gruppo</button>
                  </div>
                  <p className="text-xs text-foreground/80 break-words">{tags.join(" ")}</p>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <button onClick={() => copy(result.hashtags)} className="px-2.5 py-1.5 text-xs rounded-lg bg-violet-100 text-violet-700">Copia tutti</button>
                <button onClick={() => onSaveToBrief(result.hashtags)} className="px-2.5 py-1.5 text-xs rounded-lg bg-emerald-100 text-emerald-700">Salva nel brief</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
