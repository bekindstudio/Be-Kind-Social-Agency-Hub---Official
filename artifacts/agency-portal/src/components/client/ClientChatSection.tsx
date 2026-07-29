import { useCallback, useEffect, useRef, useState } from "react";
import { Send, MessageCircle, Loader2 } from "lucide-react";
import { portalFetch } from "@workspace/api-client-react";

/**
 * Chat dell'agenzia col cliente (mirror di quella nel portale). Stesso thread:
 * ciò che il cliente scrive dal portale arriva qui e viceversa. Poll leggero.
 */
type ChatMessage = { id: number; content: string; authorName: string; source: string; createdAt: string };

export function ClientChatSection({ clientId, clientName }: { clientId: number; clientName: string }) {
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await portalFetch(`/api/clients/${clientId}/messages`, { credentials: "include" });
      if (r.ok) {
        const data = (await r.json()) as ChatMessage[];
        setMsgs((prev) => (JSON.stringify(prev) !== JSON.stringify(data) ? data : prev));
      }
    } catch { /* riprova al prossimo poll */ }
    finally { setLoading(false); }
  }, [clientId]);

  useEffect(() => {
    void refresh();
    const iv = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 12000);
    return () => clearInterval(iv);
  }, [refresh]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  const send = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText("");
    try {
      const r = await portalFetch(`/api/clients/${clientId}/messages`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }),
      });
      if (r.ok) { const created = (await r.json()) as ChatMessage; setMsgs((p) => [...p, created]); }
      else setText(content);
    } catch { setText(content); }
    finally { setSending(false); }
  };

  return (
    <div className="rounded-xl border border-card-border bg-card flex flex-col" style={{ height: "min(70vh, 560px)" }}>
      <div className="px-4 py-3 border-b border-card-border flex items-center gap-2">
        <MessageCircle size={16} className="text-primary" />
        <p className="font-semibold text-sm">Chat con {clientName}</p>
        <span className="text-[11px] text-muted-foreground ml-auto">Il cliente la vede nel suo portale</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {loading && msgs.length === 0 ? (
          <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-muted-foreground" /></div>
        ) : msgs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Nessun messaggio ancora. Scrivi tu il primo: il cliente lo riceve nel portale.</p>
        ) : (
          msgs.map((m) => {
            const agency = m.source === "agency";
            return (
              <div key={m.id} className={`flex ${agency ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${agency ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted rounded-bl-md"}`}>
                  {!agency && <p className="text-[11px] font-bold mb-0.5 opacity-70">{m.authorName}</p>}
                  <p className="leading-snug whitespace-pre-wrap break-words">{m.content}</p>
                  <p className={`text-[10px] mt-1 ${agency ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {new Date(m.createdAt).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-card-border flex items-end gap-2">
        <textarea value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          rows={1} placeholder={`Rispondi a ${clientName}…`}
          className="flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring max-h-28" />
        <button onClick={() => void send()} disabled={!text.trim() || sending}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-primary text-primary-foreground shrink-0 disabled:opacity-40">
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
