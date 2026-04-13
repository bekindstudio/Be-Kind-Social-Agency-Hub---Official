import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { useClientContext } from "@/context/ClientContext";
import type { EditorialPost, SocialPlatform } from "@/types/client";
import { CalendarFilters } from "@/components/tools/calendar/CalendarFilters";
import { MonthView, type CalendarDay } from "@/components/tools/calendar/MonthView";
import { WeekView } from "@/components/tools/calendar/WeekView";
import { ListView } from "@/components/tools/calendar/ListView";
import { PostDrawer } from "@/components/tools/calendar/PostDrawer";
import { NewPostModal } from "@/components/tools/calendar/NewPostModal";

type CalendarView = "month" | "week" | "list";

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + mondayOffset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function sameDay(a: Date, b: Date): boolean {
  return dateKey(a) === dateKey(b);
}

function addDays(date: Date, delta: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + delta);
  return d;
}

function addMonths(date: Date, delta: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + delta);
  return d;
}

export function getMonthDays(year: number, month: number, posts: EditorialPost[]): CalendarDay[] {
  const first = new Date(year, month, 1);
  const start = startOfWeek(first);
  const last = new Date(year, month + 1, 0);
  const end = addDays(startOfWeek(last), 6);
  const today = new Date();
  const days: CalendarDay[] = [];

  for (let current = new Date(start); current <= end; current = addDays(current, 1)) {
    const currentKey = dateKey(current);
    days.push({
      date: new Date(current),
      key: currentKey,
      isCurrentMonth: current.getMonth() === month,
      isToday: sameDay(current, today),
      posts: posts.filter((post) => dateKey(new Date(post.scheduledDate)) === currentKey),
    });
  }
  return days;
}

export function filterPosts(posts: EditorialPost[], platforms: SocialPlatform[], statuses: EditorialPost["status"][]): EditorialPost[] {
  return posts.filter((post) => {
    const platformOk = platforms.length === 0 || platforms.includes(post.platform);
    const statusOk = statuses.length === 0 || statuses.includes(post.status);
    return platformOk && statusOk;
  });
}

export function groupPostsByDate(posts: EditorialPost[]): Record<string, EditorialPost[]> {
  return posts.reduce<Record<string, EditorialPost[]>>((acc, post) => {
    const key = dateKey(new Date(post.scheduledDate));
    const list = acc[key] ?? [];
    acc[key] = [...list, post];
    return acc;
  }, {});
}

export default function CalendarPage() {
  const { activeClient, posts, addPost, updatePost, deletePost } = useClientContext();
  const [view, setView] = useState<CalendarView>(() => (typeof window !== "undefined" && window.innerWidth < 768 ? "list" : "month"));
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<EditorialPost["status"][]>([]);
  const [selectedPost, setSelectedPost] = useState<EditorialPost | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [newPostDate, setNewPostDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSelectedPlatforms([]);
    setSelectedStatuses([]);
    setView(typeof window !== "undefined" && window.innerWidth < 768 ? "list" : "month");
    setCursor(new Date());
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 200);
    return () => clearTimeout(t);
  }, [activeClient?.id]);

  const clientPosts = useMemo(() => {
    if (!activeClient) return [];
    return posts.filter((post) => post.clientId === activeClient.id);
  }, [posts, activeClient]);

  const filteredPosts = useMemo(
    () => filterPosts(clientPosts, selectedPlatforms, selectedStatuses),
    [clientPosts, selectedPlatforms, selectedStatuses],
  );

  const monthDays = useMemo(
    () => getMonthDays(cursor.getFullYear(), cursor.getMonth(), filteredPosts),
    [cursor, filteredPosts],
  );

  const weekColumns = useMemo(() => {
    const weekStart = startOfWeek(cursor);
    return Array.from({ length: 7 }).map((_, idx) => {
      const date = addDays(weekStart, idx);
      const key = dateKey(date);
      return {
        date,
        key,
        isToday: sameDay(date, new Date()),
        posts: filteredPosts.filter((post) => dateKey(new Date(post.scheduledDate)) === key),
      };
    });
  }, [cursor, filteredPosts]);

  const stats = useMemo(() => {
    const now = new Date();
    const sameMonth = (iso: string) => {
      const d = new Date(iso);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    };
    return {
      monthTotal: clientPosts.filter((post) => sameMonth(post.scheduledDate)).length,
      pending: clientPosts.filter((post) => post.status === "pending_approval").length,
      approved: clientPosts.filter((post) => post.status === "approved").length,
      publishedMonth: clientPosts.filter((post) => post.status === "published" && sameMonth(post.scheduledDate)).length,
    };
  }, [clientPosts]);

  const periodTitle = useMemo(() => {
    if (view === "week") {
      const start = startOfWeek(cursor);
      const end = addDays(start, 6);
      return `${start.toLocaleDateString("it-IT")} - ${end.toLocaleDateString("it-IT")}`;
    }
    return cursor.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  }, [cursor, view]);

  const openNewPost = (date: Date) => {
    setNewPostDate(date);
    setModalOpen(true);
  };

  if (!activeClient) {
    return (
      <Layout>
        <div className="p-8 text-sm text-muted-foreground">Seleziona un cliente per usare il calendario editoriale.</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold">Piano Editoriale + Calendario</h1>
            <p className="text-sm text-muted-foreground">Cliente attivo: {activeClient.name}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCursor((prev) => (view === "week" ? addDays(prev, -7) : addMonths(prev, -1)))}
              className="rounded-lg border border-input p-2"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="min-w-[220px] text-center text-sm font-semibold capitalize">{periodTitle}</span>
            <button
              type="button"
              onClick={() => setCursor((prev) => (view === "week" ? addDays(prev, 7) : addMonths(prev, 1)))}
              className="rounded-lg border border-input p-2"
            >
              <ChevronRight size={14} />
            </button>
            <div className="ml-2 flex items-center rounded-lg border border-input bg-card p-1">
              {(["month", "week", "list"] as const).map((item) => (
                <button key={item} type="button" onClick={() => setView(item)} className={`rounded px-2 py-1 text-xs ${view === item ? "bg-primary text-primary-foreground" : ""}`}>
                  {item === "month" ? "Mese" : item === "week" ? "Settimana" : "Lista"}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => openNewPost(new Date())} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
              <Plus size={13} />
              Nuovo post
            </button>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-3"><p className="text-xs text-muted-foreground">Post questo mese</p><p className="text-xl font-bold">{stats.monthTotal}</p></div>
          <div className="rounded-xl border border-border bg-card p-3"><p className="text-xs text-muted-foreground">In approvazione</p><p className="text-xl font-bold">{stats.pending}</p></div>
          <div className="rounded-xl border border-border bg-card p-3"><p className="text-xs text-muted-foreground">Approvati pronti</p><p className="text-xl font-bold">{stats.approved}</p></div>
          <div className="rounded-xl border border-border bg-card p-3"><p className="text-xs text-muted-foreground">Pubblicati questo mese</p><p className="text-xl font-bold">{stats.publishedMonth}</p></div>
        </div>

        <CalendarFilters
          selectedPlatforms={selectedPlatforms}
          selectedStatuses={selectedStatuses}
          onPlatformsChange={setSelectedPlatforms}
          onStatusesChange={setSelectedStatuses}
          totalFiltered={filteredPosts.length}
          pendingCount={filteredPosts.filter((post) => post.status === "pending_approval").length}
        />

        <div className="mt-4">
          {loading ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="h-20 animate-pulse rounded-xl border border-border bg-muted/40" />
              ))}
            </div>
          ) : view === "month" ? (
            <MonthView
              days={monthDays}
              onDayClick={openNewPost}
              onPostClick={(post) => {
                setSelectedPost(post);
                setDrawerOpen(true);
              }}
              onMovePost={(postId, date) => {
                const existing = clientPosts.find((post) => post.id === postId);
                if (!existing) return;
                const current = new Date(existing.scheduledDate);
                const next = new Date(date);
                next.setHours(current.getHours(), current.getMinutes(), 0, 0);
                updatePost(postId, { scheduledDate: next.toISOString() });
              }}
            />
          ) : view === "week" ? (
            <WeekView
              columns={weekColumns}
              onDayClick={openNewPost}
              onPostClick={(post) => {
                setSelectedPost(post);
                setDrawerOpen(true);
              }}
            />
          ) : (
            <ListView
              posts={filteredPosts}
              onOpenPost={(post) => {
                setSelectedPost(post);
                setDrawerOpen(true);
              }}
              onDuplicatePost={(post) => {
                const d = new Date(post.scheduledDate);
                d.setDate(d.getDate() + 7);
                // TODO: hook duplicate action to approval notifications workflow.
                addPost({ ...post, scheduledDate: d.toISOString(), status: "draft" });
              }}
              onDeletePost={(post) => {
                const ok = confirm("Eliminare questo post?");
                if (ok) deletePost(post.id);
              }}
            />
          )}
        </div>
      </div>

      <PostDrawer
        open={drawerOpen}
        post={selectedPost}
        onClose={() => setDrawerOpen(false)}
        onSave={(id, updates) => updatePost(id, updates)}
        onDelete={(id) => {
          deletePost(id);
          setDrawerOpen(false);
        }}
        onDuplicate={(post) => {
          const d = new Date(post.scheduledDate);
          d.setDate(d.getDate() + 7);
          addPost({ ...post, scheduledDate: d.toISOString(), status: "draft" });
        }}
      />

      <NewPostModal
        open={modalOpen}
        initialDate={newPostDate}
        onClose={() => setModalOpen(false)}
        clientId={activeClient.id}
        onCreate={addPost}
        onCreated={(created) => {
          setSelectedPost(created);
          setDrawerOpen(true);
        }}
      />
      {/* TODO: connect direct publishing with Meta/Google APIs when enabled */}
      {/* TODO: add email notification trigger for approval workflow */}
    </Layout>
  );
}
