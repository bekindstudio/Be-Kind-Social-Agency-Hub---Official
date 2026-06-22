import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const STATUS_LABELS: Record<string, string> = {
  planning: "Pianificazione",
  active: "Attivo",
  review: "In revisione",
  completed: "Completato",
  "on-hold": "In pausa",
};

// Palette semantica ristretta e soft (riduce il rumore cromatico, Wave BO):
// muted = neutro/idle · sky = in corso/info · amber = attenzione · emerald = ok/fatto · rose = urgente.
export const STATUS_COLORS: Record<string, string> = {
  planning: "bg-muted text-muted-foreground",
  active: "bg-sky-50 text-sky-700",
  review: "bg-amber-50 text-amber-700",
  completed: "bg-emerald-50 text-emerald-700",
  "on-hold": "bg-muted text-muted-foreground",
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  todo: "Da fare",
  "in-progress": "In corso",
  review: "In revisione",
  done: "Completato",
};

export const TASK_STATUS_COLORS: Record<string, string> = {
  todo: "bg-muted text-muted-foreground",
  "in-progress": "bg-sky-50 text-sky-700",
  review: "bg-amber-50 text-amber-700",
  done: "bg-emerald-50 text-emerald-700",
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: "Bassa",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

export const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-sky-50 text-sky-700",
  high: "bg-amber-50 text-amber-700",
  urgent: "bg-rose-50 text-rose-700",
};

export const PROJECT_CATEGORIES: { value: string; label: string; icon: string }[] = [
  { value: "social-media", label: "Comunicazione Social Media", icon: "share-2" },
  { value: "marketing-adv", label: "Marketing e ADV", icon: "megaphone" },
  { value: "sito-web", label: "Sito Web", icon: "globe" },
  { value: "ecommerce", label: "E-commerce", icon: "shopping-cart" },
  { value: "seo-sem", label: "SEO e SEM", icon: "search" },
  { value: "google-ads", label: "Campagne Google Ads", icon: "target" },
  { value: "meta-ads", label: "Campagne Meta Ads", icon: "zap" },
  { value: "email-marketing", label: "Email Marketing", icon: "mail" },
  { value: "content-marketing", label: "Content Marketing", icon: "pen-tool" },
  { value: "produzione-video", label: "Produzione Video", icon: "video" },
  { value: "fotografia-contenuti", label: "Fotografia e Contenuti Creativi", icon: "camera" },
  { value: "branding", label: "Branding e Identità Visiva", icon: "palette" },
  { value: "influencer", label: "Influencer Marketing", icon: "users" },
  { value: "pr", label: "Relazioni Pubbliche (PR)", icon: "newspaper" },
  { value: "strategia-digitale", label: "Strategia Digitale", icon: "compass" },
  { value: "analisi-report", label: "Analisi e Reportistica", icon: "bar-chart-3" },
  { value: "crm-automazioni", label: "CRM e Automazioni Marketing", icon: "settings" },
  { value: "app-mobile", label: "App Mobile", icon: "smartphone" },
  { value: "consulenza", label: "Consulenza e Formazione", icon: "graduation-cap" },
  { value: "altro", label: "Altro", icon: "folder" },
];
