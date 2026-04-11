/**
 * Estrae messaggio / codice da errori Postgres (node-postgres, catena `cause`).
 */
export function collectPgErrorMeta(err: unknown): { text: string; code?: string } {
  const chunks: string[] = [];
  let code: string | undefined;
  let cur: unknown = err;
  const seen = new Set<unknown>();

  for (let i = 0; i < 8 && cur && typeof cur === "object" && !seen.has(cur); i++) {
    seen.add(cur);
    const o = cur as Record<string, unknown>;
    if (typeof o.message === "string") chunks.push(o.message);
    if (typeof o.detail === "string") chunks.push(o.detail);
    if (typeof o.code === "string") {
      code ??= o.code;
      chunks.push(`pgcode=${o.code}`);
    }
    cur = o.cause;
  }

  const text = chunks.join(" ").trim() || (err instanceof Error ? err.message : String(err));
  return { text, code };
}

/** 42703 = undefined_column (Postgres). */
export function isUndefinedColumnError(meta: { text: string; code?: string }): boolean {
  if (meta.code === "42703") return true;
  const t = meta.text.toLowerCase();
  return t.includes("column") && t.includes("does not exist");
}

/** 42P01 = undefined_table */
export function isUndefinedTableError(meta: { text: string; code?: string }): boolean {
  if (meta.code === "42P01") return true;
  const t = meta.text.toLowerCase();
  return t.includes("relation") && t.includes("does not exist");
}
