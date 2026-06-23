import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { portalFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Clock, Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";

/* Pagina "Ore" — time tracking personale.
   Registri quanto tempo hai lavorato (cliente/progetto/task/categoria) e a fine
   mese vedi un report grafico di dove hai messo più tempo. Dati personali per
   utente (l'API filtra su userId). */

type AnyObj = Record<string, any>;

// Categorie attività: includono "Tempo perso" per confrontare quanto tempo va
// in cose non produttive, come chiesto.
const CATEGORIES: { value: string; label: string; color: string }[] = [
  { value: "cliente", label: "Lavoro cliente", color: "bg-sky-500" },
  { value: "interno", label: "Lavoro interno", color: "bg-emerald-500" },
  { value: "riunione", label: "Riunione", color: "bg-violet-500" },
  { value: "admin", label: "Amministrazione", color: "bg-slate-400" },
  { value: "perso", label: "Tempo perso", color: "bg-rose-500" },
  { value: "altro", label: "Altro", color: "bg-amber-500" },
];
const CAT_LABEL = (v: string | null | undefined) => CATEGORIES.find((c) => c.value === v)?.label ?? "Senza categoria";
const CAT_COLOR = (v: string | null | undefined) => CATEGORIES.find((c) => c.value === v)?.color ?? "bg-muted-foreground/40";

function useApi<T>(key: (string | number)[], path: string, staleSec = 60): { data: T | null; loading: boolean } {
  const q = useQuery({
    queryKey: key,
    staleTime: staleSec * 1000,
    queryFn: async () => {
      const r = await portalFetch(path, { credentials: "include" });
      if (!r.ok) return null as any;
      return r.json();
    },
  });
  return { data: (q.data as T) ?? null, loading: q.isLoading };
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtHm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function TimeTrackerPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const clients = useApi<AnyObj[]>(["tt", "clients"], "/api/clients", 300).data ?? [];
  const projects = useApi<AnyObj[]>(["tt", "projects"], "/api/projects", 300).data ?? [];
  const tasks = useApi<AnyObj[]>(["tt", "tasks"], "/api/tasks", 120).data ?? [];

  // Mese visualizzato nel report.
  const [monthCursor, setMonthCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const monthStart = monthCursor;
  const monthEnd = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0, 23, 59, 59);
  const monthKey = `${monthCursor.getFullYear()}-${monthCursor.getMonth()}`;

  const entriesQ = useQuery({
    queryKey: ["tt", "entries", monthKey],
    staleTime: 30_000,
    queryFn: async () => {
      const r = await portalFetch(`/api/time-entries?from=${monthStart.toISOString()}&to=${monthEnd.toISOString()}`, { credentials: "include" });
      if (!r.ok) return [] as AnyObj[];
      return r.json();
    },
  });
  const entries: AnyObj[] = Array.isArray(entriesQ.data) ? entriesQ.data : [];

  // ── Form di registrazione ──────────────────────────────────────────────
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [taskText, setTaskText] = useState("");
  const [date, setDate] = useState(() => isoDate(new Date()));
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [category, setCategory] = useState("cliente");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const projectsForClient = useMemo(
    () => (clientId ? projects.filter((p) => String(p.clientId) === clientId) : projects),
    [projects, clientId],
  );
  const tasksForScope = useMemo(() => {
    let list = tasks;
    if (projectId) list = list.filter((t) => String(t.projectId) === projectId);
    else if (clientId) {
      const pids = new Set(projectsForClient.map((p) => Number(p.id)));
      list = list.filter((t) => (t.projectId != null && pids.has(Number(t.projectId))) || String(t.clientId) === clientId);
    }
    return list;
  }, [tasks, projectId, clientId, projectsForClient]);

  const durationMinutes = (parseInt(hours || "0", 10) || 0) * 60 + (parseInt(minutes || "0", 10) || 0);

  const resetForm = () => { setProjectId(""); setTaskText(""); setHours(""); setMinutes(""); setNote(""); };

  const addEntry = async () => {
    if (durationMinutes <= 0) { toast({ variant: "destructive", title: "Inserisci una durata (ore o minuti)" }); return; }
    // Campo Task libero: se il testo coincide con una task esistente la collego
    // (taskId); altrimenti resta testo libero salvato nella descrizione, così
    // puoi registrare anche task non presenti nella to-do.
    const typed = taskText.trim();
    const matched = typed
      ? tasksForScope.find((t) => String(t.title ?? "").trim().toLowerCase() === typed.toLowerCase())
      : undefined;
    const noteTrim = note.trim();
    const description = matched
      ? (noteTrim || null)
      : (typed ? (noteTrim ? `${typed} — ${noteTrim}` : typed) : (noteTrim || null));
    setSaving(true);
    try {
      const r = await portalFetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: clientId ? Number(clientId) : null,
          projectId: projectId ? Number(projectId) : null,
          taskId: matched ? Number(matched.id) : null,
          activityType: category,
          description,
          date,
          durationMinutes,
        }),
      });
      if (!r.ok) {
        let msg = "Salvataggio non riuscito";
        try { const j = await r.json(); if (j?.error) msg = String(j.error); } catch { /* ignore */ }
        toast({ variant: "destructive", title: msg });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["tt", "entries"] });
      resetForm();
      toast({ title: `✓ Registrato ${fmtHm(durationMinutes)}` });
    } catch {
      toast({ variant: "destructive", title: "Errore di rete" });
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async (id: number) => {
    try {
      const r = await portalFetch(`/api/time-entries/${id}`, { method: "DELETE" });
      if (!r.ok && r.status !== 204) { toast({ variant: "destructive", title: "Eliminazione non riuscita" }); return; }
      queryClient.invalidateQueries({ queryKey: ["tt", "entries"] });
    } catch {
      toast({ variant: "destructive", title: "Errore di rete" });
    }
  };

  // ── Aggregati ──────────────────────────────────────────────────────────
  const totalMonthMin = entries.reduce((acc, e) => acc + (e.durationMinutes ?? 0), 0);
  const todayKey = isoDate(new Date());
  const todayEntries = entries.filter((e) => e.startedAt && isoDate(new Date(e.startedAt)) === todayKey);
  const todayMin = todayEntries.reduce((acc, e) => acc + (e.durationMinutes ?? 0), 0);

  const [reportBy, setReportBy] = useState<"cliente" | "progetto" | "categoria">("cliente");
  const report = useMemo(() => {
    const map = new Map<string, { label: string; minutes: number; color?: string }>();
    for (const e of entries) {
      let keyId: string; let label: string; let color: string | undefined;
      if (reportBy === "cliente") { keyId = `c${e.clientId ?? "0"}`; label = e.clientName ?? "Senza cliente"; }
      else if (reportBy === "progetto") { keyId = `p${e.projectId ?? "0"}`; label = e.projectName ?? "Senza progetto"; }
      else { keyId = `a${e.activityType ?? "0"}`; label = CAT_LABEL(e.activityType); color = CAT_COLOR(e.activityType); }
      const cur = map.get(keyId) ?? { label, minutes: 0, color };
      cur.minutes += e.durationMinutes ?? 0;
      map.set(keyId, cur);
    }
    const rows = [...map.values()].sort((a, b) => b.minutes - a.minutes);
    const max = rows.reduce((m, r) => Math.max(m, r.minutes), 0);
    return { rows, max };
  }, [entries, reportBy]);

  const monthLabel = monthCursor.toLocaleDateString("it-IT", { month: "long", year: "numeric" });

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-5xl mx-auto">
        {/* Hero */}
        <div className="mb-6">
          <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
            <Clock size={16} className="text-primary" /> Ore lavorate
          </p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight mt-1">
            {totalMonthMin === 0 ? (
              <>Nessuna ora registrata <span className="capitalize">{monthLabel}</span></>
            ) : (
              <>Hai registrato <span className="text-primary tabular-nums">{fmtHm(totalMonthMin)}</span> <span className="capitalize">{monthLabel}</span></>
            )}
          </h1>
          {todayMin > 0 && <p className="text-sm text-muted-foreground mt-2">Oggi: {fmtHm(todayMin)} · {entries.length} voci nel mese</p>}
        </div>

        {/* Form registrazione */}
        <div className="rounded-2xl border border-card-border bg-card p-4 md:p-5 mb-6">
          <p className="text-sm font-semibold mb-3 inline-flex items-center gap-2"><Plus size={15} className="text-primary" /> Registra tempo</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-xs font-medium text-muted-foreground">
              Cliente
              <select value={clientId} onChange={(e) => { setClientId(e.target.value); setProjectId(""); setTaskText(""); }} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground">
                <option value="">— Nessun cliente (interno) —</option>
                {clients.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Progetto <span className="opacity-60">(opzionale)</span>
              <select value={projectId} onChange={(e) => { setProjectId(e.target.value); setTaskText(""); }} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground">
                <option value="">— Nessuno —</option>
                {projectsForClient.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Task <span className="opacity-60">(scegli o scrivi)</span>
              <input
                list="tt-tasklist"
                value={taskText}
                onChange={(e) => setTaskText(e.target.value)}
                placeholder="Scegli dall'elenco o scrivi una task…"
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
              <datalist id="tt-tasklist">
                {tasksForScope.slice(0, 200).map((t) => <option key={t.id} value={t.title} />)}
              </datalist>
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Categoria
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground">
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Data
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                Ore
                <input type="number" min={0} max={999} value={hours} onChange={(e) => setHours(e.target.value)} placeholder="0" className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground" />
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                Minuti
                <input type="number" min={0} max={59} value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="0" className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground" />
              </label>
            </div>
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota (cosa hai fatto)…" className="mt-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground" />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Durata: <span className="font-semibold text-foreground tabular-nums">{durationMinutes > 0 ? fmtHm(durationMinutes) : "—"}</span></p>
            <button type="button" onClick={addEntry} disabled={saving || durationMinutes <= 0} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
              <Plus size={15} /> {saving ? "Salvataggio…" : "Aggiungi"}
            </button>
          </div>
        </div>

        {/* Voci di oggi */}
        <div className="rounded-2xl border border-card-border bg-card p-4 md:p-5 mb-6">
          <p className="text-sm font-semibold mb-3">Oggi {todayEntries.length > 0 && <span className="text-muted-foreground font-normal">· {fmtHm(todayMin)}</span>}</p>
          {todayEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Nessuna voce registrata oggi. Aggiungine una qui sopra.</p>
          ) : (
            <div className="divide-y divide-card-border/50">
              {todayEntries.map((e) => (
                <div key={e.id} className="flex items-center gap-3 py-2.5">
                  <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", CAT_COLOR(e.activityType))} title={CAT_LABEL(e.activityType)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {e.clientName ?? "Interno"}{e.projectName ? ` · ${e.projectName}` : ""}{e.taskTitle ? ` · ${e.taskTitle}` : (e.description ? ` · ${e.description}` : "")}
                    </p>
                    {e.taskTitle && e.description && <p className="text-xs text-muted-foreground truncate">{e.description}</p>}
                  </div>
                  <span className="text-sm font-semibold tabular-nums shrink-0">{fmtHm(e.durationMinutes ?? 0)}</span>
                  <button type="button" onClick={() => deleteEntry(e.id)} className="p-2 text-muted-foreground hover:text-destructive rounded-lg hover:bg-muted shrink-0" aria-label="Elimina" title="Elimina">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Report mensile */}
        <div className="rounded-2xl border border-card-border bg-card p-4 md:p-5">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))} className="p-1.5 rounded-lg border border-input hover:bg-muted" aria-label="Mese precedente"><ChevronLeft size={16} /></button>
              <p className="text-sm font-semibold capitalize min-w-[8rem] text-center">{monthLabel}</p>
              <button type="button" onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))} className="p-1.5 rounded-lg border border-input hover:bg-muted" aria-label="Mese successivo"><ChevronRight size={16} /></button>
            </div>
            <div className="flex gap-1">
              {(["cliente", "progetto", "categoria"] as const).map((r) => (
                <button key={r} type="button" onClick={() => setReportBy(r)} className={cn("px-3 py-1.5 text-xs rounded-lg capitalize", reportBy === r ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>{r}</button>
              ))}
            </div>
          </div>

          {report.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nessun dato per {monthLabel}. Registra il tempo per vedere il report.</p>
          ) : (
            <div className="space-y-3">
              {report.rows.map((row, i) => {
                const pct = totalMonthMin > 0 ? Math.round((row.minutes / totalMonthMin) * 100) : 0;
                const barW = report.max > 0 ? Math.round((row.minutes / report.max) * 100) : 0;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium truncate">{row.label}</span>
                      <span className="text-muted-foreground tabular-nums shrink-0 ml-2">{fmtHm(row.minutes)} · {pct}%</span>
                    </div>
                    <div className="h-3 rounded-full bg-muted overflow-hidden">
                      <div className={cn("h-full rounded-full", row.color ?? "bg-primary")} style={{ width: `${barW}%` }} />
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-muted-foreground pt-2 border-t border-card-border/50">
                Totale {monthLabel}: <span className="font-semibold text-foreground">{fmtHm(totalMonthMin)}</span> su {entries.length} voci
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
