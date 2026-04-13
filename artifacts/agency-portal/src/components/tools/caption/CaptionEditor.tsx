import { useMemo, useState } from "react";

interface CaptionEditorProps {
  initialCaption: string;
  initialHashtags: string[];
  platform: string;
  onSave: (payload: { caption: string; hashtags: string[] }) => void;
  onCancel: () => void;
}

const PLATFORM_LIMITS: Record<string, number> = {
  instagram: 2200,
  facebook: 63206,
  linkedin: 3000,
  tiktok: 2200,
};

export function CaptionEditor({ initialCaption, initialHashtags, platform, onSave, onCancel }: CaptionEditorProps) {
  const [caption, setCaption] = useState(initialCaption);
  const [hashtags, setHashtags] = useState(initialHashtags);
  const [newTag, setNewTag] = useState("");
  const limit = PLATFORM_LIMITS[platform] ?? 2200;
  const colorClass = useMemo(() => {
    if (caption.length > limit) return "text-rose-600";
    if (caption.length > limit * 0.8) return "text-amber-600";
    return "text-emerald-600";
  }, [caption.length, limit]);

  return (
    <div className="mt-3 rounded-lg border border-input bg-background p-3 space-y-3">
      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        rows={6}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none"
      />
      <p className={`text-xs font-medium ${colorClass}`}>{caption.length}/{limit}</p>

      <div className="flex flex-wrap gap-2">
        {hashtags.map((tag) => (
          <button
            key={tag}
            onClick={() => setHashtags((prev) => prev.filter((item) => item !== tag))}
            className="px-2 py-1 text-xs rounded-full bg-violet-100 text-violet-700"
          >
            {tag} ×
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          placeholder="#hashtag"
          className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
        />
        <button
          onClick={() => {
            const normalized = newTag.trim();
            if (!normalized) return;
            const withHash = normalized.startsWith("#") ? normalized : `#${normalized}`;
            setHashtags((prev) => (prev.includes(withHash) ? prev : [...prev, withHash]));
            setNewTag("");
          }}
          className="px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm"
        >
          Aggiungi
        </button>
      </div>

      <div className="flex items-center gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-2 text-sm text-muted-foreground">Annulla</button>
        <button onClick={() => onSave({ caption, hashtags })} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
          Salva modifiche
        </button>
      </div>
    </div>
  );
}
