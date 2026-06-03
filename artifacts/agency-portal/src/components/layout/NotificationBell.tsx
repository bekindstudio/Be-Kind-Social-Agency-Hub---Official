import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { portalFetch } from "@workspace/api-client-react";
import { Bell, Check, CheckCheck, Trash2, X, CheckSquare, FileText, FileSignature, MessageCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSmartReminders } from "@/hooks/useSmartReminders";

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

const TYPE_ICON: Record<string, React.FC<{ size?: number; className?: string }>> = {
  task: CheckSquare,
  report: FileText,
  contract: FileSignature,
  message: MessageCircle,
  system: Info,
};

const TYPE_BG: Record<string, string> = {
  task: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  report: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  contract: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  message: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  deadline: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  system: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
};

type NotificationBellProps = {
  buttonClassName?: string;
  iconClassName?: string;
  panelClassName?: string;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ora";
  if (mins < 60) return `${mins}m fa`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h fa`;
  const days = Math.floor(hrs / 24);
  return `${days}g fa`;
}

export function NotificationBell({ buttonClassName, iconClassName, panelClassName }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const prevUnreadCount = useRef<number | null>(null);
  const soundEnabled = useRef(false);
  const smart = useSmartReminders();
  const [, setLocation] = useLocation();
  // Cancella la fetch precedente quando ne parte una nuova (evita race con polling concorrente).
  const inflightAbortRef = useRef<AbortController | null>(null);
  // Token incrementato ad ogni mutation (mark/delete): se un response GET in arrivo è "vecchio"
  // rispetto all'ultima mutation, lo scartiamo per evitare di sovrascrivere stato fresco.
  const mutationTokenRef = useRef(0);
  // Limita /api/deadlines/check (side-effect DB) a una volta ogni 5 minuti per client,
  // invece di chiamarlo ad ogni poll (era ~ogni 30s). Soluzione client-side temporanea
  // in attesa di spostare la generazione scadenze su Vercel cron server-side.
  const lastDeadlineCheckRef = useRef(0);
  const DEADLINE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

  const playNotificationSound = useCallback(() => {
    try {
      const Ctx =
        window.AudioContext ??
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
      osc.onended = () => {
        void ctx.close();
      };
    } catch {
      // ignore audio failures (autoplay policy / unsupported browser)
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    // Annulla qualunque richiesta precedente ancora in volo: vince sempre l'ultima.
    inflightAbortRef.current?.abort();
    const controller = new AbortController();
    inflightAbortRef.current = controller;
    // Snapshot del token mutation al momento dello start: se cambia durante il fetch,
    // significa che è arrivata una mark-read/delete e dobbiamo scartare questa risposta.
    const tokenAtStart = mutationTokenRef.current;
    try {
      // Genera/aggiorna gli avvisi di scadenza al massimo ogni 5 minuti per client.
      // Era POST ad ogni poll (~30s) = side-effect DB ripetuto, troppo costoso.
      const now = Date.now();
      if (now - lastDeadlineCheckRef.current >= DEADLINE_CHECK_INTERVAL_MS) {
        lastDeadlineCheckRef.current = now;
        await portalFetch("/api/deadlines/check", {
          method: "POST",
          signal: controller.signal,
        }).catch(() => null);
      }
      const [notifRes, countRes] = await Promise.all([
        portalFetch("/api/notifications", { signal: controller.signal }),
        portalFetch("/api/notifications/unread-count", { signal: controller.signal }),
      ]);
      // Se nel frattempo è partita una nuova fetch (o una mutation), molla.
      if (controller.signal.aborted || mutationTokenRef.current !== tokenAtStart) return;
      if (notifRes.status === 401 || countRes.status === 401) {
        setNotifications([]);
        setUnreadCount(0);
        return;
      }
      if (notifRes.ok) {
        const data = await notifRes.json();
        if (controller.signal.aborted || mutationTokenRef.current !== tokenAtStart) return;
        setNotifications(data);
      }
      if (countRes.ok) {
        const { count } = await countRes.json();
        if (controller.signal.aborted || mutationTokenRef.current !== tokenAtStart) return;
        setUnreadCount(count);
      }
    } catch (err) {
      // Le abort sono attese: non resettare lo stato in quel caso.
      if ((err as { name?: string })?.name === "AbortError") return;
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      if (inflightAbortRef.current === controller) {
        inflightAbortRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible" || open) {
        fetchNotifications();
      }
    }, 30000);
    return () => {
      clearInterval(interval);
      // Annulla la fetch in volo all'unmount per evitare setState su componente smontato.
      inflightAbortRef.current?.abort();
      inflightAbortRef.current = null;
    };
  }, [fetchNotifications, open]);

  useEffect(() => {
    const enableSound = () => {
      soundEnabled.current = true;
    };
    window.addEventListener("pointerdown", enableSound, { once: true });
    window.addEventListener("keydown", enableSound, { once: true });
    return () => {
      window.removeEventListener("pointerdown", enableSound);
      window.removeEventListener("keydown", enableSound);
    };
  }, []);

  useEffect(() => {
    if (prevUnreadCount.current == null) {
      prevUnreadCount.current = unreadCount + smart.unreadCount;
      return;
    }
    const totalUnread = unreadCount + smart.unreadCount;
    const increased = totalUnread > prevUnreadCount.current;
    if (increased && soundEnabled.current && document.visibilityState === "visible") {
      playNotificationSound();
    }
    prevUnreadCount.current = totalUnread;
  }, [unreadCount, smart.unreadCount, playNotificationSound]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const markRead = async (id: number) => {
    // Bump token PRIMA della mutation: ogni GET in volo verrà scartato al ritorno.
    mutationTokenRef.current += 1;
    await portalFetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    fetchNotifications();
  };

  const markAllRead = async () => {
    mutationTokenRef.current += 1;
    await portalFetch("/api/notifications/read-all", { method: "POST" });
    smart.markAllRead();
    fetchNotifications();
  };

  const deleteNotif = async (id: number) => {
    mutationTokenRef.current += 1;
    await portalFetch(`/api/notifications/${id}`, { method: "DELETE" });
    fetchNotifications();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={`Notifiche${unreadCount + smart.unreadCount > 0 ? ` (${unreadCount + smart.unreadCount} non lette)` : ""}`}
        title="Notifiche"
        onClick={() => { setOpen(!open); if (!open) fetchNotifications(); }}
        className={cn("relative p-2 rounded-lg hover:bg-sidebar-accent transition-colors", buttonClassName)}
      >
        <Bell size={18} className={cn("text-sidebar-foreground/70", iconClassName)} />
        {unreadCount + smart.unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center min-w-[18px] h-[18px]">
            {unreadCount + smart.unreadCount > 9 ? "9+" : unreadCount + smart.unreadCount}
          </span>
        )}
      </button>

      {open && (
        // Default: pannello agganciato a destra sotto il bottone (caso header top-right).
        // Per altri layout (es. sidebar verticale) passare `panelClassName` per override
        // (es. "left-full ml-2 bottom-0" o "left-0 top-full mt-2").
        // `max-w-[calc(100vw-1rem)]` evita overflow orizzontale su viewport stretti.
        <div className={cn("absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-1rem)] bg-card border border-border rounded-xl shadow-xl z-50 max-h-[460px] flex flex-col", panelClassName)}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Notifiche</h3>
            <div className="flex items-center gap-1">
              {unreadCount + smart.unreadCount > 0 && (
                <button onClick={markAllRead} className="p-1 text-xs text-primary hover:underline flex items-center gap-1">
                  <CheckCheck size={13} /> Segna tutte lette
                </button>
              )}
              <button type="button" aria-label="Chiudi pannello notifiche" onClick={() => setOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
                <X size={14} />
              </button>
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {smart.reminders.length > 0 && (
              <div className="border-b border-border/40 px-4 py-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reminder intelligenti</p>
                  {smart.unreadCount > 0 && (
                    <button className="text-[11px] text-primary hover:underline" onClick={smart.markAllRead}>
                      Segna reminder letti
                    </button>
                  )}
                </div>
                <div className="space-y-1.5">
                  {smart.reminders.slice(0, 6).map((reminder) => {
                    const unread = !smart.isRead(reminder.id);
                    return (
                      <button
                        key={reminder.id}
                        type="button"
                        className={cn(
                          "w-full rounded-lg border px-2 py-1.5 text-left text-xs",
                          reminder.severity === "critical"
                            ? "border-rose-200 bg-rose-50 text-rose-800"
                            : reminder.severity === "warning"
                              ? "border-amber-200 bg-amber-50 text-amber-800"
                              : "border-blue-200 bg-blue-50 text-blue-800",
                          unread && "ring-1 ring-primary/40",
                        )}
                        onClick={() => {
                          smart.markRead(reminder.id);
                          setOpen(false);
                          setLocation(reminder.link);
                        }}
                      >
                        <span className="inline-flex items-center gap-1 font-semibold">
                          <AlertTriangle size={12} />
                          {reminder.title}
                        </span>
                        <span className="block text-[11px] opacity-80">{reminder.message}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {notifications.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                {smart.reminders.length === 0 ? "Nessuna notifica" : "Nessuna notifica API"}
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = TYPE_ICON[n.type] ?? TYPE_ICON.system;
                const bg = TYPE_BG[n.type] ?? TYPE_BG.system;
                return (
                  <div
                    key={n.id}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 border-b border-border/40 hover:bg-muted/40 transition-colors group cursor-pointer",
                      !n.isRead && "bg-primary/5"
                    )}
                    onClick={() => {
                      if (!n.isRead) markRead(n.id);
                      if (n.link) {
                        setOpen(false);
                        setLocation(n.link);
                      }
                    }}
                  >
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5", bg)}>
                      <Icon size={15} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm leading-snug text-foreground", !n.isRead ? "font-semibold" : "font-medium")}>{n.title}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{n.message}</p>
                      <p className="text-[11px] text-muted-foreground/50 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {!n.isRead && (
                        <button onClick={(e) => { e.stopPropagation(); markRead(n.id); }} className="p-1 text-muted-foreground hover:text-primary" title="Segna come letta">
                          <Check size={13} />
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); deleteNotif(n.id); }} className="p-1 text-muted-foreground hover:text-destructive" title="Elimina">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
