/**
 * Schema condiviso della Banca Idee: usato sia dal lato agenzia (pagina
 * /banca-idee e tab nel cockpit cliente) sia dall'area cliente pubblica
 * (portal/ClientPortalPage.tsx). Le due UI devono mostrare la stessa etichetta
 * e lo stesso colore per la stessa piattaforma/stato — stesso pattern di
 * briefSchema.ts, importato da entrambi i lati.
 *
 * La piattaforma NON si deriva qui: la calcola il server dall'url
 * (api-server/src/lib/social-url.ts) ed è l'unica fonte di verità. Qui c'è solo
 * la resa grafica.
 */
import { Instagram, Music2, Youtube, Facebook, Linkedin, Globe, type LucideIcon } from "lucide-react";

export type IdeaStatus = "da_valutare" | "approvata" | "realizzata";

export type ContentIdeaRow = {
  id: number;
  clientId?: number;
  clientName?: string;
  title: string;
  url: string;
  platform: string;
  source: "agency" | "client";
  status: IdeaStatus;
  notes: string | null;
  tags?: string[];
  createdBy?: string | null;
  createdAt: string | null;
  updatedAt?: string | null;
};

const PLATFORM_META: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  instagram: { label: "Instagram", icon: Instagram, color: "bg-rose-500" },
  tiktok: { label: "TikTok", icon: Music2, color: "bg-slate-900" },
  youtube: { label: "YouTube", icon: Youtube, color: "bg-red-600" },
  facebook: { label: "Facebook", icon: Facebook, color: "bg-sky-600" },
  linkedin: { label: "LinkedIn", icon: Linkedin, color: "bg-blue-700" },
  pinterest: { label: "Pinterest", icon: Globe, color: "bg-rose-700" },
  web: { label: "Link", icon: Globe, color: "bg-muted-foreground/40" },
};

/** Meta grafici della piattaforma (fallback: link generico). */
export const platformMeta = (p: string) => PLATFORM_META[p] ?? PLATFORM_META.web;

/**
 * Ciclo di vita dell'idea. Tre stati soltanto, di proposito: la banca deve
 * restare consultabile a colpo d'occhio, non diventare un gestionale.
 * Lo stato lo muove l'agenzia; il cliente lo vede e basta.
 */
export const STATUS_META: { value: IdeaStatus; label: string; color: string }[] = [
  { value: "da_valutare", label: "Da valutare", color: "bg-sky-500" },
  { value: "approvata", label: "Approvata", color: "bg-amber-500" },
  { value: "realizzata", label: "Realizzata", color: "bg-emerald-500" },
];

export const statusMeta = (v: string) => STATUS_META.find((s) => s.value === v) ?? STATUS_META[0];
