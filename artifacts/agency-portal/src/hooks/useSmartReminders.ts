import { useEffect, useMemo, useState } from "react";
import { useListTasks } from "@workspace/api-client-react";
import { useClientContext } from "@/context/ClientContext";
import { getBriefCompletion } from "@/components/tools/brief/briefCompletion";
import { useReminderPreferences } from "@/hooks/useReminderPreferences";

type ReminderSeverity = "critical" | "warning" | "info";

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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(readMap));
  }, [readMap]);

  const tasks = useMemo(() => {
    if (!tasksRaw) return [] as any[];
    if (Array.isArray(tasksRaw)) return tasksRaw as any[];
    if (Array.isArray((tasksRaw as any).items)) return (tasksRaw as any).items as any[];
    return [tasksRaw as any].filter(Boolean);
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
            id: `blocked-posts-${client.id}-${blocked}`,
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
            id: `brief-${client.id}-${completion}`,
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
            id: `analytics-stale-${client.id}-${Math.floor(hours)}`,
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
      const unassignedCount = tasks.filter((task) => task.status !== "done" && !task.assigneeId).length;
      if (unassignedCount > 0) {
        output.push({
          id: `tasks-unassigned-${unassignedCount}`,
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
    const activeIds = new Set(reminders.map((item) => item.id));
    setReadMap((prev) => {
      const next: ReadState = {};
      Object.keys(prev).forEach((id) => {
        if (activeIds.has(id)) next[id] = prev[id];
      });
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
