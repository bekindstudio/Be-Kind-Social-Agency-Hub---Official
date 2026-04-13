import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { EditorialPost, SocialPlatform } from "@/types/client";

export interface CalendarDay {
  date: Date;
  key: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  posts: EditorialPost[];
}

interface MonthViewProps {
  days: CalendarDay[];
  onDayClick: (date: Date) => void;
  onPostClick: (post: EditorialPost) => void;
  onMovePost: (postId: string, date: Date) => void;
}

const WEEK_LABELS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

function platformClass(platform: SocialPlatform): string {
  if (platform === "instagram") return "bg-violet-200/70 text-violet-900";
  if (platform === "facebook") return "bg-blue-200/70 text-blue-900";
  if (platform === "linkedin") return "bg-sky-200/70 text-sky-900";
  if (platform === "tiktok") return "bg-zinc-300/80 text-zinc-900";
  if (platform === "x") return "bg-zinc-200 text-zinc-900";
  return "bg-red-200/70 text-red-900";
}

function statusDotClass(status: EditorialPost["status"]): string {
  if (status === "pending_approval") return "bg-amber-500";
  if (status === "approved") return "bg-lime-500";
  if (status === "published") return "bg-emerald-600";
  if (status === "rejected") return "bg-rose-600";
  return "bg-zinc-500";
}

export function MonthView({ days, onDayClick, onPostClick, onMovePost }: MonthViewProps) {
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

  const initialFocusKey = useMemo(() => days.find((d) => d.isToday)?.key ?? days.find((d) => d.isCurrentMonth)?.key ?? days[0]?.key, [days]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {WEEK_LABELS.map((label) => (
          <div key={label} className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const visiblePosts = expandedDay === day.key ? day.posts : day.posts.slice(0, 3);
          const hiddenCount = day.posts.length - visiblePosts.length;
          return (
            <button
              key={day.key}
              type="button"
              tabIndex={day.key === initialFocusKey ? 0 : -1}
              data-day-key={day.key}
              disabled={!day.isCurrentMonth}
              onClick={() => day.isCurrentMonth && onDayClick(day.date)}
              onKeyDown={(e) => {
                const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : e.key === "ArrowDown" ? 7 : e.key === "ArrowUp" ? -7 : 0;
                if (delta === 0) return;
                e.preventDefault();
                const nextIndex = days.findIndex((d) => d.key === day.key) + delta;
                const next = days[nextIndex];
                if (!next) return;
                const nextEl = document.querySelector<HTMLButtonElement>(`[data-day-key="${next.key}"]`);
                nextEl?.focus();
              }}
              onDragOver={(e) => {
                if (!day.isCurrentMonth) return;
                e.preventDefault();
                setDragOverDay(day.key);
              }}
              onDragLeave={() => setDragOverDay((prev) => (prev === day.key ? null : prev))}
              onDrop={(e) => {
                if (!day.isCurrentMonth) return;
                const postId = e.dataTransfer.getData("text/post-id");
                if (postId) onMovePost(postId, day.date);
                setDragOverDay(null);
              }}
              className={cn(
                "min-h-[128px] border-r border-b border-border p-1.5 text-left align-top transition-colors",
                !day.isCurrentMonth && "bg-muted/20 text-muted-foreground",
                day.isCurrentMonth && "hover:bg-muted/20",
                dragOverDay === day.key && "bg-primary/10 ring-1 ring-primary/40",
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
                    day.isToday ? "bg-primary text-primary-foreground font-semibold" : "",
                  )}
                >
                  {day.date.getDate()}
                </span>
              </div>

              <div className="space-y-1">
                {visiblePosts.map((post) => (
                  <div
                    key={post.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/post-id", post.id);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPostClick(post);
                    }}
                    className={cn(
                      "flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium",
                      platformClass(post.platform),
                    )}
                  >
                    <span className="truncate">{post.title}</span>
                    <span className={cn("ml-auto h-1.5 w-1.5 rounded-full", statusDotClass(post.status))} />
                  </div>
                ))}
                {hiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedDay(day.key);
                    }}
                    className="text-[11px] text-primary hover:underline"
                  >
                    +{hiddenCount} altri
                  </button>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
