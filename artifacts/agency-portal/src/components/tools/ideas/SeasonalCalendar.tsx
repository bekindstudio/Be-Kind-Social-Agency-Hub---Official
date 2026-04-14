import { useMemo } from "react";
import { CalendarDays } from "lucide-react";
import { ITALIAN_EVENTS } from "@/components/tools/ideas/constants";

interface SeasonalCalendarProps {
  month: number;
  year: number;
  onSelectEvent: (eventName: string) => void;
}

function monthKey(month: number): string {
  return String(month).padStart(2, "0");
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString("it-IT", { month: "long", year: "numeric" });
}

export function SeasonalCalendar({ month, year, onSelectEvent }: SeasonalCalendarProps) {
  const months = useMemo(() => {
    return [month - 1, month, month + 1].map((value) => {
      if (value < 1) return { year: year - 1, month: 12 };
      if (value > 12) return { year: year + 1, month: 1 };
      return { year, month: value };
    });
  }, [month, year]);

  return (
    <div className="rounded-xl border border-card-border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <CalendarDays size={15} className="text-violet-500" />
        <p className="text-sm font-semibold">Calendario stagionale</p>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        {months.map((item) => {
          const events = ITALIAN_EVENTS[monthKey(item.month)] ?? [];
          return (
            <div key={`${item.year}-${item.month}`} className="rounded-lg border border-border bg-background p-2">
              <p className="mb-2 text-xs font-semibold capitalize">{monthLabel(item.year, item.month)}</p>
              <div className="space-y-1">
                {events.length === 0 && <p className="text-xs text-muted-foreground">Nessun evento fisso</p>}
                {events.map((eventItem) => (
                  <button
                    key={eventItem.date + eventItem.name}
                    type="button"
                    onClick={() => onSelectEvent(eventItem.name)}
                    className="flex w-full items-center justify-between rounded-md border border-border px-2 py-1 text-left text-xs hover:bg-muted"
                  >
                    <span>{eventItem.name}</span>
                    <span
                      className={
                        eventItem.relevance === "high"
                          ? "text-emerald-600"
                          : eventItem.relevance === "medium"
                            ? "text-amber-600"
                            : "text-muted-foreground"
                      }
                    >
                      {eventItem.date}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
