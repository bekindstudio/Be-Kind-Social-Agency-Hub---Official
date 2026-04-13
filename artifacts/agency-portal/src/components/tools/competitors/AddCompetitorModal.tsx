import { useEffect, useMemo, useState } from "react";
import { useClientContext } from "@/context/ClientContext";
import type { Competitor } from "@/types/client";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { useToast } from "@/hooks/use-toast";

interface AddCompetitorModalProps {
  open: boolean;
  onClose: () => void;
  competitor?: Competitor | null;
  initialName?: string;
}

type Platform = "instagram" | "facebook" | "linkedin" | "tiktok" | "x";

const PLATFORMS: Platform[] = ["instagram", "facebook", "linkedin", "tiktok", "x"];

function validUrl(raw: string): boolean {
  if (!raw.trim()) return true;
  return /^https?:\/\//i.test(raw.trim());
}

export function AddCompetitorModal({ open, onClose, competitor, initialName }: AddCompetitorModalProps) {
  const { activeClient, addCompetitor, updateCompetitor } = useClientContext();
  const { toast } = useToast();
  const editing = competitor != null;
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [profileUrl, setProfileUrl] = useState("");
  const [followers, setFollowers] = useState(0);
  const [engagementRate, setEngagementRate] = useState(0);
  const [postsPerWeek, setPostsPerWeek] = useState(0);
  const [isPrimary, setIsPrimary] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    if (competitor) {
      setName(competitor.name);
      setPlatform(competitor.platform);
      setProfileUrl(competitor.profileUrl ?? "");
      setFollowers(Math.max(0, competitor.followers ?? 0));
      setEngagementRate(Math.max(0, competitor.engagementRate ?? 0));
      setPostsPerWeek(Math.max(0, competitor.postsPerWeek ?? 0));
      setIsPrimary(Boolean(competitor.isPrimary));
      setNotes(competitor.notes ?? "");
      return;
    }
    setName(initialName ?? "");
    setPlatform("instagram");
    setProfileUrl("");
    setFollowers(0);
    setEngagementRate(0);
    setPostsPerWeek(0);
    setIsPrimary(false);
    setNotes("");
  }, [open, competitor, initialName]);

  const canSubmit = useMemo(() => {
    if (!name.trim()) return false;
    if (followers < 0 || !Number.isFinite(followers)) return false;
    if (engagementRate < 0 || engagementRate > 100 || !Number.isFinite(engagementRate)) return false;
    if (postsPerWeek < 0 || !Number.isFinite(postsPerWeek)) return false;
    if (!validUrl(profileUrl)) return false;
    return true;
  }, [name, followers, engagementRate, postsPerWeek, profileUrl]);

  if (!open) return null;

  const handleSubmit = () => {
    if (!activeClient || !canSubmit) return;
    const now = new Date().toISOString();
    if (!editing) {
      addCompetitor({
        clientId: activeClient.id,
        name: name.trim(),
        profileUrl: profileUrl.trim(),
        platform,
        followers: Math.round(followers),
        engagementRate: Number(engagementRate.toFixed(2)),
        postsPerWeek: Number(postsPerWeek.toFixed(2)),
        isPrimary,
        notes: notes.trim(),
        topContent: "",
        observedStrategy: "",
        strengths: [],
        weaknesses: [],
        updateHistory: [
          {
            date: now,
            followers: Math.round(followers),
            engagementRate: Number(engagementRate.toFixed(2)),
            postsPerWeek: Number(postsPerWeek.toFixed(2)),
            note: "Creazione competitor",
          },
        ],
        createdAt: now,
        updatedAt: now,
      });
      toast({ title: "Competitor aggiunto" });
      onClose();
      return;
    }

    updateCompetitor(competitor.id, {
      name: name.trim(),
      profileUrl: profileUrl.trim(),
      platform,
      followers: Math.round(followers),
      engagementRate: Number(engagementRate.toFixed(2)),
      postsPerWeek: Number(postsPerWeek.toFixed(2)),
      isPrimary,
      notes: notes.trim(),
    });
    toast({ title: "Competitor aggiornato" });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-xl rounded-xl border border-border bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold mb-4">{editing ? "Modifica competitor" : "Aggiungi competitor"}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground">Nome competitor *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full px-3 py-2 text-sm border border-input rounded-lg bg-background" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Piattaforma principale</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)} className="mt-1 w-full px-3 py-2 text-sm border border-input rounded-lg bg-background">
              {PLATFORMS.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <div className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs">
              <PlatformIcon platform={platform} size="sm" />
              <span className="uppercase">{platform}</span>
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground">URL profilo</label>
            <input value={profileUrl} onChange={(e) => setProfileUrl(e.target.value)} placeholder="https://..." className="mt-1 w-full px-3 py-2 text-sm border border-input rounded-lg bg-background" />
            {!validUrl(profileUrl) && <p className="mt-1 text-[11px] text-red-600">L'URL deve iniziare con http o https.</p>}
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Follower</label>
            <input type="number" min={0} value={followers} onChange={(e) => setFollowers(Math.max(0, Number(e.target.value) || 0))} className="mt-1 w-full px-3 py-2 text-sm border border-input rounded-lg bg-background" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Engagement rate %</label>
            <input type="number" min={0} max={100} step="0.1" value={engagementRate} onChange={(e) => setEngagementRate(Math.max(0, Number(e.target.value) || 0))} className="mt-1 w-full px-3 py-2 text-sm border border-input rounded-lg bg-background" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Post a settimana</label>
            <input type="number" min={0} value={postsPerWeek} onChange={(e) => setPostsPerWeek(Math.max(0, Number(e.target.value) || 0))} className="mt-1 w-full px-3 py-2 text-sm border border-input rounded-lg bg-background" />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setIsPrimary((prev) => !prev)}
              className={`inline-flex h-9 w-16 items-center rounded-full transition-colors ${isPrimary ? "bg-primary" : "bg-muted"}`}
              aria-label="Toggle competitor principale"
            >
              <span className={`inline-block h-7 w-7 rounded-full bg-white shadow transition-transform ${isPrimary ? "translate-x-8" : "translate-x-1"}`} />
            </button>
            <span className="ml-2 text-xs text-muted-foreground">Competitor principale</span>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground">Note iniziali</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 w-full px-3 py-2 text-sm border border-input rounded-lg bg-background resize-none" />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted">Annulla</button>
          <button onClick={handleSubmit} disabled={!canSubmit} className="px-3 py-2 text-sm rounded-lg bg-primary text-primary-foreground disabled:opacity-50">
            {editing ? "Salva modifiche" : "Aggiungi competitor"}
          </button>
        </div>
      </div>
    </div>
  );
}
