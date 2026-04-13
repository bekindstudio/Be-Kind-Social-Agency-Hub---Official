import { useMemo, useState } from "react";
import type { CaptionHistoryItem, CaptionRequest } from "@/hooks/useCaptionAi";

interface CaptionHistoryProps {
  items: CaptionHistoryItem[];
  onReuse: (request: CaptionRequest) => void;
}

export function CaptionHistory({ items, onReuse }: CaptionHistoryProps) {
  const [platformFilter, setPlatformFilter] = useState<"all" | "instagram" | "facebook" | "linkedin" | "tiktok">("all");
  const [dateFilter, setDateFilter] = useState<"today" | "week" | "all">("all");

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (platformFilter !== "all" && item.request.postDetails.platform !== platformFilter) return false;
      if (dateFilter === "today") {
        return item.generatedAt.slice(0, 10) === new Date().toISOString().slice(0, 10);
      }
      if (dateFilter === "week") {
        return Date.now() - new Date(item.generatedAt).getTime() <= 7 * 24 * 60 * 60 * 1000;
      }
      return true;
    });
  }, [items, platformFilter, dateFilter]);

  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-card-border bg-card p-3 space-y-3">
      <h3 className="font-semibold">Storico caption</h3>
      <div className="flex flex-wrap gap-2">
        <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value as typeof platformFilter)} className="rounded-lg border border-input bg-background px-2 py-1 text-xs">
          <option value="all">Tutte piattaforme</option>
          <option value="instagram">Instagram</option>
          <option value="facebook">Facebook</option>
          <option value="linkedin">LinkedIn</option>
          <option value="tiktok">TikTok</option>
        </select>
        <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as typeof dateFilter)} className="rounded-lg border border-input bg-background px-2 py-1 text-xs">
          <option value="today">Oggi</option>
          <option value="week">Questa settimana</option>
          <option value="all">Tutto</option>
        </select>
      </div>
      <div className="space-y-2 max-h-80 overflow-auto pr-1">
        {filtered.map((item) => (
          <div key={item.id} className="rounded-lg border border-border p-3">
            <p className="text-sm font-medium">{item.request.postDetails.theme}</p>
            <p className="text-xs text-muted-foreground">
              {item.request.postDetails.platform} · {new Date(item.generatedAt).toLocaleString("it-IT")} · {item.variants.length} varianti
            </p>
            <p className="text-sm mt-2 line-clamp-2">{item.variants[0]?.caption ?? "Nessuna variante"}</p>
            <div className="mt-2 flex items-center gap-2">
              <button onClick={() => onReuse(item.request)} className="px-2.5 py-1 text-xs rounded-lg bg-secondary text-secondary-foreground">Riusa</button>
              <button
                onClick={async () => {
                  const best = item.variants[0];
                  if (!best) return;
                  const text = `${best.caption}\n\n${best.hashtags.join(" ")}`.trim();
                  await navigator.clipboard.writeText(text);
                }}
                className="px-2.5 py-1 text-xs rounded-lg bg-violet-100 text-violet-700"
              >
                Copia migliore
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
