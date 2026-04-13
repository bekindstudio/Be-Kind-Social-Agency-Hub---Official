import { cn } from "@/lib/utils";
import type { SocialPlatform } from "@/types/client";

type PlatformOption = { id: SocialPlatform; label: string; glyph: string };

const OPTIONS: PlatformOption[] = [
  { id: "instagram", label: "Instagram", glyph: "IG" },
  { id: "facebook", label: "Facebook", glyph: "FB" },
  { id: "linkedin", label: "LinkedIn", glyph: "IN" },
  { id: "tiktok", label: "TikTok", glyph: "TT" },
  { id: "x", label: "X", glyph: "X" },
  { id: "youtube", label: "YouTube", glyph: "YT" },
];

interface PlatformSelectorProps {
  value: SocialPlatform[];
  onChange: (next: SocialPlatform[]) => void;
}

export function PlatformSelector({ value, onChange }: PlatformSelectorProps) {
  const toggle = (platform: SocialPlatform) => {
    if (value.includes(platform)) {
      onChange(value.filter((item) => item !== platform));
      return;
    }
    onChange([...value, platform]);
  };

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {OPTIONS.map((option) => {
        const active = value.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => toggle(option.id)}
            aria-label={`Piattaforma ${option.label}`}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-sm transition-colors",
              active ? "border-primary bg-primary/10 text-primary" : "border-input hover:bg-muted",
            )}
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-current text-[10px] font-semibold">
              {option.glyph}
            </span>
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
