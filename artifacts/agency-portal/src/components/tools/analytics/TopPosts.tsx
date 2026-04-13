import type { MetaPostData } from "@/services/metaApi";

export function TopPosts({ posts }: { posts: MetaPostData[] }) {
  const sorted = [...posts].sort((a, b) => b.engagementRate - a.engagementRate).slice(0, 6);
  const maxEngagement = sorted[0]?.engagementRate ?? 1;

  return (
    <div className="rounded-xl border border-card-border bg-card p-4">
      <h3 className="font-semibold mb-3">Top post del periodo</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {sorted.map((post) => (
          <article key={post.id} className="rounded-lg border border-border bg-background overflow-hidden">
            <div className="h-32 bg-muted flex items-center justify-center text-xs text-muted-foreground">
              {post.thumbnailUrl ? <img src={post.thumbnailUrl} alt="" className="w-full h-full object-cover" /> : "No thumbnail"}
            </div>
            <div className="p-3">
              <p className="text-xs text-muted-foreground">{post.mediaType} · {new Date(post.timestamp).toLocaleDateString("it-IT")}</p>
              <p className="text-sm mt-1 line-clamp-2">{post.caption || "Post senza caption"}</p>
              <p className="text-xs mt-2 text-muted-foreground">
                Reach {post.reach.toLocaleString("it-IT")} · Like {post.likeCount} · Commenti {post.commentsCount}
              </p>
              <div className="mt-2">
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${Math.max(8, (post.engagementRate / maxEngagement) * 100)}%` }} />
                </div>
                <p className="text-[11px] text-emerald-700 mt-1">{post.engagementRate.toFixed(2)}% engagement</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
