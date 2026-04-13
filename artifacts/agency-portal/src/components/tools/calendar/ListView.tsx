import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Copy, Pencil, Trash2 } from "lucide-react";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { cn } from "@/lib/utils";
import type { EditorialPost } from "@/types/client";

interface ListViewProps {
  posts: EditorialPost[];
  onOpenPost: (post: EditorialPost) => void;
  onDuplicatePost: (post: EditorialPost) => void;
  onDeletePost: (post: EditorialPost) => void;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + mondayOffset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekKey(date: Date): string {
  const monday = startOfWeek(date);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
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

export function ListView({ posts, onOpenPost, onDuplicatePost, onDeletePost }: ListViewProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, EditorialPost[]>();
    [...posts]
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
      .forEach((post) => {
        const key = weekKey(new Date(post.scheduledDate));
        const list = map.get(key) ?? [];
        list.push(post);
        map.set(key, list);
      });
    return Array.from(map.entries());
  }, [posts]);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-3">
      {grouped.map(([key, weekPosts]) => {
        const isClosed = collapsed[key] === true;
        const monday = new Date(key);
        return (
          <section key={key} className="rounded-xl border border-border bg-card">
            <button
              type="button"
              onClick={() => setCollapsed((prev) => ({ ...prev, [key]: !isClosed }))}
              className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left"
            >
              {isClosed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              <span className="text-sm font-semibold">
                Settimana {monday.toLocaleDateString("it-IT")}
              </span>
              <span className="text-xs text-muted-foreground">({weekPosts.length})</span>
            </button>
            {!isClosed && (
              <div className="divide-y divide-border">
                {weekPosts.map((post) => (
                  <div key={post.id} className="grid grid-cols-1 items-center gap-2 px-3 py-2 text-sm md:grid-cols-[180px_140px_1fr_150px_120px]">
                    <div className="text-xs text-muted-foreground">
                      {new Date(post.scheduledDate).toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "2-digit" })}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <PlatformIcon platform={post.platform} size="sm" />
                      <span className="capitalize">{post.platform}</span>
                    </div>
                    <p className="truncate font-medium">{post.title}</p>
                    <span className={cn("w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold", statusClass(post.status))}>
                      {statusLabel(post.status)}
                    </span>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => onOpenPost(post)} className="rounded p-1 hover:bg-muted" aria-label="Modifica post">
                        <Pencil size={13} />
                      </button>
                      <button type="button" onClick={() => onDuplicatePost(post)} className="rounded p-1 hover:bg-muted" aria-label="Duplica post">
                        <Copy size={13} />
                      </button>
                      <button type="button" onClick={() => onDeletePost(post)} className="rounded p-1 text-rose-600 hover:bg-rose-50" aria-label="Elimina post">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
      {grouped.length === 0 && <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">Nessun post disponibile</div>}
    </div>
  );
}
