import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";

/**
 * Banca idee contenuti per cliente: link "ispirazione" (reel/post Instagram,
 * TikTok, YouTube…) salvati con un titolo, da riprendere quando si produce.
 *
 * Diversa da `clientNotesTable` (appunti testuali liberi, nessun link) e da
 * `editorialPlansTable`/`clientPostsTable` (contenuti già pianificati con data
 * di uscita). Qui NON c'è data di pubblicazione: è un archivio di riferimenti
 * da pescare dopo. Diversa anche da "Ideatore Contenuti AI"
 * (/tools/content-ideas), che genera idee con l'AI al volo e non le conserva.
 *
 * `source` distingue chi l'ha inserita: 'agency' (il team, dal cockpit cliente
 * o dalla pagina Banca Idee) oppure 'client' (il cliente stesso, dall'area
 * pubblica /portal/:token). `createdBy` è il Supabase userId e resta NULL per
 * source='client': il cliente non ha login, la sua identità è lo share_token.
 *
 * `platform` è DERIVATA dall'url lato server (api-server/src/lib/social-url.ts),
 * mai accettata dal body: è l'unica fonte di verità.
 */
export const clientContentIdeasTable = pgTable("client_content_ideas", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  url: text("url").notNull(),
  platform: text("platform").notNull().default("web"),
  source: text("source").notNull().default("agency"),
  status: text("status").notNull().default("da_valutare"),
  // Tipo di contenuto (educativo/informativo/divertente/vendita/…): serve a
  // ripescare le idee per pilastro quando si costruisce il piano editoriale.
  // Facoltativa: chi inserisce può lasciarla 'da_classificare' e decidere dopo.
  category: text("category").notNull().default("da_classificare"),
  notes: text("notes"),
  tags: text("tags").array().notNull().default([]),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type ClientContentIdea = typeof clientContentIdeasTable.$inferSelect;
export type InsertClientContentIdea = typeof clientContentIdeasTable.$inferInsert;
