/**
 * Costanti di dominio della Banca Idee, condivise fra la rotta agenzia
 * (routes/client-content-ideas.ts) e quella pubblica del cliente
 * (routes/public-portal.ts): entrambe scrivono sulla stessa tabella, quindi
 * devono accettare esattamente gli stessi valori.
 *
 * Da tenere allineate a:
 *  - i CHECK di client_content_ideas (status/category) su Supabase
 *  - STATUS_META / CATEGORY_META in agency-portal/src/lib/ideasSchema.ts
 */

export const IDEA_STATUSES = ["da_valutare", "approvata", "realizzata"] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

export const IDEA_CATEGORIES = [
  "da_classificare",
  "educativo",
  "informativo",
  "divertente",
  "vendita",
  "ispirazionale",
  "dietro_le_quinte",
] as const;
export type IdeaCategory = (typeof IDEA_CATEGORIES)[number];

/**
 * Normalizza la categoria arrivata dal body. Il valore viene da una tendina,
 * ma sull'area cliente non c'è login e una POST diretta può mandare qualsiasi
 * cosa: tutto ciò che non è in lista diventa 'da_classificare' invece di far
 * fallire l'inserimento sul CHECK del DB con un 500.
 */
export function normalizeCategory(raw: unknown): IdeaCategory {
  return typeof raw === "string" && (IDEA_CATEGORIES as readonly string[]).includes(raw)
    ? (raw as IdeaCategory)
    : "da_classificare";
}
