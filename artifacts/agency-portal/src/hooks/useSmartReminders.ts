import { useEffect, useMemo, useRef, useState } from "react";
import { useListTasks, type Task } from "@workspace/api-client-react";
import { useClientContext } from "@/context/ClientContext";
import { getBriefCompletion } from "@/components/tools/brief/briefCompletion";
import { useReminderPreferences } from "@/hooks/useReminderPreferences";

type ReminderSeverity = "critical" | "warning" | "info";

// Canonical "closed" task statuses. The backend uses `done` for tasks (see
// api-server/src/routes/tasks.ts) and `completed`/`archived` for projects, but
// we accept all three here to stay resilient against legacy rows or future
// schema tweaks — the bug we're guarding against is treating a closed task as
// "unassigned" just because the status string evolved.
const DONE_TASK_STATUSES = new Set<string>(["done", "completed", "archived"]);

function isTaskOpen(task: Task): boolean {
  return !DONE_TASK_STATUSES.has(task.status);
}

function isTaskUnassigned(task: Task): boolean {
  // assigneeId is `number | null | undefined` in the schema; treat 0 as unset
  // too so we don't miss seeded rows that use 0 as a sentinel.
  return task.assigneeId == null || task.assigneeId === 0;
}

export interface SmartReminder {
  id: string;
  title: string;
  message: string;
  link: string;
  severity: ReminderSeverity;
  createdAt: string;
}

type ReadState = Record<string, boolean>;

const STORAGE_KEY = "agency_hub_smart_reminders_read_v1";

function readState(): ReadState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as ReadState;
  } catch {
    return {};
  }
}

export function useSmartReminders() {
  const { clients, briefsByClient, postsByClient, analyticsByClient, allClientEvents } = useClientContext();
  const { data: tasksRaw } = useListTasks({});
  const { preferences } = useReminderPreferences();
  const [readMap, setReadMap] = useState<ReadState>(() => readState());
  const initialLoadRef = useRef(true);

  useEffect(() => {
    // Skip the very first write right after mount: state was just hydrated
    // from localStorage, persisting it again would be a no-op that can race
    // with another tab writing meaningful data at the same time.
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(readMap));
  }, [readMap]);

  const tasks = useMemo<Task[]>(() => {
    if (!tasksRaw) return [];
    if (Array.isArray(tasksRaw)) return tasksRaw as Task[];
    const maybeItems = (tasksRaw as { items?: unknown }).items;
    if (Array.isArray(maybeItems)) return maybeItems as Task[];
    return [tasksRaw as Task].filter(Boolean);
  }, [tasksRaw]);

  const reminders = useMemo<SmartReminder[]>(() => {
    const now = Date.now();
    const eventsWindowEnd = now + preferences.eventsWindowHours * 60 * 60 * 1000;
    const output: SmartReminder[] = [];

    if (preferences.eventsEnabled) {
      allClientEvents
        .filter((event) => {
          const t = new Date(event.date).getTime();
          return t >= now && t <= eventsWindowEnd;
        })
        .forEach((event) => {
          const clientName = clients.find((client) => client.id === event.clientId)?.name ?? "Cliente";
          output.push({
            id: `deadline-${event.id}`,
            title: `Scadenza vicina: ${event.title}`,
            message: `${clientName} · evento entro ${preferences.eventsWindowHours}h`,
            link: "/dashboard",
            severity: event.priority === "high" ? "critical" : "warning",
            createdAt: new Date().toISOString(),
          });
        });
    }

    if (preferences.blockedPostsEnabled) {
      clients.forEach((client) => {
        const posts = postsByClient[client.id] ?? [];
        const blocked = posts.filter((post) => {
          if (post.status === "rejected") return true;
          if (post.status !== "pending_approval") return false;
          return now - new Date(post.updatedAt).getTime() > preferences.blockedPostsHours * 60 * 60 * 1000;
        }).length;
        if (blocked > 0) {
          output.push({
            id: `blocked-posts-${client.id}`,
            title: `${blocked} post bloccati`,
            message: `${client.name} · verifica approvazioni/revisioni`,
            link: "/tools/calendar",
            severity: blocked >= 3 ? "critical" : "warning",
            createdAt: new Date().toISOString(),
          });
        }
      });
    }

    if (preferences.briefEnabled) {
      clients.forEach((client) => {
        const completion = getBriefCompletion(briefsByClient[client.id] ?? null);
        if (completion < preferences.briefCompletionThreshold) {
          output.push({
            id: `brief-${client.id}`,
            title: `Brief incompleto (${completion}%)`,
            message: `${client.name} · completare sezioni strategiche`,
            link: "/tools/brief",
            severity: completion < Math.max(0, preferences.briefCompletionThreshold - 20) ? "critical" : "warning",
            createdAt: new Date().toISOString(),
          });
        }
      });
    }

    if (preferences.analyticsEnabled) {
      clients.forEach((client) => {
        const analytics = analyticsByClient[client.id];
        if (!analytics?.updatedAt) {
          output.push({
            id: `analytics-missing-${client.id}`,
            title: "Analytics non collegate",
            message: `${client.name} · sincronizza account e insight`,
            link: "/tools/analytics",
            severity: "warning",
            createdAt: new Date().toISOString(),
          });
          return;
        }
        const hours = (now - new Date(analytics.updatedAt).getTime()) / (1000 * 60 * 60);
        if (hours > preferences.analyticsStaleHours) {
          output.push({
            id: `analytics-stale-${client.id}`,
            title: "Analytics non aggiornate",
            message: `${client.name} · ultimo update ${Math.floor(hours)}h fa`,
            link: "/tools/analytics",
            severity: hours > preferences.analyticsStaleHours * 3 ? "critical" : "warning",
            createdAt: new Date().toISOString(),
          });
        }
      });
    }

    if (preferences.unassignedTasksEnabled) {
      const unassignedCount = tasks.filter((task) => isTaskOpen(task) && isTaskUnassigned(task)).length;
      if (unassignedCount > 0) {
        output.push({
          id: `tasks-unassigned`,
          title: `${unassignedCount} task senza owner`,
          message: "Assegna responsabilità per evitare blocchi operativi",
          link: "/tasks",
          severity: unassignedCount >= 5 ? "critical" : "warning",
          createdAt: new Date().toISOString(),
        });
      }
    }

    return output;
  }, [allClientEvents, analyticsByClient, briefsByClient, clients, postsByClient, preferences, tasks]);

  useEffect(() => {
    // Keep read map clean from stale reminders.
    // Skip cleanup while reminders are still loading (empty list often means
    // clients/tasks haven't hydrated yet): wiping readMap to {} now would
    // race against another tab that already has valid read state persisted.
    if (reminders.length === 0) return;
    const activeIds = new Set(reminders.map((item) => item.id));
    setReadMap((prev) => {
      const prevKeys = Object.keys(prev);
      const next: ReadState = {};
      let changed = false;
      prevKeys.forEach((id) => {
        if (activeIds.has(id)) {
          next[id] = prev[id];
        } else {
          changed = true;
        }
      });
      // Bail out with the same reference if nothing actually changed: avoids
      // a useless re-render and an unnecessary localStorage write.
      if (!changed) return prev;
      return next;
    });
  }, [reminders]);

  const unreadCount = reminders.filter((item) => !readMap[item.id]).length;

  return {
    reminders,
    unreadCount,
    isRead: (id: string) => Boolean(readMap[id]),
    markRead: (id: string) => setReadMap((prev) => ({ ...prev, [id]: true })),
    markAllRead: () =>
      setReadMap((prev) => {
        const next = { ...prev };
        reminders.forEach((item) => {
          next[item.id] = true;
        });
        return next;
      }),
    clearAllReadState: () => setReadMap({}),
  };
}
