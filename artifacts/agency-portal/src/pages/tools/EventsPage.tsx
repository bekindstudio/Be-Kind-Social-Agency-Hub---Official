import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { useClientContext } from "@/context/ClientContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { ClientEvent } from "@/types/client";

const WEEK_LABELS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

function monthLabel(date: Date): string {
  return date.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfDay(dateInput: string | Date): Date {
  const date = typeof dateInput === "string" ? new Date(dateInput) : new Date(dateInput);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toDateInputValue(dateInput: string | Date): string {
  return startOfDay(dateInput).toISOString().slice(0, 10);
}

function formatEventRange(startIso: string, endIso?: string): string {
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : null;
  if (!end || toDateInputValue(start) === toDateInputValue(end)) return start.toLocaleDateString("it-IT");
  return `${start.toLocaleDateString("it-IT")} - ${end.toLocaleDateString("it-IT")}`;
}

function buildMonthDays(current: Date): Date[] {
  const year = current.getFullYear();
  const month = current.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - startOffset);
  return Array.from({ length: 42 }, (_, idx) => {
    const d = new Date(start);
    d.setDate(start.getDate() + idx);
    d.setHours(0, 0, 0, 0);
    return d;
  });
}

type EventForm = {
  title: string;
  date: string;
  endDate: string;
  type: ClientEvent["type"];
  priority: ClientEvent["priority"];
  note: string;
};

export default function EventsPage() {
  const { activeClient, clientEvents, addClientEvent, updateClientEvent, deleteClientEvent } = useClientContext();
  const { toast } = useToast();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [form, setForm] = useState<EventForm>({
    title: "",
    date: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    type: "deadline",
    priority: "medium",
    note: "",
  });
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  const days = useMemo(() => buildMonthDays(cursor), [cursor]);
  const month = cursor.getMonth();
  const year = cursor.getFullYear();

  const eventsByDay = useMemo(() => {
    const map = new Map<string, typeof clientEvents>();
    for (const event of clientEvents) {
      const start = startOfDay(event.date);
      const end = event.endDate ? startOfDay(event.endDate) : start;
      const safeEnd = end.getTime() >= start.getTime() ? end : start;
      const daysSpan = Math.floor((safeEnd.getTime() - start.getTime()) / 86400000);
      const cappedSpan = Math.min(daysSpan, 90);
      for (let idx = 0; idx <= cappedSpan; idx += 1) {
        const d = new Date(start);
        d.setDate(start.getDate() + idx);
        const key = dayKey(d);
        const current = map.get(key) ?? [];
        map.set(key, [...current, event]);
      }
    }
    return map;
  }, [clientEvents]);

  const upcoming = useMemo(
    () =>
      [...clientEvents]
        .filter((event) => {
          const end = event.endDate ? startOfDay(event.endDate) : startOfDay(event.date);
          return end.getTime() >= Date.now() - 24 * 60 * 60 * 1000;
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 6),
    [clientEvents],
  );

  const resetForm = () => {
    setForm({
      title: "",
      date: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      type: "deadline",
      priority: "medium",
      note: "",
    });
    setEditingEventId(null);
  };

  const handleSubmit = () => {
    if (!activeClient) return;
    const title = form.title.trim();
    if (!title || !form.date || !form.endDate) {
      toast({ title: "Compila titolo, data inizio e data fine", variant: "destructive" });
      return;
    }
    if (form.endDate < form.date) {
      toast({ title: "La data fine non puo precedere la data inizio", variant: "destructive" });
      return;
    }
    const payload = {
      title,
      date: new Date(`${form.date}T09:00:00`).toISOString(),
      endDate: new Date(`${form.endDate}T18:00:00`).toISOString(),
      type: form.type,
      priority: form.priority,
      note: form.note.trim() || undefined,
    };
    if (editingEventId) {
      updateClientEvent(editingEventId, payload);
      toast({ title: "Evento aggiornato" });
      resetForm();
      return;
    }
    addClientEvent({
      clientId: activeClient.id,
      ...payload,
    });
    toast({ title: "Evento aggiunto" });
    resetForm();
  };

  const beginEdit = (eventId: string) => {
    const event = clientEvents.find((item) => item.id === eventId);
    if (!event) return;
    setEditingEventId(event.id);
    setForm({
      title: event.title,
      date: toDateInputValue(event.date),
      endDate: toDateInputValue(event.endDate ?? event.date),
      type: event.type,
      priority: event.priority,
      note: event.note ?? "",
    });
  };

  const monthSpanCount = useMemo(() => {
    return clientEvents.filter((event) => {
      const start = startOfDay(event.date);
      const end = event.endDate ? startOfDay(event.endDate) : start;
      const firstMonthDay = new Date(year, month, 1);
      const lastMonthDay = new Date(year, month + 1, 0);
      return end.getTime() >= firstMonthDay.getTime() && start.getTime() <= lastMonthDay.getTime();
    }).length;
  }, [clientEvents, month, year]);

  const multiDayCount = useMemo(() => {
    return clientEvents.filter((event) => {
      const end = event.endDate ? toDateInputValue(event.endDate) : toDateInputValue(event.date);
      return end > toDateInputValue(event.date);
    }).length;
  }, [clientEvents]);

  const eventTypeLabel: Record<ClientEvent["type"], string> = {
    deadline: "Scadenza",
    campaign: "Campagna",
    launch: "Lancio",
    meeting: "Meeting",
    other: "Altro",
  };

  return (
    <Layout>
      <div className="mx-auto max-w-[1600px] space-y-4 p-6 lg:p-8">
        <div>
          <h1 className="text-2xl font-bold">Calendario Eventi Cliente</h1>
          <p className="text-sm text-muted-foreground">
            Promemoria interno dei momenti importanti per {activeClient?.name ?? "il cliente selezionato"}.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-xl border border-card-border bg-card p-4 xl:col-span-2">
            <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
              <div className="rounded-lg border border-border bg-muted/30 px-2.5 py-2 text-xs">
                <p className="text-muted-foreground">Eventi mese</p>
                <p className="text-sm font-semibold">{monthSpanCount}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 px-2.5 py-2 text-xs">
                <p className="text-muted-foreground">Multi-giorno</p>
                <p className="text-sm font-semibold">{multiDayCount}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 px-2.5 py-2 text-xs">
                <p className="text-muted-foreground">Alta priorita</p>
                <p className="text-sm font-semibold">{clientEvents.filter((event) => event.priority === "high").length}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 px-2.5 py-2 text-xs">
                <p className="text-muted-foreground">Totale archivio</p>
                <p className="text-sm font-semibold">{clientEvents.length}</p>
              </div>
            </div>
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                className="rounded-lg border border-input p-2"
              >
                <ChevronLeft size={16} />
              </button>
              <p className="text-sm font-semibold capitalize">{monthLabel(cursor)}</p>
              <button
                type="button"
                onClick={() => setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                className="rounded-lg border border-input p-2"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="grid grid-cols-7 border-b border-border bg-muted/30">
              {WEEK_LABELS.map((label) => (
                <div key={label} className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground">
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((date) => {
                const key = dayKey(date);
                const inMonth = date.getMonth() === month && date.getFullYear() === year;
                const items = eventsByDay.get(key) ?? [];
                return (
                  <div
                    key={key}
                    className={cn(
                      "min-h-[110px] border-b border-r border-border p-1.5",
                      inMonth ? "bg-background" : "bg-muted/20 text-muted-foreground",
                    )}
                  >
                    <p className="mb-1 text-xs font-medium">{date.getDate()}</p>
                    <div className="space-y-1">
                      {items.slice(0, 2).map((event) => (
                        (() => {
                          const eventStart = toDateInputValue(event.date);
                          const eventEnd = toDateInputValue(event.endDate ?? event.date);
                          const keyDate = toDateInputValue(date);
                          const isStart = keyDate === eventStart;
                          const isEnd = keyDate === eventEnd;
                          const isRange = eventEnd > eventStart;
                          return (
                        <div
                          key={`${event.id}-${keyDate}`}
                          className={cn(
                            "truncate rounded px-1.5 py-1 text-[11px]",
                            event.priority === "high"
                              ? "bg-rose-100 text-rose-800"
                              : event.priority === "medium"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800",
                            isRange && "ring-1 ring-inset ring-current/25",
                            isRange && !isStart && !isEnd && "opacity-90",
                          )}
                          title={`${event.title}${isRange ? ` (${formatEventRange(event.date, event.endDate)})` : ""}`}
                        >
                          {isRange && isStart ? "▶ " : ""}
                          {isRange && !isStart && !isEnd ? "• " : ""}
                          {isRange && isEnd ? "◀ " : ""}
                          {event.title}
                        </div>
                          );
                        })()
                      ))}
                      {items.length > 2 && <p className="text-[11px] text-muted-foreground">+{items.length - 2} altri</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-card-border bg-card p-4">
              <h2 className="mb-3 text-sm font-semibold">{editingEventId ? "Modifica evento" : "Nuovo evento"}</h2>
              <div className="space-y-2">
                <input
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Titolo evento"
                  className="w-full rounded-lg border border-input px-3 py-2 text-sm"
                />
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) =>
                    setForm((prev) => {
                      const nextDate = e.target.value;
                      const nextEndDate = prev.endDate < nextDate ? nextDate : prev.endDate;
                      return { ...prev, date: nextDate, endDate: nextEndDate };
                    })
                  }
                  className="w-full rounded-lg border border-input px-3 py-2 text-sm"
                />
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">Data fine (per intervallo multi-giorno)</label>
                  <input
                    type="date"
                    min={form.date}
                    value={form.endDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
                    className="w-full rounded-lg border border-input px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={form.type}
                    onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as typeof form.type }))}
                    className="rounded-lg border border-input px-3 py-2 text-sm"
                  >
                    <option value="deadline">Scadenza</option>
                    <option value="campaign">Campagna</option>
                    <option value="launch">Lancio</option>
                    <option value="meeting">Meeting</option>
                    <option value="other">Altro</option>
                  </select>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value as typeof form.priority }))}
                    className="rounded-lg border border-input px-3 py-2 text-sm"
                  >
                    <option value="low">Priorita bassa</option>
                    <option value="medium">Priorita media</option>
                    <option value="high">Priorita alta</option>
                  </select>
                </div>
                <textarea
                  rows={3}
                  value={form.note}
                  onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                  placeholder="Nota (opzionale)"
                  className="w-full resize-none rounded-lg border border-input px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                >
                  {editingEventId ? <Pencil size={14} /> : <Plus size={14} />}
                  {editingEventId ? "Salva modifiche" : "Aggiungi evento"}
                </button>
                {editingEventId ? (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="w-full rounded-lg border border-input px-3 py-2 text-sm font-medium"
                  >
                    Annulla modifica
                  </button>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border border-card-border bg-card p-4">
              <h2 className="mb-3 text-sm font-semibold">Prossimi eventi</h2>
              <div className="space-y-2">
                {upcoming.length === 0 && <p className="text-sm text-muted-foreground">Nessun evento pianificato.</p>}
                {upcoming.map((event) => (
                  <div key={event.id} className="rounded-lg border border-border p-2 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{event.title}</p>
                        <p className="text-xs text-muted-foreground">{formatEventRange(event.date, event.endDate)}</p>
                        <p className="text-[11px] text-muted-foreground">{eventTypeLabel[event.type]} · priorita {event.priority}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => beginEdit(event.id)}
                          className="rounded p-1 text-muted-foreground hover:bg-muted"
                          title="Modifica evento"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteClientEvent(event.id)}
                          className="rounded p-1 text-muted-foreground hover:bg-muted"
                          title="Elimina evento"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {event.note ? <p className="mt-1 text-xs text-muted-foreground">{event.note}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
