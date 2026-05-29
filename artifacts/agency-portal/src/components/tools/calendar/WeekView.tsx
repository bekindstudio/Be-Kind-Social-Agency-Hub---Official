import { useState } from "react";
import { Check, X } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import type { EditorialPost } from "@/types/client";

interface WeekColumn {
  date: Date;
  key: string;
  isToday: boolean;
  posts: EditorialPost[];
}

interface WeekViewProps {
  columns: WeekColumn[];
  onDayClick: (date: Date) => void;
  onPostClick: (post: EditorialPost) => void;
  onMovePost?: (postId: string, date: Date) => void;
  onApprovePost?: (post: EditorialPost) => void;
  onRejectPost?: (post: EditorialPost) => void;
}

function statusLabel(status: EditorialPost["status"]): string {
  if (status === "draft") return "Bozza";
  if (status === "pending_approval") return "In approvazione";
  if (status === "approved") return "Approvato";
  if (status === "published") return "Pubblicato";
  return "Rifiutato";
}

function statusClass(status: EditorialPost["status"]): string {
  if (status === "pending_approval") return "bg-amber-100 text-amber-700";
  if (status === "approved") return "bg-lime-100 text-lime-700";
  if (status === "published") return "bg-emerald-100 text-emerald-700";
  if (status === "rejected") return "bg-rose-100 text-rose-700";
  return "bg-zinc-200 text-zinc-700";
}

export function WeekView({ columns, onDayClick, onPostClick, onMovePost, onApprovePost, onRejectPost }: WeekViewProps) {
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
      {columns.map((column) => (
        <div
          key={column.key}
          className={cn(
            "rounded-xl border bg-card transition-colors",
            dragOverKey === column.key ? "border-primary ring-1 ring-primary/40 bg-primary/5" : "border-border",
          )}
          onDragOver={(e) => {
            if (!onMovePost) return;
            e.preventDefault();
            setDragOverKey(column.key);
          }}
          onDragLeave={() => setDragOverKey((prev) => (prev === column.key ? null : prev))}
          onDrop={(e) => {
            if (!onMovePost) return;
            const postId = e.dataTransfer.getData("text/post-id");
            if (postId) onMovePost(postId, column.date);
            setDragOverKey(null);
          }}
        >
          <button
            type="button"
            onClick={() => onDayClick(column.date)}
            className={cn("w-full border-b border-border px-2 py-2 text-left", column.isToday && "bg-primary/10")}
          >
            <p className="text-xs font-semibold">{formatDate(column.date.toISOString())}</p>
            <p className="text-[10px] text-muted-foreground">{column.posts.length} post</p>
          </button>
          <div className="max-h-[460px] space-y-1 overflow-y-auto p-2">
            {column.posts.map((post) => {
              const isPending = post.status === "pending_approval";
              return (
                <div
                  key={post.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/post-id", post.id);
                  }}
                  className="group relative w-full rounded-lg border border-input bg-background p-2 text-left hover:bg-muted/40 cursor-pointer"
                  onClick={() => onPostClick(post)}
                >
                  <p className="line-clamp-2 text-xs font-medium pr-1">{post.title}</p>
                  {post.caption && (
                    <p className="line-clamp-2 text-[10px] text-muted-foreground/80 mt-0.5">{post.caption}</p>
                  )}
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <PlatformIcon platform={post.platform} size="sm" />
                    <span className="capitalize">{post.platform}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", statusClass(post.status))}>
                      {statusLabel(post.status)}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                      {new Date(post.scheduledDate).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {isPending && (onApprovePost || onRejectPost) && (
                    <div className="absolute right-1 top-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {onApprovePost && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onApprovePost(post); }}
                          title="Approva"
                          className="h-5 w-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm hover:bg-emerald-600"
                        >
                          <Check size={11} strokeWidth={3} />
                        </button>
                      )}
                      {onRejectPost && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onRejectPost(post); }}
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
            })}
            {column.posts.length === 0 && <p className="px-1 py-3 text-center text-xs text-muted-foreground">Nessun post</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
