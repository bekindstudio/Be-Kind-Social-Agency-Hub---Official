import { useMemo, useState } from "react";
import type { EditorialPost, SocialPlatform } from "@/types/client";
import { PlatformIcon } from "@/components/shared/PlatformIcon";

interface NewPostModalProps {
  open: boolean;
  initialDate: Date;
  onClose: () => void;
  onCreate: (input: Omit<EditorialPost, "id" | "createdAt" | "updatedAt">) => EditorialPost;
  clientId: string;
  onCreated: (post: EditorialPost) => void;
}

const platforms: SocialPlatform[] = ["instagram", "facebook", "linkedin", "tiktok", "x", "youtube"];

function datePart(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function NewPostModal({ open, initialDate, onClose, onCreate, clientId, onCreated }: NewPostModalProps) {
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState<SocialPlatform>("instagram");
  const [date, setDate] = useState(datePart(initialDate));
  const [time, setTime] = useState("09:00");
  const [caption, setCaption] = useState("");

  const canSubmit = useMemo(() => title.trim().length > 0 && date.length > 0 && time.length > 0, [title, date, time]);

  if (!open) return null;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const scheduledDate = new Date(`${date}T${time}:00`).toISOString();
    const post = onCreate({
      clientId,
      title: title.trim(),
      caption: caption.trim(),
      platform,
      status: "draft",
      scheduledDate,
      mediaUrls: [],
      hashtags: [],
    });
    onCreated(post);
    setTitle("");
    setCaption("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5">
        <h3 className="text-base font-semibold">Nuovo post</h3>
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Titolo *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Piattaforma *</label>
            <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {platforms.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPlatform(item)}
                  className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs ${platform === item ? "border-primary bg-primary/10 text-primary" : "border-input"}`}
                >
                  <PlatformIcon platform={item} size="sm" />
                  <span className="capitalize">{item}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Data *</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Ora *</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Caption</label>
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" rows={4} />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-input px-3 py-2 text-xs font-medium">Annulla</button>
          <button type="button" onClick={handleSubmit} disabled={!canSubmit} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
            Crea post
          </button>
        </div>
      </div>
    </div>
  );
}
