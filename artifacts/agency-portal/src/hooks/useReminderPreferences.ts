import { useEffect, useMemo, useState } from "react";

export interface ReminderPreferences {
  eventsEnabled: boolean;
  blockedPostsEnabled: boolean;
  briefEnabled: boolean;
  analyticsEnabled: boolean;
  unassignedTasksEnabled: boolean;
  eventsWindowHours: number;
  blockedPostsHours: number;
  briefCompletionThreshold: number;
  analyticsStaleHours: number;
}

const STORAGE_KEY = "agency_hub_reminder_preferences_v1";

const DEFAULTS: ReminderPreferences = {
  eventsEnabled: true,
  blockedPostsEnabled: true,
  briefEnabled: true,
  analyticsEnabled: true,
  unassignedTasksEnabled: true,
  eventsWindowHours: 72,
  blockedPostsHours: 48,
  briefCompletionThreshold: 60,
  analyticsStaleHours: 24,
};

function sanitizeNumber(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function readInitialPreferences(): ReminderPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<ReminderPreferences>;
    return {
      eventsEnabled: parsed.eventsEnabled ?? DEFAULTS.eventsEnabled,
      blockedPostsEnabled: parsed.blockedPostsEnabled ?? DEFAULTS.blockedPostsEnabled,
      briefEnabled: parsed.briefEnabled ?? DEFAULTS.briefEnabled,
      analyticsEnabled: parsed.analyticsEnabled ?? DEFAULTS.analyticsEnabled,
      unassignedTasksEnabled: parsed.unassignedTasksEnabled ?? DEFAULTS.unassignedTasksEnabled,
      eventsWindowHours: sanitizeNumber(parsed.eventsWindowHours, DEFAULTS.eventsWindowHours, 1, 336),
      blockedPostsHours: sanitizeNumber(parsed.blockedPostsHours, DEFAULTS.blockedPostsHours, 1, 336),
      briefCompletionThreshold: sanitizeNumber(parsed.briefCompletionThreshold, DEFAULTS.briefCompletionThreshold, 0, 100),
      analyticsStaleHours: sanitizeNumber(parsed.analyticsStaleHours, DEFAULTS.analyticsStaleHours, 1, 336),
    };
  } catch {
    return DEFAULTS;
  }
}

export function useReminderPreferences() {
  const [preferences, setPreferences] = useState<ReminderPreferences>(() => readInitialPreferences());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  }, [preferences]);

  const actions = useMemo(
    () => ({
      setPartial: (patch: Partial<ReminderPreferences>) =>
        setPreferences((prev) => ({ ...prev, ...patch })),
      reset: () => setPreferences(DEFAULTS),
    }),
    [],
  );

  return {
    preferences,
    ...actions,
  };
}
