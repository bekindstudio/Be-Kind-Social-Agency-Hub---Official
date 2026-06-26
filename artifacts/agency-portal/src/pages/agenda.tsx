import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { portalFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  CalendarClock,
  Plus,
  Phone,
  Users as UsersIcon,
  MapPin,
  Clock,
  Pencil,
  Trash2,
  X,
  FileText,
  ChevronLeft,
  ChevronRight,
  List as ListIcon,
  LayoutGrid,
} from "lucide-react";

/* Agenda personale — appuntamenti privati dell'utente (call, meeting, in-sede).
   Distinta da /tools/events (eventi cliente condivisi col team). Vista a hero
   "Hai N appuntamenti questa settimana" + sezioni temporali (oggi/domani/dopo). */

type AgendaEvent = {
  id: number;
  userId: string;
  title: string;
  type: "call" | "meeting" | "in_sede";
  startAt: string;
  endAt: string | null;
  location: string | null;
  notes: string | null;
  attendees: string | null;
  createdAt: string;
  updatedAt: string;
};

// Eventi cliente (da /api/dashboard/events). Subset dei campi che ci servono.
type ClientEventRow = {
  id: string;
  clientId: number;
  clientName: string | null;
  clientColor: string;
  title: string;
  date: string;
  endDate?: string | null;
  type: string | null;
  priority?: string | null;
};

// Unione canonica usata dalla vista calendario mensile.
type CalEvent =
  | {
      key: string;
      title: string;
      date: string;
      source: "personal";
      personalType: AgendaEvent["type"];
      personalRef: AgendaEvent;
    }
  | {
      key: string;
      title: string;
      date: string;
      source: "client";
      clientId: number;
      clientName: string | null;
      clientColor: string;
      clientEventType: string | null;
    };

type FormState = {
  title: string;
  type: AgendaEvent["type"];
  startDate: string;
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
  attendees: string;
};

const TYPE_META: Record<AgendaEvent["type"], { label: string; icon: any; color: string }> = {
  call: { label: "Call", icon: Phone, color: "text-sky-600" },
  meeting: { label: "Meeting", icon: UsersIcon, color: "text-violet-600" },
  in_sede: { label: "In sede", icon: MapPin, color: "text-emerald-600" },
};

function emptyForm(): FormState {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return {
    title: "",
    type: "call",
    startDate: `${yyyy}-${mm}-${dd}`,
    startTime: "09:00",
    endTime: "",
    location: "",
    notes: "",
    attendees: "",
  };
}

function isoFromDateTime(date: string, time: string): string {
  // Compongo data + ora in formato locale, poi lascio che il browser converta a ISO.
  return new Date(`${date}T${time}:00`).toISOString();
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

function formatDayLabel(d: Date): string {
  return d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
}

export default function AgendaPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  // Wave BH: vista lista (default) vs calendario mensile tipo Google Calendar.
  // Vista iniziale: di default Lista, ma ?view=calendar (o mese/calendario) la
  // apre direttamente sul calendario — usato dal link "Eventi" della Dashboard.
  const [view, setView] = useState<"list" | "calendar">(() => {
    try {
      const v = new URLSearchParams(window.location.search).get("view");
      if (v === "calendar" || v === "mese" || v === "calendario") return "calendar";
    } catch { /* ignore */ }
    return "list";
  });
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const { data: events = [], isLoading, error: loadError } = useQuery<AgendaEvent[]>({
    queryKey: ["personal-agenda"],
    staleTime: 30 * 1000,
    retry: false,
    queryFn: async () => {
      const r = await portalFetch("/api/personal-agenda", { credentials: "include" });
      if (!r.ok) {
        // Wave BG: surfaccio l'errore reale invece di degradare a [] silenzioso.
        // Caso tipico: 500 perché la migration SQL non è stata ancora applicata.
        let detail = `HTTP ${r.status}`;
        try {
          const errBody = await r.json();
          if (errBody?.error) detail = String(errBody.error);
          else if (errBody?.message) detail = String(errBody.message);
        } catch { /* non-JSON */ }
        throw new Error(detail);
      }
      return r.json();
    },
  });

  // Wave BH: eventi di TUTTI i clienti per la vista calendario unificata.
  // Endpoint già esistente, restituisce array ordinato per data con
  // clientName/clientColor/type/title/date. Stesso endpoint usato dalla
  // dashboard widget "Eventi prossimi".
  const { data: clientEvents = [] } = useQuery<ClientEventRow[]>({
    queryKey: ["dashboard-events"],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const r = await portalFetch("/api/dashboard/events", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });

  // Fusione personali + cliente per la vista calendario mensile.
  const calendarEvents = useMemo<CalEvent[]>(() => {
    const personal: CalEvent[] = events.map((e) => ({
      key: `personal-${e.id}`,
      title: e.title,
      date: e.startAt,
      source: "personal",
      personalType: e.type,
      personalRef: e,
    }));
    const client: CalEvent[] = clientEvents.map((e) => ({
      key: `client-${e.id}`,
      title: e.title,
      date: e.date,
      source: "client",
      clientId: e.clientId,
      clientName: e.clientName,
      clientColor: e.clientColor,
      clientEventType: e.type,
    }));
    return [...personal, ...client];
  }, [events, clientEvents]);

  const grouped = useMemo(() => {
    const today = startOfDay(new Date());
    const tomorrow = new Date(today.getTime() + 86400000);
    const dayAfter = new Date(today.getTime() + 2 * 86400000);
    const oneWeek = new Date(today.getTime() + 8 * 86400000);

    const todayItems: AgendaEvent[] = [];
    const tomorrowItems: AgendaEvent[] = [];
    const upcomingItems: AgendaEvent[] = [];
    const pastItems: AgendaEvent[] = [];

    for (const e of events) {
      const start = new Date(e.startAt);
      if (start < today) pastItems.push(e);
      else if (start < tomorrow) todayItems.push(e);
      else if (start < dayAfter) tomorrowItems.push(e);
      else if (start < oneWeek) upcomingItems.push(e);
      else upcomingItems.push(e);
    }
    return { todayItems, tomorrowItems, upcomingItems, pastItems };
  }, [events]);

  const totalUpcoming = grouped.todayItems.length + grouped.tomorrowItems.length + grouped.upcomingItems.length;

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (e: AgendaEvent) => {
    const start = new Date(e.startAt);
    const end = e.endAt ? new Date(e.endAt) : null;
    const yyyy = start.getFullYear();
    const mm = String(start.getMonth() + 1).padStart(2, "0");
    const dd = String(start.getDate()).padStart(2, "0");
    const hh = String(start.getHours()).padStart(2, "0");
    const mi = String(start.getMinutes()).padStart(2, "0");
    setForm({
      title: e.title,
      type: e.type,
      startDate: `${yyyy}-${mm}-${dd}`,
      startTime: `${hh}:${mi}`,
      endTime: end ? `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}` : "",
      location: e.location ?? "",
      notes: e.notes ?? "",
      attendees: e.attendees ?? "",
    });
    setEditingId(e.id);
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast({ variant: "destructive", title: "Titolo obbligatorio" });
      return;
    }
    if (!form.startDate || !form.startTime) {
      toast({ variant: "destructive", title: "Data e ora di inizio obbligatorie" });
      return;
    }
    const startAt = isoFromDateTime(form.startDate, form.startTime);
    const endAt = form.endTime ? isoFromDateTime(form.startDate, form.endTime) : null;
    const body = {
      title: form.title.trim(),
      type: form.type,
      startAt,
      endAt,
      location: form.location.trim() || null,
      notes: form.notes.trim() || null,
      attendees: form.attendees.trim() || null,
    };
    try {
      const url = editingId ? `/api/personal-agenda/${editingId}` : "/api/personal-agenda";
      const method = editingId ? "PATCH" : "POST";
      const r = await portalFetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        // Wave BG: mostro il vero errore del server invece del generico
        // "Creazione non riuscita". Causa frequente: tabella non ancora
        // creata su Supabase (relation "personal_agenda_events" does not exist).
        let detail = `HTTP ${r.status}`;
        try {
          const errBody = await r.json();
          if (errBody?.error) detail = String(errBody.error);
          else if (errBody?.message) detail = String(errBody.message);
          else if (Array.isArray(errBody?.issues) && errBody.issues[0]?.message) {
            detail = errBody.issues.map((i: any) => `${i.path?.join?.(".") || ""}: ${i.message}`).join(" · ");
          }
        } catch { /* body non-JSON, mantengo HTTP n */ }
        toast({
          variant: "destructive",
          title: editingId ? "Modifica non riuscita" : "Creazione non riuscita",
          description: detail,
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["personal-agenda"] });
      setFormOpen(false);
      setEditingId(null);
      toast({ title: editingId ? "Appuntamento aggiornato" : "Appuntamento creato" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Errore di rete",
        description: err instanceof Error ? err.message : "Connessione non disponibile",
      });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Eliminare questo appuntamento?")) return;
    try {
      const r = await portalFetch(`/api/personal-agenda/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) {
        toast({ variant: "destructive", title: "Eliminazione non riuscita" });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["personal-agenda"] });
      toast({ title: "Appuntamento eliminato" });
    } catch {
      toast({ variant: "destructive", title: "Errore di rete" });
    }
  };

  return (
    <Layout>
      <div className={cn("p-4 md:p-8 mx-auto", view === "calendar" ? "max-w-6xl" : "max-w-4xl")}>
        {/* Hero — stesso pattern di Today: una headline che dice ciò che conta */}
        <div className="mb-8">
          <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
            <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
              <CalendarClock size={16} className="text-primary" />
              {view === "calendar"
                ? "Calendario unificato · tuoi appuntamenti + eventi clienti"
                : "Agenda personale · solo i tuoi appuntamenti"}
            </p>
            <div className="flex items-center gap-2">
              {/* Wave BH: toggle Lista / Calendario stile segmented control. */}
              <div className="inline-flex items-center rounded-lg border border-input bg-background p-0.5">
                <button
                  type="button"
                  onClick={() => setView("list")}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                    view === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                  title="Vista lista"
                >
                  <ListIcon size={12} /> Lista
                </button>
                <button
                  type="button"
                  onClick={() => setView("calendar")}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                    view === "calendar" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                  title="Vista calendario mese"
                >
                  <LayoutGrid size={12} /> Mese
                </button>
              </div>
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Plus size={14} /> Nuovo
              </button>
            </div>
          </div>
          {loadError ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 mt-2">
              <p className="text-sm font-semibold text-amber-900">Tabella agenda non disponibile</p>
              <p className="text-xs text-amber-800 mt-1">
                {(loadError as Error).message}
              </p>
              <p className="text-xs text-amber-800 mt-2">
                Probabilmente la migration SQL non è ancora stata applicata su Supabase.
                Vai su Supabase → SQL Editor → incolla il file{" "}
                <code className="font-mono text-[11px] bg-white/60 px-1 rounded">supabase/migrations/20260603140000_personal_agenda.sql</code>{" "}
                → Run.
              </p>
            </div>
          ) : view === "calendar" ? (
            // Hero modalità calendario: nome mese + nav prev/next/oggi.
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight capitalize">
                {calendarMonth.toLocaleDateString("it-IT", { month: "long", year: "numeric" })}
              </h1>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                  className="p-1.5 rounded-lg border border-input hover:bg-muted"
                  title="Mese precedente"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                  }}
                  className="px-3 py-1 rounded-lg border border-input text-xs font-medium hover:bg-muted"
                >
                  Oggi
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                  className="p-1.5 rounded-lg border border-input hover:bg-muted"
                  title="Mese successivo"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          ) : isLoading ? (
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight text-muted-foreground">
              Caricamento agenda…
            </h1>
          ) : totalUpcoming === 0 ? (
            <>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                Nessun appuntamento in agenda
              </h1>
              <p className="text-sm text-muted-foreground mt-2">
                Premi "Nuovo" per aggiungere call, meeting o appuntamenti in sede.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                Hai <span className="text-primary tabular-nums">{totalUpcoming}</span> {totalUpcoming === 1 ? "appuntamento" : "appuntamenti"} in arrivo
              </h1>
              {grouped.todayItems.length > 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  {grouped.todayItems.length} {grouped.todayItems.length === 1 ? "oggi" : "oggi"}
                  {grouped.tomorrowItems.length > 0 && ` · ${grouped.tomorrowItems.length} ${grouped.tomorrowItems.length === 1 ? "domani" : "domani"}`}
                </p>
              )}
            </>
          )}
        </div>

        {view === "calendar" ? (
          <CalendarMonth
            month={calendarMonth}
            events={calendarEvents}
            onEventClick={(e) => {
              if (e.source === "personal") openEdit(e.personalRef);
              else navigate(`/clients/${e.clientId}`);
            }}
          />
        ) : (
          <div className="space-y-6">
            {grouped.todayItems.length > 0 && (
              <AgendaSection label="Oggi" items={grouped.todayItems} onEdit={openEdit} onDelete={handleDelete} />
            )}
            {grouped.tomorrowItems.length > 0 && (
              <AgendaSection label="Domani" items={grouped.tomorrowItems} onEdit={openEdit} onDelete={handleDelete} />
            )}
            {grouped.upcomingItems.length > 0 && (
              <AgendaSection label="Prossimi giorni" items={grouped.upcomingItems} onEdit={openEdit} onDelete={handleDelete} groupByDay />
            )}
            {grouped.pastItems.length > 0 && (
              <details className="rounded-xl border border-card-border bg-card p-4">
                <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">
                  Passati ({grouped.pastItems.length})
                </summary>
                <div className="mt-3 opacity-70">
                  <AgendaSection label="" items={grouped.pastItems} onEdit={openEdit} onDelete={handleDelete} groupByDay />
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      {formOpen && (
        <EventFormModal
          form={form}
          setForm={setForm}
          editing={editingId != null}
          onClose={() => { setFormOpen(false); setEditingId(null); }}
          onSave={handleSave}
        />
      )}
    </Layout>
  );
}

function AgendaSection({
  label, items, onEdit, onDelete, groupByDay,
}: {
  label: string;
  items: AgendaEvent[];
  onEdit: (e: AgendaEvent) => void;
  onDelete: (id: number) => void;
  groupByDay?: boolean;
}) {
  if (!groupByDay) {
    return (
      <section>
        {label && <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">{label}</h2>}
        <div className="space-y-2">
          {items.map((e) => <EventCard key={e.id} event={e} onEdit={onEdit} onDelete={onDelete} />)}
        </div>
      </section>
    );
  }
  // Raggruppa per giorno
  const byDay = new Map<string, AgendaEvent[]>();
  for (const e of items) {
    const d = new Date(e.startAt);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(e);
  }
  return (
    <section>
      {label && <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">{label}</h2>}
      <div className="space-y-4">
        {Array.from(byDay.entries()).map(([k, dayItems]) => (
          <div key={k}>
            <p className="text-xs font-medium text-muted-foreground mb-2 capitalize">{formatDayLabel(new Date(k))}</p>
            <div className="space-y-2">
              {dayItems.map((e) => <EventCard key={e.id} event={e} onEdit={onEdit} onDelete={onDelete} />)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function EventCard({
  event, onEdit, onDelete,
}: { event: AgendaEvent; onEdit: (e: AgendaEvent) => void; onDelete: (id: number) => void }) {
  const meta = TYPE_META[event.type];
  const Icon = meta.icon;
  return (
    <div className="rounded-xl border border-card-border bg-card p-4 hover:shadow-sm transition-shadow group">
      <div className="flex items-start gap-3">
        <Icon size={18} className={cn("shrink-0 mt-0.5", meta.color)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm">{event.title}</h3>
            <span className={cn("text-xs rounded-full px-2 py-0.5 bg-muted")}>{meta.label}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <Clock size={11} />
              {formatTime(event.startAt)}{event.endAt && ` – ${formatTime(event.endAt)}`}
            </span>
            {event.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={11} />
                {event.location}
              </span>
            )}
            {event.attendees && (
              <span className="inline-flex items-center gap-1">
                <UsersIcon size={11} />
                {event.attendees}
              </span>
            )}
          </div>
          {event.notes && (
            <p className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap inline-flex items-start gap-1">
              <FileText size={11} className="mt-0.5 shrink-0" />
              {event.notes}
            </p>
          )}
        </div>
        {/* Su mobile le azioni sono sempre visibili (niente hover al tatto);
            su desktop restano nascoste e compaiono all'hover della riga. */}
        <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
          <button
            type="button"
            onClick={() => onEdit(event)}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"
            aria-label="Modifica"
            title="Modifica"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(event.id)}
            className="p-2 text-muted-foreground hover:text-destructive rounded-lg hover:bg-muted"
            aria-label="Elimina"
            title="Elimina"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* Vista calendario mensile (Wave BH) — grid 7 colonne x 6 settimane.
   Mostra giorni del mese corrente in primo piano, giorni del mese
   precedente/successivo grigi per riempire la griglia (stile Google
   Calendar). Eventi nelle celle: max 3 visibili, "+N" se eccede.
   - Eventi personali: badge colorato per type (call/meeting/in_sede)
   - Eventi cliente: badge col colore del brand del cliente
   Click su evento → apre il modale modifica (personale) o naviga al
   cliente (evento cliente). */
function CalendarMonth({
  month, events, onEventClick,
}: {
  month: Date;
  events: CalEvent[];
  onEventClick: (e: CalEvent) => void;
}) {
  const year = month.getFullYear();
  const monthIdx = month.getMonth();

  // Lunedì=0 ... Domenica=6 per partire la griglia da lunedì come in IT.
  const firstDay = new Date(year, monthIdx, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const startDate = new Date(year, monthIdx, 1 - startWeekday);

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    days.push(d);
  }

  // Index eventi per giorno (chiave YYYY-MM-DD locale).
  const byDay = new Map<string, CalEvent[]>();
  for (const e of events) {
    const d = new Date(e.date);
    const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(e);
  }
  // Ordino eventi di ogni giorno per ora.
  for (const arr of byDay.values()) {
    arr.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  const personalBadgeStyle = (type: AgendaEvent["type"]) => {
    if (type === "call") return { bg: "bg-sky-100", text: "text-sky-700" };
    if (type === "meeting") return { bg: "bg-violet-100", text: "text-violet-700" };
    return { bg: "bg-emerald-100", text: "text-emerald-700" }; // in_sede
  };

  return (
    <div className="rounded-xl border border-card-border bg-card overflow-hidden">
      {/* Legenda compatta */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-card-border bg-muted/20 text-xs text-muted-foreground flex-wrap">
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-sky-500" /> Call
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-violet-500" /> Meeting
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500" /> In sede
        </span>
        <span className="inline-flex items-center gap-1 ml-3">
          <span className="w-2 h-2 rounded-full bg-zinc-400" /> Eventi clienti (colore del brand)
        </span>
      </div>
      {/* Head settimana */}
      <div className="grid grid-cols-7 border-b border-card-border bg-muted/10">
        {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((d) => (
          <div key={d} className="px-2 py-1.5 text-[11px] font-semibold text-center text-muted-foreground uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>
      {/* Grid giorni */}
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          const dayEvents = byDay.get(k) ?? [];
          const isCurrentMonth = d.getMonth() === monthIdx;
          const isToday = k === todayKey;
          const isWeekend = i % 7 >= 5;
          return (
            <div
              key={i}
              className={cn(
                "min-h-[90px] md:min-h-[110px] p-1.5 border-r border-b border-card-border/60 last:border-r-0",
                !isCurrentMonth && "bg-muted/20",
                isWeekend && isCurrentMonth && "bg-muted/5",
                // Rimuovo border-b sull'ultima riga (indici 35-41).
                i >= 35 && "border-b-0",
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={cn(
                    "text-xs font-medium tabular-nums",
                    isToday && "inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-primary text-primary-foreground px-1",
                    !isToday && !isCurrentMonth && "text-muted-foreground/50",
                    !isToday && isCurrentMonth && "text-foreground",
                  )}
                >
                  {d.getDate()}
                </span>
                {dayEvents.length > 0 && !isToday && (
                  <span className="text-[10px] text-muted-foreground/70">{dayEvents.length}</span>
                )}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((e) => {
                  if (e.source === "personal") {
                    const style = personalBadgeStyle(e.personalType);
                    return (
                      <button
                        key={e.key}
                        type="button"
                        onClick={() => onEventClick(e)}
                        title={`${e.title} · ${formatTime(e.date)}`}
                        className={cn(
                          "block w-full text-left text-[10px] truncate rounded px-1 py-0.5 hover:opacity-80 transition-opacity",
                          style.bg, style.text,
                        )}
                      >
                        <span className="font-semibold tabular-nums">{formatTime(e.date)}</span>{" "}
                        {e.title}
                      </button>
                    );
                  }
                  return (
                    <button
                      key={e.key}
                      type="button"
                      onClick={() => onEventClick(e)}
                      title={`${e.title}${e.clientName ? ` · ${e.clientName}` : ""}`}
                      className="block w-full text-left text-[10px] truncate rounded px-1 py-0.5 hover:opacity-80 transition-opacity text-zinc-700 border-l-2"
                      style={{
                        backgroundColor: (e.clientColor || "#7a8f5c") + "22",
                        borderLeftColor: e.clientColor || "#7a8f5c",
                      }}
                    >
                      <span className="font-semibold tabular-nums">{formatTime(e.date)}</span>{" "}
                      {e.title}
                    </button>
                  );
                })}
                {dayEvents.length > 3 && (
                  <p className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - 3}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventFormModal({
  form, setForm, editing, onClose, onSave,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  editing: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-3" onClick={onClose}>
      <div
        className="bg-card border border-card-border rounded-2xl w-full max-w-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-card-border flex items-center justify-between">
          <h2 className="font-semibold text-base">{editing ? "Modifica appuntamento" : "Nuovo appuntamento"}</h2>
          <button type="button" onClick={onClose} aria-label="Chiudi" className="p-2 rounded-lg hover:bg-muted">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Titolo</label>
            <input
              autoFocus
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Es. Call con Mario Rossi"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Tipo</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(TYPE_META) as AgendaEvent["type"][]).map((k) => {
                const meta = TYPE_META[k];
                const Icon = meta.icon;
                const selected = form.type === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setForm({ ...form, type: k })}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border py-2 px-1 text-xs font-medium transition-colors",
                      selected
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-input hover:bg-muted",
                    )}
                  >
                    <Icon size={16} className={selected ? "text-primary" : meta.color} />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <label className="text-xs font-medium text-muted-foreground block mb-1">Data</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full rounded-lg border border-input bg-background px-2 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Inizio</label>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className="w-full rounded-lg border border-input bg-background px-2 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Fine (opz.)</label>
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className="w-full rounded-lg border border-input bg-background px-2 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              {form.type === "call" ? "Link call / numero (opz.)" : form.type === "in_sede" ? "Indirizzo (opz.)" : "Luogo (opz.)"}
            </label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder={form.type === "call" ? "meet.google.com/... o +39…" : form.type === "in_sede" ? "Via Roma 1, Milano" : "Sala riunioni / online"}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Partecipanti (opz.)</label>
            <input
              type="text"
              value={form.attendees}
              onChange={(e) => setForm({ ...form, attendees: e.target.value })}
              placeholder="Mario, Luigi, Anna…"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Note (opz.)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              placeholder="Argomenti, materiali da preparare…"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none"
            />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-card-border bg-muted/30 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-input px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm font-semibold hover:opacity-90"
          >
            {editing ? "Salva modifiche" : "Crea appuntamento"}
          </button>
        </div>
      </div>
    </div>
  );
}
