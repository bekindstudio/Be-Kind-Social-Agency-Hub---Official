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

export const STATUS_COLORS: Record<string, string> = {
  planning: "bg-blue-100 text-blue-700",
  active: "bg-emerald-100 text-emerald-700",
  review: "bg-amber-100 text-amber-700",
  completed: "bg-gray-100 text-gray-600",
  "on-hold": "bg-red-100 text-red-600",
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  todo: "Da fare",
  "in-progress": "In corso",
  review: "In revisione",
  done: "Completato",
};

export const TASK_STATUS_COLORS: Record<string, string> = {
  todo: "bg-gray-100 text-gray-600",
  "in-progress": "bg-blue-100 text-blue-700",
  review: "bg-amber-100 text-amber-700",
  done: "bg-emerald-100 text-emerald-700",
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: "Bassa",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

export const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-500",
  medium: "bg-sky-100 text-sky-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
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
