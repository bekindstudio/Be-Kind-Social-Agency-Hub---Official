import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { portalFetch } from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import {
  ArrowLeft,
  Save,
  Eye,
  FileDown,
  Send,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Calendar as CalendarIcon,
  List,
  BarChart3,
  MessageCircle,
  Image,
  Clock,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { generateEditorialPlanPDF } from "@/lib/editorial-plan-pdf";

const MONTHS = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

const STATUS_BADGES: Record<string, { label: string; class: string }> = {
  bozza: { label: "Bozza", class: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  in_revisione: { label: "In Revisione", class: "bg-amber-100 text-amber-700" },
  approvato: { label: "Approvato", class: "bg-emerald-100 text-emerald-700" },
  inviato_al_cliente: { label: "Inviato al Cliente", class: "bg-blue-100 text-blue-700" },
  confermato: { label: "Confermato", class: "bg-teal-100 text-teal-700" },
};

const SLOT_STATUS: Record<string, { label: string; color: string }> = {
  da_creare: { label: "Da creare", color: "bg-gray-300" },
  in_lavorazione: { label: "In lavorazione", color: "bg-amber-400" },
  pronto: { label: "Pronto", color: "bg-blue-400" },
  approvato: { label: "Approvato", color: "bg-emerald-400" },
};

const CONTENT_TYPES = [
  { value: "post", label: "Post" },
  { value: "reel", label: "Reel" },
  { value: "story", label: "Story" },
  { value: "carousel", label: "Carosello" },
  { value: "video", label: "Video" },
];

const PLATFORMS: Record<string, string> = {
  instagram_feed: "IG Feed",
  instagram_stories: "IG Stories",
  instagram_reels: "IG Reels",
  facebook_feed: "FB Feed",
  facebook_stories: "FB Stories",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube_shorts: "YT Shorts",
};

const CTA_OPTIONS = [
  "Shop Now", "Learn More", "Visit Profile", "Send Message",
  "Save this post", "Tag a friend", "Link in bio", "Commenta",
];

type Category = {
  id: number;
  name: string;
  color: string;
  icon: string;
};

type Slot = {
  id: number;
  planId: number;
  platform: string;
  contentType: string;
  categoryId: number | null;
  publishDate: string | null;
  publishTime: string | null;
  title: string | null;
  caption: string | null;
  hashtagsJson: string[];
  callToAction: string | null;
  linkInBio: string | null;
  visualUrl: string | null;
  visualDescription: string | null;
  notesInternal: string | null;
  notesClient: string | null;
  status: string;
  position: number;
};

type Plan = {
  id: number;
  clientId: number;
  clientName: string;
  clientColor: string;
  clientLogo: string | null;
  month: number;
  year: number;
  status: string;
  platformsJson: string[];
  packageType: string;
  notesInternal: string | null;
  slots: Slot[];
};

export default function EditorialPlanBuilder({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [expandedPlatforms, setExpandedPlatforms] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [hashtagInput, setHashtagInput] = useState("");
  const { toast } = useToast();

  const fetchPlan = useCallback(async () => {
    try {
      const res = await portalFetch(`/api/editorial-plans/${id}`);
      if (res.ok) {
        const data = await res.json();
        setPlan(data);
        if (data.platformsJson) {
          setExpandedPlatforms(new Set(data.platformsJson));
        }
      }
    } catch {}
  }, [id]);

  useEffect(() => {
    fetchPlan();
    portalFetch("/api/content-categories").then((r) => r.json()).then(setCategories).catch(() => {});
  }, [fetchPlan]);

  const selectedSlot = plan?.slots.find((s) => s.id === selectedSlotId) ?? null;

  const updateSlot = async (slotId: number, updates: Partial<Slot>) => {
    setSaving(true);
    try {
      const res = await portalFetch(`/api/editorial-slots/${slotId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updated = await res.json();
        setPlan((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            slots: prev.slots.map((s) => (s.id === slotId ? { ...s, ...updated } : s)),
          };
        });
      }
    } catch {}
    setSaving(false);
  };

  const addSlot = async (platform: string, publishDate?: string) => {
    try {
      const res = await portalFetch("/api/editorial-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: Number(id),
          platform,
          contentType: "post",
          publishDate: publishDate ?? null,
          position: (plan?.slots.length ?? 0),
        }),
      });
      if (res.ok) {
        const slot = await res.json();
        setPlan((prev) => prev ? { ...prev, slots: [...prev.slots, slot] } : prev);
        setSelectedSlotId(slot.id);
      }
    } catch {}
  };

  const deleteSlot = async (slotId: number) => {
    await portalFetch(`/api/editorial-slots/${slotId}`, { method: "DELETE" });
    setPlan((prev) => prev ? { ...prev, slots: prev.slots.filter((s) => s.id !== slotId) } : prev);
    if (selectedSlotId === slotId) setSelectedSlotId(null);
  };

  const updatePlanStatus = async (status: string) => {
    try {
      const res = await portalFetch(`/api/editorial-plans/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const updated = await res.json();
        setPlan((prev) => prev ? { ...prev, ...updated } : prev);
        toast({ title: `Stato aggiornato: ${STATUS_BADGES[status]?.label ?? status}` });
      }
    } catch {}
  };

  const handleExportPDF = async () => {
    if (!plan) return;
    try {
      await generateEditorialPlanPDF(plan, categories);
      toast({ title: "PDF esportato con successo" });
    } catch (err) {
      toast({ title: "Errore nell'esportazione PDF", variant: "destructive" });
    }
  };

  const slotsByPlatform = (plan?.slots ?? []).reduce<Record<string, Slot[]>>((acc, s) => {
    (acc[s.platform] = acc[s.platform] || []).push(s);
    return acc;
  }, {});

  const togglePlatform = (p: string) => {
    setExpandedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  };

  const getDaysInMonth = () => plan ? new Date(plan.year, plan.month, 0).getDate() : 30;
  const getFirstDayOfMonth = () => plan ? (new Date(plan.year, plan.month - 1, 1).getDay() + 6) % 7 : 0;

  const calendarSlots = (day: number) => {
    if (!plan) return [];
    const dateStr = `${plan.year}-${String(plan.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return plan.slots.filter((s) => s.publishDate === dateStr);
  };

  const completedSlots = plan?.slots.filter((s) => s.status === "pronto" || s.status === "approvato").length ?? 0;
  const totalSlots = plan?.slots.length ?? 0;

  const categoryBreakdown = (plan?.slots ?? []).reduce<Record<number, number>>((acc, s) => {
    if (s.categoryId) acc[s.categoryId] = (acc[s.categoryId] || 0) + 1;
    return acc;
  }, {});

  const platformBreakdown = (plan?.slots ?? []).reduce<Record<string, number>>((acc, s) => {
    acc[s.platform] = (acc[s.platform] || 0) + 1;
    return acc;
  }, {});

  const contentTypeBreakdown = (plan?.slots ?? []).reduce<Record<string, number>>((acc, s) => {
    acc[s.contentType] = (acc[s.contentType] || 0) + 1;
    return acc;
  }, {});

  if (!plan) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[80vh]">
          <p className="text-muted-foreground">Caricamento piano...</p>
        </div>
      </Layout>
    );
  }

  const badge = STATUS_BADGES[plan.status] ?? STATUS_BADGES.bozza;

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-1rem)]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation("/tools/calendar")} className="p-1.5 rounded-lg hover:bg-muted">
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: plan.clientColor }} />
                <h1 className="text-base font-bold">{plan.clientName}</h1>
                <span className="text-sm text-muted-foreground">— {MONTHS[plan.month - 1]} {plan.year}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", badge.class)}>{badge.label}</span>
                <span className="text-[11px] text-muted-foreground">{completedSlots}/{totalSlots} completati</span>
                {saving && <span className="text-[10px] text-amber-500">Salvataggio...</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex border border-border rounded-lg overflow-hidden mr-2">
              <button
                onClick={() => setView("list")}
                className={cn("px-3 py-1.5 text-xs font-medium flex items-center gap-1.5", view === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
              >
                <List size={13} /> Lista
              </button>
              <button
                onClick={() => setView("calendar")}
                className={cn("px-3 py-1.5 text-xs font-medium flex items-center gap-1.5", view === "calendar" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
              >
                <CalendarIcon size={13} /> Calendario
              </button>
            </div>
            {plan.status === "bozza" && (
              <button onClick={() => updatePlanStatus("in_revisione")} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 flex items-center gap-1.5">
                <Send size={12} /> Invia per revisione
              </button>
            )}
            {plan.status === "in_revisione" && (
              <button onClick={() => updatePlanStatus("approvato")} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50 flex items-center gap-1.5">
                <Check size={12} /> Approva
              </button>
            )}
            {plan.status === "approvato" && (
              <button onClick={() => updatePlanStatus("inviato_al_cliente")} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-50 flex items-center gap-1.5">
                <Send size={12} /> Invia al cliente
              </button>
            )}
            <button onClick={handleExportPDF} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5">
              <FileDown size={12} /> Esporta PDF
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {view === "list" && (
            <>
              <div className="w-72 border-r border-border bg-card overflow-y-auto shrink-0">
                <div className="p-3 border-b border-border">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contenuti ({totalSlots})</p>
                </div>
                {Object.entries(slotsByPlatform).map(([platform, slots]) => (
                  <div key={platform} className="border-b border-border last:border-0">
                    <button
                      onClick={() => togglePlatform(platform)}
                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 text-left"
                    >
                      <div className="flex items-center gap-2">
                        {expandedPlatforms.has(platform) ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        <span className="text-xs font-semibold">{PLATFORMS[platform] ?? platform}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {slots.filter((s) => s.status === "pronto" || s.status === "approvato").length}/{slots.length}
                      </span>
                    </button>
                    {expandedPlatforms.has(platform) && (
                      <div className="pb-2 px-2 space-y-1">
                        {slots.map((slot, i) => {
                          const cat = categories.find((c) => c.id === slot.categoryId);
                          const statusInfo = SLOT_STATUS[slot.status] ?? SLOT_STATUS.da_creare;
                          return (
                            <button
                              key={slot.id}
                              onClick={() => setSelectedSlotId(slot.id)}
                              className={cn(
                                "w-full text-left p-2.5 rounded-lg transition-colors",
                                selectedSlotId === slot.id ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted/50"
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <div className={cn("w-2 h-2 rounded-full shrink-0", statusInfo.color)} />
                                <span className="text-xs font-medium truncate flex-1">
                                  {slot.title || `${CONTENT_TYPES.find((t) => t.value === slot.contentType)?.label ?? "Post"} #${i + 1}`}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1 ml-4">
                                {cat && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium text-white" style={{ backgroundColor: cat.color }}>
                                    {cat.name.substring(0, 12)}
                                  </span>
                                )}
                                {slot.publishDate && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {new Date(slot.publishDate + "T12:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "short" })}
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                        <button
                          onClick={() => addSlot(platform)}
                          className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg"
                        >
                          <Plus size={12} /> Aggiungi slot
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {Object.keys(slotsByPlatform).length === 0 && (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    <p>Nessun contenuto ancora</p>
                    <button
                      onClick={() => addSlot(plan.platformsJson?.[0] ?? "instagram_feed")}
                      className="mt-2 text-primary hover:underline"
                    >
                      + Aggiungi il primo
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {selectedSlot ? (
                  <SlotEditor
                    slot={selectedSlot}
                    categories={categories}
                    onUpdate={(updates) => updateSlot(selectedSlot.id, updates)}
                    onDelete={() => deleteSlot(selectedSlot.id)}
                    hashtagInput={hashtagInput}
                    setHashtagInput={setHashtagInput}
                  />
                ) : (
                  <div className="h-full flex flex-col">
                    <ContentMixAnalyzer
                      categories={categories}
                      categoryBreakdown={categoryBreakdown}
                      platformBreakdown={platformBreakdown}
                      contentTypeBreakdown={contentTypeBreakdown}
                      totalSlots={totalSlots}
                      slots={plan.slots}
                      month={plan.month}
                      year={plan.year}
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {view === "calendar" && (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden">
                {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((d) => (
                  <div key={d} className="bg-muted/50 px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {d}
                  </div>
                ))}
                {Array.from({ length: getFirstDayOfMonth() }).map((_, i) => (
                  <div key={`empty-${i}`} className="bg-card min-h-[100px]" />
                ))}
                {Array.from({ length: getDaysInMonth() }).map((_, i) => {
                  const day = i + 1;
                  const daySlots = calendarSlots(day);
                  const dateStr = `${plan.year}-${String(plan.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  return (
                    <div key={day} className="bg-card min-h-[100px] p-1.5 relative group">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-muted-foreground">{day}</span>
                        <button
                          onClick={() => addSlot(plan.platformsJson?.[0] ?? "instagram_feed", dateStr)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted transition-opacity"
                        >
                          <Plus size={10} className="text-muted-foreground" />
                        </button>
                      </div>
                      <div className="space-y-0.5">
                        {daySlots.map((slot) => {
                          const cat = categories.find((c) => c.id === slot.categoryId);
                          return (
                            <button
                              key={slot.id}
                              onClick={() => { setSelectedSlotId(slot.id); setView("list"); }}
                              className="w-full text-left px-1.5 py-1 rounded text-[9px] font-medium truncate"
                              style={{ backgroundColor: (cat?.color ?? "#7a8f5c") + "20", color: cat?.color ?? "#7a8f5c" }}
                            >
                              <span className="text-[8px] opacity-70">{PLATFORMS[slot.platform] ?? slot.platform}</span>
                              {" "}
                              {slot.title || CONTENT_TYPES.find((t) => t.value === slot.contentType)?.label || "Post"}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6">
                <ContentMixAnalyzer
                  categories={categories}
                  categoryBreakdown={categoryBreakdown}
                  platformBreakdown={platformBreakdown}
                  contentTypeBreakdown={contentTypeBreakdown}
                  totalSlots={totalSlots}
                  slots={plan.slots}
                  month={plan.month}
                  year={plan.year}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function SlotEditor({
  slot,
  categories,
  onUpdate,
  onDelete,
  hashtagInput,
  setHashtagInput,
}: {
  slot: Slot;
  categories: Category[];
  onUpdate: (updates: Partial<Slot>) => void;
  onDelete: () => void;
  hashtagInput: string;
  setHashtagInput: (v: string) => void;
}) {
  const [localSlot, setLocalSlot] = useState(slot);

  useEffect(() => {
    setLocalSlot(slot);
  }, [slot.id]);

  const save = (field: string, value: any) => {
    setLocalSlot((prev) => ({ ...prev, [field]: value }));
    onUpdate({ [field]: value });
  };

  const hashtags = Array.isArray(localSlot.hashtagsJson) ? localSlot.hashtagsJson : [];
  const captionLen = (localSlot.caption ?? "").length;

  const addHashtag = () => {
    const tag = hashtagInput.trim().replace(/^#/, "");
    if (!tag) return;
    const newTags = [...hashtags, `#${tag}`];
    save("hashtagsJson", newTags);
    setHashtagInput("");
  };

  const removeHashtag = (index: number) => {
    const newTags = hashtags.filter((_: string, i: number) => i !== index);
    save("hashtagsJson", newTags);
  };

  const formatSize = (platform: string) => {
    if (platform.includes("reel") || platform.includes("stor") || platform === "tiktok" || platform === "youtube_shorts") return "1080x1920";
    return "1080x1080 o 1080x1350";
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">
          {localSlot.title || `${CONTENT_TYPES.find((t) => t.value === localSlot.contentType)?.label ?? "Post"}`}
        </h2>
        <button onClick={onDelete} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
          <Trash2 size={15} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Piattaforma</label>
          <select
            value={localSlot.platform}
            onChange={(e) => save("platform", e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background"
          >
            {Object.entries(PLATFORMS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo contenuto</label>
          <select
            value={localSlot.contentType}
            onChange={(e) => save("contentType", e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background"
          >
            {CONTENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Categoria</label>
          <select
            value={localSlot.categoryId ?? ""}
            onChange={(e) => save("categoryId", e.target.value ? Number(e.target.value) : null)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background"
          >
            <option value="">Nessuna</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Data pubblicazione</label>
          <input
            type="date"
            value={localSlot.publishDate ?? ""}
            onChange={(e) => save("publishDate", e.target.value || null)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Ora</label>
          <input
            type="time"
            value={localSlot.publishTime ?? ""}
            onChange={(e) => save("publishTime", e.target.value || null)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Stato</label>
        <div className="flex gap-2">
          {Object.entries(SLOT_STATUS).map(([key, info]) => (
            <button
              key={key}
              onClick={() => save("status", key)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                localSlot.status === key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-muted"
              )}
            >
              <span className={cn("inline-block w-2 h-2 rounded-full mr-1.5", info.color)} />
              {info.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Titolo / riferimento interno</label>
        <input
          type="text"
          value={localSlot.title ?? ""}
          onChange={(e) => save("title", e.target.value || null)}
          placeholder="Es: Post prodotto primavera..."
          className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-muted-foreground">Caption</label>
          <span className={cn("text-[10px]", captionLen > 2200 ? "text-red-500 font-bold" : "text-muted-foreground")}>
            {captionLen}/2200
          </span>
        </div>
        <textarea
          value={localSlot.caption ?? ""}
          onChange={(e) => save("caption", e.target.value || null)}
          placeholder="Scrivi la caption del post..."
          rows={5}
          className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background resize-none font-mono"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-muted-foreground">Hashtag</label>
          <span className={cn("text-[10px]", hashtags.length > 30 ? "text-red-500 font-bold" : "text-muted-foreground")}>
            {hashtags.length}/30
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {hashtags.map((tag: string, i: number) => (
            <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-lg text-xs">
              {tag}
              <button onClick={() => removeHashtag(i)} className="hover:text-red-500"><X size={10} /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={hashtagInput}
            onChange={(e) => setHashtagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addHashtag(); }}}
            placeholder="#hashtag"
            className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-background"
          />
          <button onClick={addHashtag} className="px-3 py-2 text-xs font-medium border border-border rounded-lg hover:bg-muted">
            Aggiungi
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Call to Action</label>
          <select
            value={localSlot.callToAction ?? ""}
            onChange={(e) => save("callToAction", e.target.value || null)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background"
          >
            <option value="">Nessuna</option>
            {CTA_OPTIONS.map((cta) => (
              <option key={cta} value={cta}>{cta}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Link in bio</label>
          <input
            type="text"
            value={localSlot.linkInBio ?? ""}
            onChange={(e) => save("linkInBio", e.target.value || null)}
            placeholder="URL..."
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background"
          />
        </div>
      </div>

      <div className="border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Image size={15} className="text-muted-foreground" />
          <label className="text-xs font-medium text-muted-foreground">Riferimento visuale</label>
          <span className="text-[10px] text-muted-foreground ml-auto">Formato: {formatSize(localSlot.platform)}</span>
        </div>
        <input
          type="text"
          value={localSlot.visualUrl ?? ""}
          onChange={(e) => save("visualUrl", e.target.value || null)}
          placeholder="URL immagine di riferimento o link Canva/Drive..."
          className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background mb-2"
        />
        <textarea
          value={localSlot.visualDescription ?? ""}
          onChange={(e) => save("visualDescription", e.target.value || null)}
          placeholder="Descrizione del visual: es. Foto prodotto su sfondo bianco, mood lifestyle..."
          rows={2}
          className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Note interne (non nel PDF)</label>
          <textarea
            value={localSlot.notesInternal ?? ""}
            onChange={(e) => save("notesInternal", e.target.value || null)}
            placeholder="Note per il team creativo..."
            rows={3}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background resize-none"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Note per il cliente (nel PDF)</label>
          <textarea
            value={localSlot.notesClient ?? ""}
            onChange={(e) => save("notesClient", e.target.value || null)}
            placeholder="Note visibili nel PDF..."
            rows={3}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background resize-none"
          />
        </div>
      </div>
    </div>
  );
}

function ContentMixAnalyzer({
  categories,
  categoryBreakdown,
  platformBreakdown,
  contentTypeBreakdown,
  totalSlots,
  slots,
  month,
  year,
}: {
  categories: Category[];
  categoryBreakdown: Record<number, number>;
  platformBreakdown: Record<string, number>;
  contentTypeBreakdown: Record<string, number>;
  totalSlots: number;
  slots: Slot[];
  month: number;
  year: number;
}) {
  if (totalSlots === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <BarChart3 size={40} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground text-sm">Seleziona uno slot dalla lista per modificarlo</p>
          <p className="text-muted-foreground/60 text-xs mt-1">oppure aggiungi contenuti per vedere le analisi</p>
        </div>
      </div>
    );
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const weeksInMonth = Math.ceil(daysInMonth / 7);
  const postsPerWeek = (totalSlots / weeksInMonth).toFixed(1);

  const promoCount = Object.entries(categoryBreakdown).reduce((sum, [catId, count]) => {
    const cat = categories.find((c) => c.id === Number(catId));
    if (cat?.name.toLowerCase().includes("promozion") || cat?.name.toLowerCase().includes("offerta")) return sum + count;
    return sum;
  }, 0);
  const promoPercent = totalSlots > 0 ? Math.round((promoCount / totalSlots) * 100) : 0;

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-bold flex items-center gap-2">
        <BarChart3 size={15} /> Analisi Content Mix
      </h3>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Distribuzione Categorie</p>
          <div className="space-y-2">
            {Object.entries(categoryBreakdown).map(([catId, count]) => {
              const cat = categories.find((c) => c.id === Number(catId));
              const pct = Math.round((count / totalSlots) * 100);
              return (
                <div key={catId} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat?.color ?? "#888" }} />
                  <span className="text-xs flex-1 truncate">{cat?.name ?? "Altro"}</span>
                  <span className="text-xs font-medium">{count}</span>
                  <span className="text-[10px] text-muted-foreground w-8 text-right">{pct}%</span>
                </div>
              );
            })}
            {Object.keys(categoryBreakdown).length === 0 && (
              <p className="text-xs text-muted-foreground">Nessuna categoria assegnata</p>
            )}
          </div>
          {promoPercent > 20 && (
            <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <p className="text-[10px] text-amber-700 dark:text-amber-400">
                Il contenuto promozionale e al {promoPercent}%. Le best practice suggeriscono max 20%.
              </p>
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Distribuzione Piattaforme</p>
          <div className="space-y-2">
            {Object.entries(platformBreakdown).map(([platform, count]) => {
              const pct = Math.round((count / totalSlots) * 100);
              return (
                <div key={platform}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs">{PLATFORMS[platform] ?? platform}</span>
                    <span className="text-xs font-medium">{count}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Tipo Contenuto</p>
          <div className="space-y-2">
            {Object.entries(contentTypeBreakdown).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-xs capitalize">{CONTENT_TYPES.find((t) => t.value === type)?.label ?? type}</span>
                <span className="text-xs font-medium">{count}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-border space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Post/settimana</span>
              <span className="font-medium">{postsPerWeek}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Totale post</span>
              <span className="font-medium">{totalSlots}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
