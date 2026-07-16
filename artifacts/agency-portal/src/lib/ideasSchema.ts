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

export type IdeaCategory =
  | "da_classificare"
  | "educativo"
  | "informativo"
  | "divertente"
  | "vendita"
  | "ispirazionale"
  | "dietro_le_quinte";

export type ContentIdeaRow = {
  id: number;
  clientId?: number;
  clientName?: string;
  title: string;
  url: string;
  platform: string;
  source: "agency" | "client";
  status: IdeaStatus;
  category: IdeaCategory;
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

/**
 * Tipo di contenuto ("pilastro"). Sei categorie + "Da classificare" per le idee
 * buttate dentro al volo: la categoria è facoltativa, si può decidere dopo.
 * `descr` compare solo nella tendina di scelta, non sulle card: serve a chi
 * inserisce, non a chi consulta.
 */
export const CATEGORY_META: { value: IdeaCategory; label: string; descr: string; color: string }[] = [
  { value: "da_classificare", label: "Da classificare", descr: "decidi dopo", color: "bg-muted-foreground/40" },
  { value: "educativo", label: "Educativo", descr: "insegna qualcosa", color: "bg-indigo-500" },
  { value: "informativo", label: "Informativo", descr: "news, aggiornamenti", color: "bg-sky-500" },
  { value: "divertente", label: "Divertente", descr: "intrattiene, fa ridere", color: "bg-amber-500" },
  { value: "vendita", label: "Vendita", descr: "promuove un prodotto o servizio", color: "bg-emerald-600" },
  { value: "ispirazionale", label: "Ispirazionale", descr: "motiva, emoziona", color: "bg-violet-500" },
  { value: "dietro_le_quinte", label: "Dietro le quinte", descr: "mostra il lavoro", color: "bg-rose-500" },
];

export const categoryMeta = (v: string) => CATEGORY_META.find((c) => c.value === v) ?? CATEGORY_META[0];

/** Le categorie vere, senza il segnaposto "Da classificare". */
export const REAL_CATEGORIES = CATEGORY_META.filter((c) => c.value !== "da_classificare");
