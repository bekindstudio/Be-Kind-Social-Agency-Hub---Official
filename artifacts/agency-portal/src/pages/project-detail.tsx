import { useState } from "react";
import { Link } from "wouter";
import {
  useGetProject,
  useListTasks,
  useListMessages,
  useListFiles,
  useUpdateProject,
  useCreateMessage,
  useDeleteMessage,
  getGetProjectQueryKey,
  getListTasksQueryKey,
  getListMessagesQueryKey,
  getListFilesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { ChevronLeft, Send, Trash2, Lock, Sparkles } from "lucide-react";
import { useAiChat } from "@/components/ai-chat/AiChatContext";
import { cn, STATUS_LABELS, STATUS_COLORS, TASK_STATUS_LABELS, TASK_STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS, formatDate } from "@/lib/utils";

interface Props {
  id: string;
}

export default function ProjectDetail({ id }: Props) {
  const projectId = parseInt(id, 10);
  const qc = useQueryClient();
  const { data: project, isLoading } = useGetProject(projectId, { query: { queryKey: getGetProjectQueryKey(projectId), enabled: !!projectId } });
  const { data: tasks } = useListTasks({ projectId }, { query: { queryKey: getListTasksQueryKey({ projectId }) } });
  const { data: messages } = useListMessages({ projectId }, { query: { queryKey: getListMessagesQueryKey({ projectId }) } });
  const { data: files } = useListFiles({ projectId }, { query: { queryKey: getListFilesQueryKey({ projectId }) } });
  const updateProject = useUpdateProject();
  const createMessage = useCreateMessage();
  const deleteMessage = useDeleteMessage();

  const [activeTab, setActiveTab] = useState<"tasks" | "chat" | "files">("tasks");
  const [msgText, setMsgText] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const { openDrawer } = useAiChat();

  const taskList = Array.isArray(tasks)
    ? tasks
    : Array.isArray((tasks as any)?.items)
      ? (tasks as any).items
      : tasks
        ? [tasks as any]
        : [];
  const messageList = Array.isArray(messages)
    ? messages
    : Array.isArray((messages as any)?.items)
      ? (messages as any).items
      : messages
        ? [messages as any]
        : [];
  const fileList = Array.isArray(files)
    ? files
    : Array.isArray((files as any)?.items)
      ? (files as any).items
      : files
        ? [files as any]
        : [];

  if (isLoading) return <Layout><div className="p-8 text-muted-foreground">Caricamento...</div></Layout>;
  if (!project) return <Layout><div className="p-8 text-muted-foreground">Progetto non trovato</div></Layout>;

  const currentProgress = progress ?? project.progress;

  const handleProgressSave = () => {
    updateProject.mutate(
      { id: projectId, data: { progress: currentProgress } },
      { onSuccess: () => qc.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) }) }
    );
  };

  const handleSendMessage = () => {
    if (!msgText.trim()) return;
    createMessage.mutate(
      { data: { content: msgText, authorName: "Marco Rossi", authorColor: "#6366f1", projectId } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListMessagesQueryKey({ projectId }) });
          setMsgText("");
        },
      }
    );
  };

  return (
    <Layout>
      <div className="p-8">
        <Link href="/projects">
          <div className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground cursor-pointer mb-6 transition-colors">
            <ChevronLeft size={16} /> Progetti
          </div>
        </Link>

        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold">{project.name}</h1>
              <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium", STATUS_COLORS[project.status])}>
                {STATUS_LABELS[project.status]}
              </span>
              {(project as any).isPrivate && (
                <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-amber-100 text-amber-700">
                  <Lock size={11} /> Riservato
                </span>
              )}
            </div>
            {project.clientName && <p className="text-muted-foreground text-sm">{project.clientName}</p>}
            {project.description && <p className="text-muted-foreground text-sm mt-1">{project.description}</p>}
          </div>
          {project.deadline && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Scadenza</p>
              <p className="text-sm font-medium">{formatDate(project.deadline)}</p>
            </div>
          )}
        </div>

        <button
          onClick={() => openDrawer({ type: "project", data: { id: projectId, name: project.name, clientName: project.clientName, status: project.status, tasks: taskList.map((t: any) => ({ title: t.title, status: t.status })) } })}
          className="inline-flex items-center gap-2 text-xs px-3 py-1.5 bg-violet-50 text-violet-700 rounded-lg hover:bg-violet-100 transition-colors border border-violet-200 mb-4"
        >
          <Sparkles size={13} /> Chiedi all'AI su questo progetto
        </button>

        <div className="bg-card border border-card-border rounded-xl p-5 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Avanzamento</p>
            <div className="flex items-center gap-2">
              <input
                type="range" min={0} max={100} value={currentProgress}
                onChange={(e) => setProgress(Number(e.target.value))}
                className="w-24"
              />
              <span className="text-sm font-bold w-10 text-right">{currentProgress}%</span>
              <button onClick={handleProgressSave} className="text-xs px-3 py-1 bg-primary text-primary-foreground rounded-md hover:opacity-90">
                Salva
              </button>
            </div>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${currentProgress}%` }} />
          </div>
        </div>

        <div className="flex gap-1 mb-4">
          {(["tasks", "chat", "files"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                activeTab === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === "tasks" ? `Task (${taskList.length})` : tab === "chat" ? `Chat (${messageList.length})` : `File (${fileList.length})`}
            </button>
          ))}
        </div>

        {activeTab === "tasks" && (
          <div className="space-y-2">
            {taskList.length > 0 ? taskList.map((t: any) => (
              <div key={t.id} className="bg-card border border-card-border rounded-xl p-4 shadow-sm flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t.title}</p>
                  {t.assigneeName && <p className="text-xs text-muted-foreground">{t.assigneeName}</p>}
                </div>
                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", PRIORITY_COLORS[t.priority])}>{PRIORITY_LABELS[t.priority]}</span>
                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", TASK_STATUS_COLORS[t.status])}>{TASK_STATUS_LABELS[t.status]}</span>
                {t.dueDate && <span className="text-xs text-muted-foreground">{formatDate(t.dueDate)}</span>}
              </div>
            )) : (
              <p className="text-muted-foreground text-sm py-8 text-center">Nessun task per questo progetto</p>
            )}
          </div>
        )}

        {activeTab === "chat" && (
          <div>
            <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
              {messageList.length > 0 ? messageList.map((m: any) => (
                <div key={m.id} className="flex gap-3 group">
                  <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: m.authorColor }}>
                    {m.authorName.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold">{m.authorName}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(m.createdAt)}</span>
                    </div>
                    <p className="text-sm">{m.content}</p>
                  </div>
                  <button onClick={() => deleteMessage.mutate({ id: m.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListMessagesQueryKey({ projectId }) }) })} className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all">
                    <Trash2 size={13} />
                  </button>
                </div>
              )) : (
                <p className="text-muted-foreground text-sm py-8 text-center">Nessun messaggio ancora</p>
              )}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Scrivi un messaggio..."
                value={msgText}
                onChange={(e) => setMsgText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              />
              <button onClick={handleSendMessage} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity">
                <Send size={16} />
              </button>
            </div>
          </div>
        )}

        {activeTab === "files" && (
          <div className="space-y-2">
            {fileList.length > 0 ? fileList.map((f: any) => (
              <div key={f.id} className="bg-card border border-card-border rounded-xl p-4 shadow-sm flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                  {f.type.substring(0, 3).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{f.name}</p>
                  <p className="text-xs text-muted-foreground">{f.uploadedBy} · {formatDate(f.createdAt)}</p>
                </div>
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Apri</a>
              </div>
            )) : (
              <p className="text-muted-foreground text-sm py-8 text-center">Nessun file caricato</p>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
