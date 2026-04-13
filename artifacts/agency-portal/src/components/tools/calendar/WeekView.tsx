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

export function WeekView({ columns, onDayClick, onPostClick }: WeekViewProps) {
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
      {columns.map((column) => (
        <div key={column.key} className="rounded-xl border border-border bg-card">
          <button
            type="button"
            onClick={() => onDayClick(column.date)}
            className={cn("w-full border-b border-border px-2 py-2 text-left", column.isToday && "bg-primary/10")}
          >
            <p className="text-xs font-semibold">{formatDate(column.date.toISOString())}</p>
          </button>
          <div className="max-h-[460px] space-y-1 overflow-y-auto p-2">
            {column.posts.map((post) => (
              <button
                key={post.id}
                type="button"
                onClick={() => onPostClick(post)}
                className="w-full rounded-lg border border-input bg-background p-2 text-left hover:bg-muted/40"
              >
                <p className="line-clamp-2 text-xs font-medium">{post.title}</p>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <PlatformIcon platform={post.platform} size="sm" />
                  <span className="capitalize">{post.platform}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", statusClass(post.status))}>
                    {statusLabel(post.status)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(post.scheduledDate).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </button>
            ))}
            {column.posts.length === 0 && <p className="px-1 py-3 text-center text-xs text-muted-foreground">Nessun post</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
