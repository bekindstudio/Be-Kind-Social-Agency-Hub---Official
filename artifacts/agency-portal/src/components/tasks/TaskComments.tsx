import { MessageSquare } from "lucide-react";
import { formatDate } from "@/lib/utils";

export function TaskComments({
  commentDraft,
  setCommentDraft,
  handleAddComment,
  addTaskComment,
  taskComments,
  isCommentsLoading,
  commentsError,
}: {
  commentDraft: string;
  setCommentDraft: (value: string) => void;
  handleAddComment: () => void;
  addTaskComment: any;
  taskComments: any[];
  isCommentsLoading: boolean;
  commentsError: unknown;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <MessageSquare size={14} className="text-primary" />
        <p className="text-sm font-semibold">Comments</p>
      </div>
      <div className="flex gap-2 mb-2">
        <input
          className="flex-1 px-2.5 py-2 border border-input rounded-lg bg-background text-sm"
          placeholder="Scrivi un commento..."
          value={commentDraft}
          onChange={(e) => setCommentDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAddComment(); }}
        />
        <button
          onClick={handleAddComment}
          disabled={addTaskComment.isPending}
          className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm disabled:opacity-60"
        >
          {addTaskComment.isPending ? "Invio..." : "Invia"}
        </button>
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {isCommentsLoading && <p className="text-xs text-muted-foreground">Caricamento commenti...</p>}
        {!!commentsError && <p className="text-xs text-destructive">Impossibile caricare i commenti del task.</p>}
        {taskComments.map((c) => (
          <div key={c.id} className="bg-muted/40 rounded-lg px-3 py-2">
            <p className="text-xs font-medium">{c.authorName}</p>
            <p className="text-sm">{c.content}</p>
            <p className="text-[11px] text-muted-foreground">{formatDate(c.createdAt)}</p>
          </div>
        ))}
        {!isCommentsLoading && !commentsError && taskComments.length === 0 && (
          <p className="text-xs text-muted-foreground">Nessun commento</p>
        )}
      </div>
    </div>
  );
}
