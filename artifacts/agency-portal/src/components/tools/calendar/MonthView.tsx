import { useMemo, useState } from "react";
import { Check, X, Image as ImageIcon } from "lucide-react";
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
  onApprovePost?: (post: EditorialPost) => void;
  onRejectPost?: (post: EditorialPost) => void;
}

const WEEK_LABELS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

function platformClass(platform: SocialPlatform): string {
  if (platform === "instagram") return "bg-violet-200/70 text-violet-900 border-violet-300/50";
  if (platform === "facebook") return "bg-blue-200/70 text-blue-900 border-blue-300/50";
  if (platform === "linkedin") return "bg-sky-200/70 text-sky-900 border-sky-300/50";
  if (platform === "tiktok") return "bg-zinc-300/80 text-zinc-900 border-zinc-400/50";
  if (platform === "x") return "bg-zinc-200 text-zinc-900 border-zinc-300/50";
  return "bg-red-200/70 text-red-900 border-red-300/50";
}

function statusDotClass(status: EditorialPost["status"]): string {
  if (status === "pending_approval") return "bg-amber-500";
  if (status === "approved") return "bg-lime-500";
  if (status === "published") return "bg-emerald-600";
  if (status === "rejected") return "bg-rose-600";
  return "bg-zinc-500";
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

function PostCard({
  post,
  onPostClick,
  onApprovePost,
  onRejectPost,
}: {
  post: EditorialPost;
  onPostClick: (p: EditorialPost) => void;
  onApprovePost?: (p: EditorialPost) => void;
  onRejectPost?: (p: EditorialPost) => void;
}) {
  const [hover, setHover] = useState(false);
  const isPending = post.status === "pending_approval";
  const thumb = post.mediaUrls?.[0];

  return (
    <div
      className="relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/post-id", post.id);
        }}
        onClick={(e) => {
          e.stopPropagation();
          onPostClick(post);
        }}
        className={cn(
          "group flex items-center gap-1 rounded border px-1.5 py-1 text-[11px] font-medium cursor-pointer",
          platformClass(post.platform),
        )}
      >
        <span className="text-[9px] opacity-70 font-mono tabular-nums">{formatTime(post.scheduledDate)}</span>
        <span className="truncate flex-1">{post.title}</span>
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", statusDotClass(post.status))} />
      </div>

      {hover && (
        <div
          className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border border-border bg-card shadow-xl pointer-events-none"
          onMouseEnter={(e) => e.stopPropagation()}
        >
          {thumb && (
            <div className="aspect-video w-full overflow-hidden rounded-t-lg bg-muted">
              <img src={thumb} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          {!thumb && (
            <div className="aspect-video w-full flex items-center justify-center bg-muted rounded-t-lg text-muted-foreground">
              <ImageIcon size={20} />
            </div>
          )}
          <div className="p-2 space-y-1">
            <p className="text-xs font-semibold line-clamp-1">{post.title}</p>
            <p className="text-[11px] text-muted-foreground line-clamp-3">{post.caption || "Nessuna caption"}</p>
            <div className="flex items-center justify-between pt-1 border-t border-border/50">
              <span className="text-[10px] capitalize text-muted-foreground">{post.platform}</span>
              <span className="text-[10px] font-mono tabular-nums">{formatTime(post.scheduledDate)}</span>
            </div>
          </div>
        </div>
      )}

      {isPending && (onApprovePost || onRejectPost) && hover && (
        <div className="absolute right-0 top-0 flex items-center gap-0.5 -mt-1.5 -mr-1 z-30">
          {onApprovePost && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onApprovePost(post);
              }}
              title="Approva"
              className="h-5 w-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm hover:bg-emerald-600"
            >
              <Check size={11} strokeWidth={3} />
            </button>
          )}
          {onRejectPost && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRejectPost(post);
              }}
              title="Rifiuta"
              className="h-5 w-5 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-sm hover:bg-rose-600"
            >
              <X size={11} strokeWidth={3} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function MonthView({ days, onDayClick, onPostClick, onMovePost, onApprovePost, onRejectPost }: MonthViewProps) {
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
                "relative min-h-[128px] border-r border-b border-border p-1.5 text-left align-top transition-colors overflow-visible",
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
                  <PostCard
                    key={post.id}
                    post={post}
                    onPostClick={onPostClick}
                    onApprovePost={onApprovePost}
                    onRejectPost={onRejectPost}
                  />
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
