import { cn } from "@/lib/utils";
import type { EditorialPost, SocialPlatform } from "@/types/client";

interface CalendarFiltersProps {
  selectedPlatforms: SocialPlatform[];
  selectedStatuses: EditorialPost["status"][];
  onPlatformsChange: (next: SocialPlatform[]) => void;
  onStatusesChange: (next: EditorialPost["status"][]) => void;
  totalFiltered: number;
  pendingCount: number;
}

const PLATFORM_OPTIONS: { id: SocialPlatform; label: string }[] = [
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "tiktok", label: "TikTok" },
];

const STATUS_OPTIONS: { id: EditorialPost["status"]; label: string }[] = [
  { id: "draft", label: "Bozza" },
  { id: "pending_approval", label: "In approvazione" },
  { id: "approved", label: "Approvato" },
  { id: "published", label: "Pubblicato" },
  { id: "rejected", label: "Rifiutato" },
];

function toggle<T extends string>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((value) => value !== item) : [...list, item];
}

export function CalendarFilters({
  selectedPlatforms,
  selectedStatuses,
  onPlatformsChange,
  onStatusesChange,
  totalFiltered,
  pendingCount,
}: CalendarFiltersProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onPlatformsChange([])}
          className={cn("rounded-full border px-2.5 py-1 text-xs", selectedPlatforms.length === 0 ? "border-primary bg-primary/10 text-primary" : "border-input")}
        >
          Tutti
        </button>
        {PLATFORM_OPTIONS.map((platform) => (
          <button
            key={platform.id}
            type="button"
            onClick={() => onPlatformsChange(toggle(selectedPlatforms, platform.id))}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs",
              selectedPlatforms.includes(platform.id) ? "border-primary bg-primary/10 text-primary" : "border-input",
            )}
          >
            {platform.label}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onStatusesChange([])}
          className={cn("rounded-full border px-2.5 py-1 text-xs", selectedStatuses.length === 0 ? "border-primary bg-primary/10 text-primary" : "border-input")}
        >
          Tutti
        </button>
        {STATUS_OPTIONS.map((status) => (
          <button
            key={status.id}
            type="button"
            onClick={() => onStatusesChange(toggle(selectedStatuses, status.id))}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs",
              selectedStatuses.includes(status.id) ? "border-primary bg-primary/10 text-primary" : "border-input",
            )}
          >
            {status.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {totalFiltered} post · {pendingCount} in approvazione
        </span>
      </div>
    </div>
  );
}
