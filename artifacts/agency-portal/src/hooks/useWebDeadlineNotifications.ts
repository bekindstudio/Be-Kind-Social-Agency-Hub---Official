import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { portalFetch } from "@workspace/api-client-react";
import { useSupabaseAuth } from "@/auth/SupabaseAuthContext";
import { useSmartReminders } from "@/hooks/useSmartReminders";

type ApiNotification = {
  id: number;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
};

const ENABLED_KEY = "agency_hub_web_notifications_enabled_v1";
const SEEN_KEY = "agency_hub_web_notifications_seen_v1";

function readSeenMap(): Record<string, true> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, true>;
  } catch {
    return {};
  }
}

function supportsWebNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function useWebDeadlineNotifications() {
  const { authDisabled, session } = useSupabaseAuth();
  const smart = useSmartReminders();
  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ENABLED_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    supportsWebNotifications() ? Notification.permission : "denied",
  );
  const [seenMap, setSeenMap] = useState<Record<string, true>>(() => readSeenMap());
  const seededRef = useRef(false);

  useEffect(() => {
    localStorage.setItem(ENABLED_KEY, String(enabled));
  }, [enabled]);

  useEffect(() => {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seenMap));
  }, [seenMap]);

  useEffect(() => {
    if (!supportsWebNotifications()) return;
    const onFocus = () => setPermission(Notification.permission);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const showNativeNotification = useCallback(async (title: string, body: string, url?: string, tag?: string) => {
    if (!supportsWebNotifications() || Notification.permission !== "granted") return;
    const iconPath = `${import.meta.env.BASE_URL}favicon.png`;

    const payload: NotificationOptions = {
      body,
      icon: iconPath,
      badge: iconPath,
      tag,
      data: { url },
    };

    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.showNotification(title, payload);
          return;
        }
      }
      const notification = new Notification(title, payload);
      notification.onclick = () => {
        window.focus();
        if (url) window.location.href = url;
      };
    } catch {
      // Ignore browser-level notification errors.
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!supportsWebNotifications()) return false;
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") setEnabled(true);
      return result === "granted";
    } catch {
      setPermission(Notification.permission);
      return Notification.permission === "granted";
    }
  }, []);

  const canRun = useMemo(() => {
    if (!supportsWebNotifications()) return false;
    if (!enabled) return false;
    if (permission !== "granted") return false;
    if (authDisabled) return true;
    return Boolean(session);
  }, [authDisabled, enabled, permission, session]);

  const unreadSmartReminders = useMemo(
    () => smart.reminders.filter((reminder) => !smart.isRead(reminder.id)),
    [smart.reminders, smart.unreadCount],
  );

  useEffect(() => {
    if (!canRun) return;
    let cancelled = false;

    const poll = async () => {
      const pending: Array<{ key: string; title: string; body: string; link?: string }> = [];

      unreadSmartReminders.forEach((reminder) => {
        const key = `smart:${reminder.id}`;
        if (seenMap[key]) return;
        pending.push({
          key,
          title: reminder.title,
          body: reminder.message,
          link: reminder.link,
        });
      });

      try {
        const res = await portalFetch("/api/notifications");
        if (res.ok) {
          const apiNotifications = (await res.json()) as ApiNotification[];
          apiNotifications
            .filter((item) => !item.isRead)
            .forEach((item) => {
              const key = `api:${item.id}`;
              if (seenMap[key]) return;
              pending.push({
                key,
                title: item.title,
                body: item.message,
                link: item.link,
              });
            });
        }
      } catch {
        // Ignore polling errors and keep next cycle active.
      }

      if (!seededRef.current && Object.keys(seenMap).length === 0) {
        // First sync: mark existing unread items as already seen to avoid notification flood.
        const bootstrapMap: Record<string, true> = {};
        pending.forEach((item) => {
          bootstrapMap[item.key] = true;
        });
        seededRef.current = true;
        if (!cancelled && Object.keys(bootstrapMap).length > 0) {
          setSeenMap((prev) => ({ ...prev, ...bootstrapMap }));
        }
        return;
      }

      seededRef.current = true;

      for (const item of pending) {
        await showNativeNotification(item.title, item.body, item.link, item.key);
      }

      if (!cancelled && pending.length > 0) {
        const next: Record<string, true> = {};
        pending.forEach((item) => {
          next[item.key] = true;
        });
        setSeenMap((prev) => ({ ...prev, ...next }));
      }
    };

    void poll();
    const interval = window.setInterval(() => {
      void poll();
    }, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [canRun, seenMap, showNativeNotification, unreadSmartReminders]);

  return {
    isSupported: supportsWebNotifications(),
    enabled,
    permission,
    setEnabled,
    requestPermission,
  };
}
