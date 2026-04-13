import { useMemo, useState } from "react";
import { useClientContext } from "@/context/ClientContext";
import type { Competitor } from "@/types/client";
import { useToast } from "@/hooks/use-toast";

interface MetricsUpdateFormProps {
  competitor: Competitor;
  onClose: () => void;
}

export function MetricsUpdateForm({ competitor, onClose }: MetricsUpdateFormProps) {
  const { updateCompetitor } = useClientContext();
  const { toast } = useToast();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [followers, setFollowers] = useState<number>(Math.max(0, Number(competitor.followers ?? 0)));
  const [engagementRate, setEngagementRate] = useState<number>(Math.max(0, Number(competitor.engagementRate ?? 0)));
  const [postsPerWeek, setPostsPerWeek] = useState<number>(Math.max(0, Number(competitor.postsPerWeek ?? 0)));
  const [date, setDate] = useState<string>(today);
  const [note, setNote] = useState<string>("");

  const handleSave = () => {
    if (!Number.isFinite(followers) || followers < 0) return;
    if (!Number.isFinite(engagementRate) || engagementRate < 0 || engagementRate > 100) return;
    if (!Number.isFinite(postsPerWeek) || postsPerWeek < 0) return;

    const historyEntry = {
      date: new Date(`${date}T00:00:00`).toISOString(),
      followers: Math.round(followers),
      engagementRate: Number(engagementRate.toFixed(2)),
      postsPerWeek: Number(postsPerWeek.toFixed(2)),
      note: note.trim() || undefined,
    };

    updateCompetitor(competitor.id, {
      followersPrevious: competitor.followers,
      followers: Math.round(followers),
      engagementRate: Number(engagementRate.toFixed(2)),
      postsPerWeek: Number(postsPerWeek.toFixed(2)),
      updateHistory: [...(competitor.updateHistory ?? []), historyEntry],
    });
    toast({ title: "Metriche aggiornate" });
    onClose();
  };

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Aggiorna metriche</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input
          type="number"
          min={0}
          value={followers}
          onChange={(e) => setFollowers(Math.max(0, Number(e.target.value) || 0))}
          className="px-3 py-2 text-sm border border-input rounded-lg bg-background"
          placeholder="Follower"
        />
        <input
          type="number"
          min={0}
          max={100}
          step="0.1"
          value={engagementRate}
          onChange={(e) => setEngagementRate(Math.max(0, Number(e.target.value) || 0))}
          className="px-3 py-2 text-sm border border-input rounded-lg bg-background"
          placeholder="Engagement %"
        />
        <input
          type="number"
          min={0}
          value={postsPerWeek}
          onChange={(e) => setPostsPerWeek(Math.max(0, Number(e.target.value) || 0))}
          className="px-3 py-2 text-sm border border-input rounded-lg bg-background"
          placeholder="Post/settimana"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-3 py-2 text-sm border border-input rounded-lg bg-background"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="px-3 py-2 text-sm border border-input rounded-lg bg-background"
          placeholder="Note aggiornamento (opzionale)"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted">
          Annulla
        </button>
        <button onClick={handleSave} className="px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:opacity-90">
          Salva metriche
        </button>
      </div>
    </div>
  );
}
