import { useMemo, useState } from "react";
import type { ContentIdea } from "@/types/content-ideas";

type BulkSchedulePreset = "daily" | "weekdays" | "mon_wed_fri" | "custom_interval";

interface BulkAddIdeasModalProps {
  open: boolean;
  ideas: ContentIdea[];
  onClose: () => void;
  onConfirm: (config: {
    baseDate: string;
    baseTime: string;
    dayInterval: number;
    schedulePreset: BulkSchedulePreset;
  }) => void;
}

function buildPreviewDates(
  start: Date,
  count: number,
  preset: BulkSchedulePreset,
  dayInterval: number,
): Date[] {
  if (count <= 0) return [];

  const result: Date[] = [];
  if (preset === "daily") {
    for (let index = 0; index < count; index += 1) {
      const date = new Date(start);
      date.setDate(date.getDate() + index);
      result.push(date);
    }
    return result;
  }

  if (preset === "custom_interval") {
    for (let index = 0; index < count; index += 1) {
      const date = new Date(start);
      if (dayInterval > 0) {
        date.setDate(date.getDate() + index * dayInterval);
      } else {
        date.setMinutes(date.getMinutes() + index * 30);
      }
      result.push(date);
    }
    return result;
  }

  const allowedDays = preset === "weekdays" ? [1, 2, 3, 4, 5] : [1, 3, 5];
  const cursor = new Date(start);
  while (result.length < count) {
    if (allowedDays.includes(cursor.getDay())) {
      result.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

export function BulkAddIdeasModal({ open, ideas, onClose, onConfirm }: BulkAddIdeasModalProps) {
  const [baseDate, setBaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [baseTime, setBaseTime] = useState("09:00");
  const [dayInterval, setDayInterval] = useState(1);
  const [schedulePreset, setSchedulePreset] = useState<BulkSchedulePreset>("daily");

  const datePreview = useMemo(() => {
    if (ideas.length === 0) return [];
    const start = new Date(`${baseDate}T${baseTime}:00`);
    const dates = buildPreviewDates(start, Math.min(3, ideas.length), schedulePreset, dayInterval);
    return ideas.slice(0, 3).map((idea, index) => {
      const date = dates[index] ?? start;
      return { title: idea.title, at: date.toLocaleString("it-IT") };
    });
  }, [baseDate, baseTime, dayInterval, ideas, schedulePreset]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-lg rounded-xl border border-card-border bg-card p-4">
        <h3 className="text-lg font-semibold">Aggiungi tutte al piano</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Stai importando {ideas.length} idee nel calendario. Imposta data e ora base.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm">
            Data base
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2"
              value={baseDate}
              onChange={(event) => setBaseDate(event.target.value)}
            />
          </label>
          <label className="text-sm">
            Ora base
            <input
              type="time"
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2"
              value={baseTime}
              onChange={(event) => setBaseTime(event.target.value)}
            />
          </label>
        </div>

        <div className="mt-3">
          <p className="text-sm">Preset distribuzione</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {([
              { key: "daily", label: "Ogni giorno" },
              { key: "weekdays", label: "Solo feriali" },
              { key: "mon_wed_fri", label: "Lun/Mer/Ven" },
              { key: "custom_interval", label: "Intervallo custom" },
            ] as const).map((preset) => (
              <button
                key={preset.key}
                type="button"
                className={`rounded-lg border px-2 py-2 text-xs ${
                  schedulePreset === preset.key
                    ? "border-violet-300 bg-violet-50 text-violet-700"
                    : "border-border"
                }`}
                onClick={() => setSchedulePreset(preset.key)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {schedulePreset === "custom_interval" && (
          <label className="mt-3 block text-sm">
            Intervallo in giorni tra idee ({dayInterval})
            <input
              type="range"
              min={0}
              max={7}
              step={1}
              value={dayInterval}
              onChange={(event) => setDayInterval(Number(event.target.value))}
              className="mt-2 w-full"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Se impostato a 0, le idee vengono distanziate di 30 minuti nello stesso giorno.
            </p>
          </label>
        )}

        {datePreview.length > 0 && (
          <div className="mt-3 rounded-lg border border-border bg-background p-2">
            <p className="text-xs font-semibold text-muted-foreground">Preview prime idee</p>
            <div className="mt-1 space-y-1">
              {datePreview.map((item) => (
                <p key={item.title} className="text-xs">
                  {item.title} · {item.at}
                </p>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="rounded-lg px-3 py-2 text-sm" onClick={onClose}>
            Annulla
          </button>
          <button
            type="button"
            className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
            onClick={() => {
              onConfirm({ baseDate, baseTime, dayInterval, schedulePreset });
              onClose();
            }}
          >
            Conferma importazione
          </button>
        </div>
      </div>
    </div>
  );
}
