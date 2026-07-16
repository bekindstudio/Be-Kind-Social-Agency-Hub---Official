/**
 * Prefetch dei chunk di pagina al passaggio del mouse sulle voci di menu.
 * Le pagine sono lazy-loaded (vedi App.tsx): al primo hover scarichiamo già il
 * chunk, così il click apre la pagina all'istante. Gli specifier di import DEVONO
 * combaciare con quelli di App.tsx affinché Vite riusi lo stesso chunk.
 */
const prefetchers: Record<string, () => Promise<unknown>> = {
  "/today": () => import("@/pages/today"),
  "/dashboard": () => import("@/pages/dashboard"),
  "/clients": () => import("@/pages/clients"),
  "/projects": () => import("@/pages/projects"),
  "/tasks": () => import("@/pages/tasks"),
  "/team": () => import("@/pages/team"),
  "/chat": () => import("@/pages/chat"),
  "/files": () => import("@/pages/files"),
  "/quotes": () => import("@/pages/quotes"),
  "/contracts/templates": () => import("@/pages/contracts-templates"),
  "/settings": () => import("@/pages/settings"),
  "/trash": () => import("@/pages/trash"),
  "/ai-assistant": () => import("@/pages/ai-assistant"),
  "/banca-idee": () => import("@/pages/ContentIdeasBankPage"),
  "/tools/brief": () => import("@/pages/tools/BriefPage"),
  "/tools/calendar": () => import("@/pages/tools/CalendarPage"),
  "/tools/events": () => import("@/pages/tools/EventsPage"),
  "/tools/competitors": () => import("@/pages/tools/CompetitorsPage"),
  "/tools/analytics": () => import("@/pages/tools/AnalyticsPage"),
  "/tools/reports": () => import("@/pages/tools/ReportsPage"),
  "/tools/caption-ai": () => import("@/pages/tools/CaptionAiPage"),
};

const done = new Set<string>();

/** Avvia il prefetch del chunk per la rotta indicata (una sola volta). */
export function prefetchRoute(href: string): void {
  if (done.has(href)) return;
  const load = prefetchers[href];
  if (!load) return;
  done.add(href);
  void load().catch(() => done.delete(href));
}
