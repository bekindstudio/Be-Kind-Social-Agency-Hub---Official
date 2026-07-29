import { useCallback, useEffect, useRef, useState } from "react";
import { Send, MessageCircle, Loader2 } from "lucide-react";
import { usePortal } from "../PortalContext";
import { portalGet, portalSend } from "../portalApi";
import { T } from "../theme";
import type { ChatMessage } from "../types";

/**
 * Chat cliente↔agenzia dentro il portale: sostituisce WhatsApp, tutto salvato.
 * Poll leggero ogni 12s + al focus, così le risposte dell'agenzia arrivano da
 * sole senza websocket. Bolle: cliente a destra (salvia), agenzia a sinistra.
 */
export function ChatScreen() {
  const { token, brand } = usePortal();
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await portalGet<ChatMessage[]>(token, "/messages");
      setMsgs((prev) => (prev.length !== data.length || JSON.stringify(prev) !== JSON.stringify(data) ? data : prev));
    } catch { /* silenzioso: la chat riprova al prossimo poll */ }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    void refresh();
    const iv = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 12000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(iv); window.removeEventListener("focus", onFocus); };
  }, [refresh]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  const send = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    const optimistic: ChatMessage = { id: -Date.now(), content, authorName: brand.name, source: "client", createdAt: new Date().toISOString() };
    setMsgs((p) => [...p, optimistic]);
    setText("");
    const res = await portalSend<ChatMessage>(token, "/messages", "POST", { content });
    setSending(false);
    if (res.ok && res.data) {
      setMsgs((p) => p.map((m) => (m.id === optimistic.id ? (res.data as ChatMessage) : m)));
    } else {
      setMsgs((p) => p.filter((m) => m.id !== optimistic.id));
      setText(content); // ripristina così non si perde il testo
    }
  };

  const NAV = "calc(76px + env(safe-area-inset-bottom))";

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex items-center gap-3 mb-4">
        <span className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: T.sageSoft, color: T.sage }}><MessageCircle size={20} /></span>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight" style={{ color: T.ink }}>Chat con Be Kind</h1>
          <p className="text-xs" style={{ color: T.muted }}>Scrivici qui: resta tutto salvato.</p>
        </div>
      </div>

      <div ref={scrollRef} className="space-y-2.5" style={{ paddingBottom: "72px" }}>
        {loading && msgs.length === 0 ? (
          <div className="py-16 flex justify-center"><Loader2 className="animate-spin" style={{ color: T.sage }} /></div>
        ) : msgs.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: T.sageSoft, color: T.sage }}><MessageCircle size={26} /></div>
            <p className="font-semibold" style={{ color: T.ink }}>Inizia la conversazione</p>
            <p className="text-sm mt-1" style={{ color: T.muted }}>Scrivi qui invece che su WhatsApp: le tue richieste restano tutte in un posto.</p>
          </div>
        ) : (
          msgs.map((m) => {
            const mine = m.source === "client";
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${mine ? "rounded-br-md" : "rounded-bl-md"}`}
                  style={mine ? { background: T.sage, color: "#fff" } : { background: T.card, border: `1px solid ${T.cardBorder}`, color: T.ink }}>
                  {!mine && <p className="text-[11px] font-bold mb-0.5" style={{ color: T.sage }}>{m.authorName}</p>}
                  <p className="text-[15px] leading-snug whitespace-pre-wrap break-words">{m.content}</p>
                  <p className={`text-[10px] mt-1 ${mine ? "text-white/70" : ""}`} style={mine ? undefined : { color: T.softMuted }}>
                    {new Date(m.createdAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Barra di invio, ancorata sopra la bottom nav */}
      <div className="fixed inset-x-0 z-30" style={{ bottom: NAV }}>
        <div className="max-w-xl mx-auto px-5 py-2.5 flex items-end gap-2" style={{ background: "rgba(246,242,233,0.95)", backdropFilter: "blur(8px)", borderTop: `1px solid ${T.cardBorder}` }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            rows={1}
            placeholder="Scrivi un messaggio…"
            className="flex-1 resize-none rounded-2xl px-4 py-2.5 text-[15px] focus:outline-none max-h-28"
            style={{ background: T.card, border: `1px solid ${T.cardBorder}`, color: T.ink }}
          />
          <button onClick={() => void send()} disabled={!text.trim() || sending}
            className="w-11 h-11 rounded-full flex items-center justify-center text-white shrink-0 active:scale-95 transition-transform disabled:opacity-40" style={{ background: T.sage }}>
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}
