import { useState, useEffect, useRef } from "react";
import {
  useListMessages,
  useListProjects,
  useCreateMessage,
  useDeleteMessage,
  getListMessagesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Send, Trash2, Hash, Users } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { usePortalUser } from "@/hooks/usePortalUser";

const AUTHOR_COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#06b6d4", "#84cc16"];

function getColorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AUTHOR_COLORS[Math.abs(hash) % AUTHOR_COLORS.length];
}

export default function Chat() {
  const qc = useQueryClient();
  const { data: projects } = useListProjects({});
  const { user } = usePortalUser();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const queryParams = selectedProjectId != null ? { projectId: selectedProjectId } : {};
  const { data: messages } = useListMessages(
    queryParams,
    {
      query: {
        queryKey: getListMessagesQueryKey(queryParams),
        refetchInterval: 5000,
      },
    }
  );
  const createMessage = useCreateMessage();
  const deleteMessage = useDeleteMessage();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCount = useRef(0);

  const [msgText, setMsgText] = useState("");

  const authorName = user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "Utente";
  const authorColor = getColorForName(authorName);

  const projectList = Array.isArray(projects)
    ? projects
    : // @ts-expect-error runtime safety for unknown API shape
      Array.isArray(projects?.items)
      ? // @ts-expect-error runtime safety for unknown API shape
        projects.items
      : projects
        ? [projects as any]
        : [];

  useEffect(() => {
    const newCount = messages?.length ?? 0;
    if (newCount > prevMessageCount.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMessageCount.current = newCount;
  }, [messages?.length]);

  const handleSend = () => {
    if (!msgText.trim()) return;
    createMessage.mutate(
      {
        data: {
          content: msgText,
          authorName,
          authorColor,
          projectId: selectedProjectId,
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListMessagesQueryKey(queryParams) });
          setMsgText("");
        },
      }
    );
  };

  const channelName =
    selectedProjectId == null
      ? "Generale"
      : projectList.find((p: any) => p.id === selectedProjectId)?.name ?? "Progetto";

  return (
    <Layout>
      <div className="flex h-full">
        <div className="w-56 border-r border-border bg-card/50 shrink-0 flex flex-col">
          <div className="p-4 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Canali</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <button
              onClick={() => setSelectedProjectId(null)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                selectedProjectId === null ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
              )}
            >
              <Hash size={14} />
              Generale
            </button>
            {projectList.map((p: any) => (
              <button
                key={p.id}
                onClick={() => setSelectedProjectId(p.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left mt-0.5",
                  selectedProjectId === p.id ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                )}
              >
                <Hash size={14} />
                <span className="truncate">{p.name}</span>
              </button>
            ))}
          </div>
          <div className="p-3 border-t border-border">
            <div className="flex items-center gap-2 px-2 py-1.5">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: authorColor }}>
                {authorName.charAt(0)}
              </div>
              <span className="text-xs font-medium truncate">{authorName}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="p-4 border-b border-border bg-card/30">
            <div className="flex items-center gap-2">
              <Hash size={16} className="text-muted-foreground" />
              <p className="text-sm font-semibold">{channelName}</p>
              {messages && (
                <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
                  <Users size={12} />
                  {messages.length} messaggi
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages && messages.length > 0 ? messages.map((m) => (
              <div key={m.id} className="flex gap-3 group">
                <div
                  className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: m.authorColor }}
                >
                  {m.authorName.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="text-sm font-semibold">{m.authorName}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(m.createdAt)}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                </div>
                <button
                  onClick={() => deleteMessage.mutate({ id: m.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListMessagesQueryKey(queryParams) }) })}
                  className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-muted-foreground text-sm">Nessun messaggio ancora. Scrivi il primo!</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <input
                className="flex-1 px-4 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={`Messaggio in #${channelName.toLowerCase()}...`}
                value={msgText}
                onChange={(e) => setMsgText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              />
              <button
                onClick={handleSend}
                disabled={createMessage.isPending || !msgText.trim()}
                className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
