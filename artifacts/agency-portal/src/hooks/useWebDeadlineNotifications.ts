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
const ENABLED_AT_KEY = "agency_hub_web_notifications_enabled_at_v1";

function readEnabledAt(): number | null {
  try {
    const raw = localStorage.getItem(ENABLED_AT_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

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
  const seenMapRef = useRef<Record<string, true>>(seenMap);
  const seededRef = useRef(false);

  useEffect(() => {
    seenMapRef.current = seenMap;
  }, [seenMap]);

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
      if (result === "granted") {
        // Persist enable timestamp so the polling loop only suppresses items
        // that pre-date the user's opt-in (anything newer must surface, even
        // on a fresh localStorage / incognito session).
        try {
          if (!readEnabledAt()) {
            localStorage.setItem(ENABLED_AT_KEY, String(Date.now()));
          }
        } catch {
          // localStorage may be unavailable; degrade gracefully.
        }
        setEnabled(true);
      }
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
    [smart.reminders],
  );

  useEffect(() => {
    if (!canRun) return;
    let cancelled = false;

    const poll = async () => {
      const currentSeenMap = seenMapRef.current;
      const pending: Array<{
        key: string;
        title: string;
        body: string;
        link?: string;
        critical: boolean;
      }> = [];

      // Track which keys are still "alive" in the current sources so we can
      // garbage-collect stale entries from seenMap (otherwise the map grows
      // indefinitely: deleted notifications, smart reminders whose id
      // changes when underlying data changes, etc.).
      const aliveKeys = new Set<string>();
      let apiFeedFetched = false;

      unreadSmartReminders.forEach((reminder) => {
        const key = `smart:${reminder.id}`;
        aliveKeys.add(key);
        if (currentSeenMap[key]) return;
        pending.push({
          key,
          title: reminder.title,
          body: reminder.message,
          link: reminder.link,
          critical: reminder.severity === "critical",
        });
      });
      // Also keep currently-read smart reminders alive so we don't drop their
      // seen marker just because they happen to be read (they'd resurface as
      // unread later if state ever flips back).
      smart.reminders.forEach((reminder) => {
        aliveKeys.add(`smart:${reminder.id}`);
      });

      try {
        const res = await portalFetch("/api/notifications");
        if (res.ok) {
          apiFeedFetched = true;
          const apiNotifications = (await res.json()) as ApiNotification[];
          apiNotifications.forEach((item) => {
            aliveKeys.add(`api:${item.id}`);
          });
          apiNotifications
            .filter((item) => !item.isRead)
            .forEach((item) => {
              const key = `api:${item.id}`;
              if (currentSeenMap[key]) return;
              pending.push({
                key,
                title: item.title,
                body: item.message,
                link: item.link,
                // No severity exposed by the API today; treat as non-critical
                // so they fall under the bootstrap suppression rules.
                critical: false,
              });
            });
        }
      } catch {
        // Ignore polling errors and keep next cycle active.
      }

      // Garbage-collect stale seenMap keys. We only prune `api:*` if the feed
      // was successfully fetched this tick (otherwise a network blip would
      // wipe legit markers). `smart:*` keys are always safe to prune against
      // the locally-computed reminders list.
      const prunedSeenMap: Record<string, true> = {};
      let prunedCount = 0;
      Object.keys(currentSeenMap).forEach((key) => {
        if (key.startsWith("smart:")) {
          if (aliveKeys.has(key)) {
            prunedSeenMap[key] = true;
          } else {
            prunedCount += 1;
          }
          return;
        }
        if (key.startsWith("api:")) {
          if (!apiFeedFetched || aliveKeys.has(key)) {
            prunedSeenMap[key] = true;
          } else {
            prunedCount += 1;
          }
          return;
        }
        // Unknown / legacy keys: keep as-is to avoid surprising regressions.
        prunedSeenMap[key] = true;
      });
      if (prunedCount > 0 && !cancelled) {
        seenMapRef.current = prunedSeenMap;
        setSeenMap(prunedSeenMap);
      }

      // Bootstrap path: first poll AND no prior seen entries. We must NOT
      // silently swallow every notification (regression: critical scadenze
      // were lost on incognito / fresh localStorage). Instead:
      //   - backfill ENABLED_AT_KEY if missing so future polls have a
      //     reliable cutoff,
      //   - still surface items flagged as `critical`,
      //   - seed the rest as already-seen.
      if (!seededRef.current && Object.keys(currentSeenMap).length === 0) {
        try {
          if (!readEnabledAt()) {
            localStorage.setItem(ENABLED_AT_KEY, String(Date.now()));
          }
        } catch {
          // Storage unavailable; continue without persistent cutoff.
        }

        const toShow = pending.filter((item) => item.critical);
        const toSeed = pending.filter((item) => !item.critical);

        for (const item of toShow) {
          await showNativeNotification(item.title, item.body, item.link, item.key);
        }

        seededRef.current = true;

        if (!cancelled && pending.length > 0) {
          const next: Record<string, true> = {};
          // Mark both shown and seeded items so they don't fire again next tick.
          toShow.forEach((item) => {
            next[item.key] = true;
          });
          toSeed.forEach((item) => {
            next[item.key] = true;
          });
          setSeenMap((prev) => ({ ...prev, ...next }));
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
  }, [canRun, showNativeNotification, unreadSmartReminders]);

  return {
    isSupported: supportsWebNotifications(),
    enabled,
    permission,
    setEnabled,
    requestPermission,
  };
}
