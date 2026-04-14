import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { portalFetch } from "@workspace/api-client-react";
import { useAiChat } from "./AiChatContext";
import { cn } from "@/lib/utils";
import {
  X,
  Send,
  Sparkles,
  Maximize2,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Check,
  Plus,
  Trash2,
  Star,
  StopCircle,
  Search,
} from "lucide-react";
import { useLocation } from "wouter";
import { useClientContext } from "@/context/ClientContext";

interface Message {
  id?: number;
  role: "user" | "assistant";
  content: string;
  feedback?: string | null;
}

interface Conversation {
  id: number;
  title: string;
  contextType?: string;
  isStarred?: boolean;
  createdAt: string;
  updatedAt?: string;
}

const SUGGESTED_PROMPTS: Record<string, { label: string; prompt: string }[]> = {
  general: [
    { label: "Scrivi una caption per Instagram", prompt: "Scrivi una caption per Instagram per un post aziendale" },
    { label: "Analizza le performance di questo mese", prompt: "Analizza le performance social di questo mese e suggerisci miglioramenti" },
    { label: "Aiutami con il report del cliente", prompt: "Aiutami a scrivere il report mensile per il cliente" },
    { label: "Idee per la prossima campagna", prompt: "Suggerisci idee creative per la prossima campagna social" },
    { label: "Scrivi il testo per un'ads Meta", prompt: "Scrivi 3 varianti di testo per un'inserzione Meta Ads" },
  ],
  project: [
    { label: "Idee per i prossimi 3 contenuti", prompt: "Suggerisci idee per i prossimi 3 contenuti del progetto" },
    { label: "Analizza lo stato del progetto", prompt: "Analizza lo stato attuale del progetto e suggerisci le priorita" },
    { label: "Scrivi un aggiornamento per il cliente", prompt: "Scrivi un aggiornamento professionale per il cliente sullo stato del progetto" },
  ],
  client: [
    { label: "Idee di contenuto per questo cliente", prompt: "Suggerisci idee di contenuto specifiche per questo cliente" },
    { label: "Analizza il settore di questo cliente", prompt: "Analizza il settore di questo cliente e le tendenze social attuali" },
    { label: "Suggerisci una strategia social", prompt: "Suggerisci una strategia social completa per questo cliente" },
    { label: "Scrivi una email professionale", prompt: "Scrivi una email professionale per questo cliente" },
  ],
  report: [
    { label: "Scrivi il riepilogo esecutivo", prompt: "Scrivi il riepilogo esecutivo per questo report basandoti sui dati disponibili" },
    { label: "Scrivi la sezione strategia", prompt: "Scrivi la sezione strategica del report con raccomandazioni" },
    { label: "Analizza questi risultati", prompt: "Analizza i risultati di questo periodo e identifica trend" },
    { label: "Cosa migliorare il prossimo mese?", prompt: "Sulla base dei dati, cosa dovremmo migliorare il prossimo mese?" },
  ],
};

function renderMarkdown(text: string) {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-muted rounded-lg p-3 my-2 text-xs overflow-x-auto"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-xs">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/^### (.+)$/gm, '<h4 class="font-semibold text-sm mt-3 mb-1">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="font-semibold text-base mt-3 mb-1">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="font-bold text-lg mt-3 mb-1">$1</h2>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-sm">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal text-sm">$2</li>')
    .replace(/\n{2,}/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
  return html;
}

export function AiChatPanel({ mode = "drawer" }: { mode?: "drawer" | "fullpage" }) {
  const { isDrawerOpen, closeDrawer, context } = useAiChat();
  const { activeClient } = useClientContext();
  const [, setLocation] = useLocation();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const derivedClientContext = useMemo(() => {
    if (!activeClient) return null;
    return {
      type: "client",
      data: {
        id: activeClient.id,
        name: activeClient.name,
        industry: activeClient.industry,
        status: activeClient.status,
      },
    };
  }, [activeClient]);
  const effectiveContext = context ?? derivedClientContext;
  const contextType = effectiveContext?.type ?? "general";

  const fetchConversations = useCallback(async () => {
    try {
      const res = await portalFetch("/api/anthropic/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
        setApiError(null);
      } else {
        setApiError("Non riesco a caricare le conversazioni AI.");
      }
    } catch {
      setApiError("Connessione AI non disponibile al momento.");
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadConversation = useCallback(async (id: number) => {
    try {
      const res = await portalFetch(`/api/anthropic/conversations/${id}`);
      if (res.ok) {
        const data = await res.json();
        setActiveConvId(id);
        setMessages(data.messages ?? []);
        setApiError(null);
      } else {
        setApiError("Impossibile aprire questa conversazione.");
      }
    } catch {
      setApiError("Impossibile aprire questa conversazione.");
    }
  }, []);

  const createConversation = useCallback(async (title: string) => {
    try {
      const safeTitle = title.trim();
      if (!safeTitle) return null;
      const res = await portalFetch("/api/anthropic/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: safeTitle, contextType, contextId: effectiveContext?.data?.id?.toString() }),
      });
      if (res.ok) {
        const conv = await res.json();
        setActiveConvId(conv.id);
        setMessages([]);
        fetchConversations();
        setApiError(null);
        return conv.id;
      }
      setApiError("Impossibile creare una nuova conversazione.");
    } catch {
      setApiError("Impossibile creare una nuova conversazione.");
    }
    return null;
  }, [contextType, effectiveContext, fetchConversations]);

  const deleteConversation = useCallback(async (id: number) => {
    try {
      const res = await portalFetch(`/api/anthropic/conversations/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        setApiError("Impossibile eliminare la conversazione.");
        return;
      }
      if (activeConvId === id) {
        setActiveConvId(null);
        setMessages([]);
      }
      fetchConversations();
      setApiError(null);
    } catch {
      setApiError("Impossibile eliminare la conversazione.");
    }
  }, [activeConvId, fetchConversations]);

  const toggleStar = useCallback(async (id: number, current: boolean) => {
    try {
      const res = await portalFetch(`/api/anthropic/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isStarred: !current }),
      });
      if (!res.ok) {
        setApiError("Impossibile aggiornare la conversazione.");
        return;
      }
      fetchConversations();
      setApiError(null);
    } catch {
      setApiError("Impossibile aggiornare la conversazione.");
    }
  }, [fetchConversations]);

  const sendFeedback = useCallback(async (messageId: number, feedback: string) => {
    try {
      const res = await portalFetch(`/api/anthropic/messages/${messageId}/feedback`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback }),
      });
      if (!res.ok) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, feedback } : m))
      );
    } catch {}
  }, []);

  const copyToClipboard = useCallback((text: string, id?: number) => {
    void navigator.clipboard.writeText(text).then(() => {
      if (id) {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      }
    }).catch(() => {
      setApiError("Copia non riuscita. Verifica i permessi del browser.");
    });
  }, []);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isStreaming) return;
    setApiError(null);

    let convId = activeConvId;
    if (!convId) {
      convId = await createConversation(content.slice(0, 50));
      if (!convId) return;
    }

    const userMsg: Message = { role: "user", content };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);

    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMsg]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await portalFetch(`/api/anthropic/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, context: effectiveContext ?? undefined }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error("Stream error");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.done) {
              fetchConversations();
              const reloadRes = await portalFetch(`/api/anthropic/conversations/${convId}`);
              if (reloadRes.ok) {
                const data = await reloadRes.json();
                setMessages(data.messages ?? []);
              }
            } else if (payload.content) {
              accumulated += payload.content;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", content: accumulated };
                return copy;
              });
            } else if (payload.error) {
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", content: payload.error };
                return copy;
              });
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setApiError("AI non disponibile al momento. Riprova tra poco.");
        setMessages((prev) => {
          const copy = [...prev];
          if (copy.length > 0 && copy[copy.length - 1].role === "assistant") {
            copy[copy.length - 1] = { role: "assistant", content: "AI non disponibile al momento. Riprova tra poco." };
          }
          return copy;
        });
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [activeConvId, isStreaming, createConversation, effectiveContext, fetchConversations]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const startNewChat = () => {
    setActiveConvId(null);
    setMessages([]);
    setInput("");
    setApiError(null);
    inputRef.current?.focus();
  };

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const filteredConversations = conversations.filter((c) =>
    !searchTerm || c.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const suggestedPrompts = SUGGESTED_PROMPTS[contextType] ?? SUGGESTED_PROMPTS.general;

  if (mode === "drawer" && !isDrawerOpen) return null;

  const chatArea = (
    <div className="flex flex-col h-full">
      {mode === "drawer" && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-violet-500" />
            <span className="font-semibold text-sm">AI Assistant</span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              PRIVATA
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { closeDrawer(); setLocation("/ai-assistant"); }}
              className="p-1.5 hover:bg-muted rounded-md transition-colors"
              title="Apri a schermo intero"
            >
              <Maximize2 size={14} />
            </button>
            <button onClick={closeDrawer} className="p-1.5 hover:bg-muted rounded-md transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {effectiveContext?.type === "client" && (
          <div className="mb-3 text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
            Contesto attivo: cliente <strong>{effectiveContext.data?.name ?? "selezionato"}</strong>
          </div>
        )}
        <div className="mb-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          Modalita privata interna: i dati del portale restano all'interno dell'applicazione.
        </div>
        {apiError && (
          <div className="mb-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            {apiError}
          </div>
        )}
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center">
              <Sparkles size={28} className="text-violet-500" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium mb-1">Ciao! Sono il tuo assistente AI.</p>
              <p className="text-xs text-muted-foreground">Come posso aiutarti oggi?</p>
            </div>
            <div className="flex flex-wrap gap-2 max-w-sm justify-center">
              {suggestedPrompts.map((sp) => (
                <button
                  key={sp.label}
                  onClick={() => sendMessage(sp.prompt)}
                  className="text-xs px-3 py-2 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-full transition-colors border border-violet-200"
                >
                  {sp.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                  msg.role === "user"
                    ? "bg-violet-600 text-white rounded-br-md"
                    : "bg-card border border-border rounded-bl-md shadow-sm"
                )}>
                  {msg.role === "assistant" ? (
                    <div
                      className="prose prose-sm max-w-none [&_li]:my-0.5 [&_pre]:my-2 [&_h2]:text-base [&_h3]:text-sm [&_h4]:text-sm"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content || "...") }}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                  {msg.role === "assistant" && msg.id && !isStreaming && (
                    <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/50">
                      <button
                        onClick={() => copyToClipboard(msg.content, msg.id)}
                        className="p-1 hover:bg-muted rounded transition-colors"
                        title="Copia"
                      >
                        {copiedId === msg.id ? <Check size={12} className="text-green-500" /> : <Copy size={12} className="text-muted-foreground" />}
                      </button>
                      <button
                        onClick={() => sendFeedback(msg.id!, "positive")}
                        className={cn("p-1 hover:bg-muted rounded transition-colors", msg.feedback === "positive" && "text-green-500")}
                        title="Utile"
                      >
                        <ThumbsUp size={12} />
                      </button>
                      <button
                        onClick={() => sendFeedback(msg.id!, "negative")}
                        className={cn("p-1 hover:bg-muted rounded transition-colors", msg.feedback === "negative" && "text-red-500")}
                        title="Non utile"
                      >
                        <ThumbsDown size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isStreaming && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 size={12} className="animate-spin" />
                  <span>Generazione in corso...</span>
                  <button onClick={stopGeneration} className="text-red-500 hover:text-red-700">
                    <StopCircle size={14} />
                  </button>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-border bg-card">
        <div className="flex items-end gap-2">
          <button
            onClick={startNewChat}
            className="p-2 hover:bg-muted rounded-lg transition-colors shrink-0"
            title="Nuova conversazione"
          >
            <Plus size={16} className="text-muted-foreground" />
          </button>
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Scrivi un messaggio..."
              rows={1}
              className="w-full resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 max-h-32"
              style={{ minHeight: "40px" }}
              onInput={(e) => {
                const el = e.target as HTMLTextAreaElement;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 128) + "px";
              }}
            />
          </div>
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming}
            className={cn(
              "p-2 rounded-xl transition-colors shrink-0",
              input.trim() && !isStreaming
                ? "bg-violet-600 text-white hover:bg-violet-700"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  if (mode === "fullpage") {
    return (
      <div className="flex h-full">
        <div className="w-72 border-r border-border bg-card flex flex-col shrink-0">
          <div className="p-4 border-b border-border">
            <button
              onClick={startNewChat}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 transition-colors"
            >
              <Plus size={16} /> Nuova conversazione
            </button>
          </div>
          <div className="px-3 py-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cerca conversazioni..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-violet-500/30"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-1">
            {filteredConversations.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Nessuna conversazione</p>
            ) : (
              filteredConversations.map((c) => (
                <div
                  key={c.id}
                  className={cn(
                    "group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer text-sm mb-0.5 transition-colors",
                    activeConvId === c.id ? "bg-violet-50 text-violet-700" : "hover:bg-muted"
                  )}
                  onClick={() => loadConversation(c.id)}
                >
                  <Sparkles size={14} className={cn("shrink-0", activeConvId === c.id ? "text-violet-500" : "text-muted-foreground")} />
                  <span className="flex-1 truncate text-xs">{c.title}</span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleStar(c.id, !!c.isStarred); }}
                      className="p-1 hover:bg-muted rounded"
                    >
                      <Star size={12} className={c.isStarred ? "text-amber-500 fill-amber-500" : "text-muted-foreground"} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}
                      className="p-1 hover:bg-red-50 rounded text-muted-foreground hover:text-red-500"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          {chatArea}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={closeDrawer} />
      <div className="fixed top-0 right-0 h-full w-[420px] max-w-[calc(100vw-60px)] bg-background border-l border-border shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
        {chatArea}
      </div>
    </>
  );
}
