import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, Check, CheckCheck, Trash2, X, CheckSquare, FileText, FileSignature, MessageCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

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
  system: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
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

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const [notifRes, countRes] = await Promise.all([
        fetch("/api/notifications"),
        fetch("/api/notifications/unread-count"),
      ]);
      if (notifRes.ok) setNotifications(await notifRes.json());
      if (countRes.ok) {
        const { count } = await countRes.json();
        setUnreadCount(count);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const markRead = async (id: number) => {
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    fetchNotifications();
  };

  const markAllRead = async () => {
    await fetch("/api/notifications/read-all", { method: "POST" });
    fetchNotifications();
  };

  const deleteNotif = async (id: number) => {
    await fetch(`/api/notifications/${id}`, { method: "DELETE" });
    fetchNotifications();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(!open); if (!open) fetchNotifications(); }}
        className="relative p-2 rounded-lg hover:bg-sidebar-accent transition-colors"
      >
        <Bell size={18} className="text-sidebar-foreground/70" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center min-w-[18px] h-[18px]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-full ml-2 bottom-0 w-80 bg-card border border-border rounded-xl shadow-xl z-50 max-h-[460px] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Notifiche</h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="p-1 text-xs text-primary hover:underline flex items-center gap-1">
                  <CheckCheck size={13} /> Segna tutte lette
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
                <X size={14} />
              </button>
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                Nessuna notifica
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
                      if (n.link) window.location.href = n.link;
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
