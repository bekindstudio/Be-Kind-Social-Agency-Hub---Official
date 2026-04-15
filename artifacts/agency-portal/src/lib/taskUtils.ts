export interface ProgressChecklistItem {
  completato: boolean;
}

export function calcProgress<T extends ProgressChecklistItem>(items: T[]) {
  if (items.length === 0) return { done: 0, total: 0, pct: 0 };
  const done = items.filter((item) => item.completato).length;
  return { done, total: items.length, pct: Math.round((done / items.length) * 100) };
}
