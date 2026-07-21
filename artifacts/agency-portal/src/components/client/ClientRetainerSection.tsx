import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portalFetch } from "@workspace/api-client-react";
import { Repeat, Plus, Trash2, Play, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

/**
 * Il retainer del cliente in due domande:
 *  1. "questo mese sto dentro?"  → barra ore fatte / ore incluse
 *  2. "cosa si rifà ogni mese?"  → i modelli che il job del 1° materializza
 *
 * Volutamente niente fila di stat card: un numero grande che risponde alla
 * domanda, e sotto la lista del lavoro.
 */

type RetainerModel = {
  id: number;
  title: string;
  description: string | null;
  categoria: string | null;
  dayOfMonth: number;
  estimatedHours: number | null;
  priority: string;
  active: boolean;
};

type RetainerSummary = {
  period: string;
  valoreMensile: number | null;
  oreIncluse: number | null;
  billableHours: number;
  nonBillableHours: number;
  oreSforate: number | null;
  tariffaEffettiva: number | null;
  taskTotali: number;
  taskFatte: number;
};

const EMPTY_MODEL = { title: "", dayOfMonth: 1, estimatedHours: "", priority: "medium", categoria: "" };

export function ClientRetainerSection({ clientId }: { clientId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_MODEL);

  const modelsKey = ["client-retainer-models", clientId];
  const summaryKey = ["client-retainer-summary", clientId];

  // Senza il check su r.ok, un 403 verrebbe renderizzato come se fossero dati
  // ({error: "..."} non è un array e .map esploderebbe).
  const getJson = async <T,>(path: string): Promise<T> => {
    const r = await portalFetch(path);
    if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? `Errore ${r.status}`);
    return r.json() as Promise<T>;
  };

  const { data: models = [], isLoading } = useQuery<RetainerModel[]>({
    queryKey: modelsKey,
    queryFn: () => getJson<RetainerModel[]>(`/api/clients/${clientId}/retainer/models`),
  });

  const { data: summary } = useQuery<RetainerSummary>({
    queryKey: summaryKey,
    queryFn: () => getJson<RetainerSummary>(`/api/clients/${clientId}/retainer/summary`),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: modelsKey });
    void qc.invalidateQueries({ queryKey: summaryKey });
  };

  const createModel = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      portalFetch(`/api/clients/${clientId}/retainer/models`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? "Errore");
        return r.json();
      }),
    onSuccess: () => {
      setForm(EMPTY_MODEL);
      setShowForm(false);
      invalidate();
      toast({ title: "Aggiunto al retainer" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Non riuscito", description: e.message }),
  });

  const removeModel = useMutation({
    mutationFn: (id: number) =>
      portalFetch(`/api/clients/${clientId}/retainer/models/${id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); toast({ title: "Rimosso dal retainer" }); },
  });

  const runNow = useMutation({
    mutationFn: () => portalFetch(`/api/clients/${clientId}/retainer/run`, { method: "POST" }).then((r) => r.json()),
    onSuccess: (res: { created: number; skipped: number }) => {
      invalidate();
      toast({
        title: res.created > 0 ? `${res.created} task create` : "Già tutto generato",
        description: res.skipped > 0 ? `${res.skipped} erano già presenti questo mese.` : undefined,
      });
    },
    onError: () => toast({ variant: "destructive", title: "Generazione non riuscita" }),
  });

  const submit = () => {
    if (form.title.trim().length < 2) return;
    createModel.mutate({
      title: form.title.trim(),
      dayOfMonth: Number(form.dayOfMonth) || 1,
      estimatedHours: form.estimatedHours ? Number(form.estimatedHours) : null,
      priority: form.priority,
      categoria: form.categoria.trim() || null,
    });
  };

  const oreIncluse = summary?.oreIncluse ?? null;
  const fatte = summary?.billableHours ?? 0;
  const pct = oreIncluse != null && oreIncluse > 0 ? Math.min(100, (fatte / oreIncluse) * 100) : null;
  const sforato = summary?.oreSforate != null && summary.oreSforate > 0;

  return (
    <div className="space-y-6">
      {/* Hero: la domanda economica, non una fila di numeri */}
      <div className="rounded-xl border border-card-border bg-card p-5">
        {oreIncluse == null ? (
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Non so ancora se questo retainer regge</p>
              <p className="text-sm text-muted-foreground mt-1">
                Mancano il canone mensile e le ore incluse. Compilali nella sezione fatturazione del
                cliente e qui comparirà quanto stai incassando davvero all'ora.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Ore tracciate questo mese: <span className="font-semibold tabular-nums">{fatte}h</span>
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
              {summary?.period}
            </p>
            <h3 className="text-2xl md:text-3xl font-bold tracking-tight mt-1 leading-tight">
              {sforato ? (
                <>Hai sforato di <span className="text-amber-600 tabular-nums">{summary?.oreSforate}h</span></>
              ) : (
                <>Dentro il monte ore: <span className="text-emerald-600 tabular-nums">{fatte}</span>
                  <span className="text-muted-foreground">/{oreIncluse}h</span></>
              )}
            </h3>
            <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", sforato ? "bg-amber-500" : "bg-emerald-500")}
                style={{ width: `${pct ?? 0}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {summary?.tariffaEffettiva != null && (
                <>Stai incassando <span className="font-semibold text-foreground">{summary.tariffaEffettiva} €/h</span> reali</>
              )}
              {summary?.nonBillableHours ? ` · ${summary.nonBillableHours}h non fatturabili escluse` : ""}
              {summary?.taskTotali ? ` · ${summary.taskFatte}/${summary.taskTotali} task del mese fatte` : ""}
            </p>
          </>
        )}
      </div>

      {/* I modelli: cosa si rifà ogni mese */}
      <div className="rounded-xl border border-card-border bg-card p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Repeat size={15} className="text-primary" /> Ogni mese si rifà
          </h3>
          <div className="flex items-center gap-2">
            {models.length > 0 && (
              <button
                onClick={() => runNow.mutate()}
                disabled={runNow.isPending}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-input hover:bg-muted disabled:opacity-50"
                title="Crea subito le task di questo mese, senza aspettare il 1°"
              >
                {runNow.isPending ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                Genera ora
              </button>
            )}
            <button
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:opacity-90"
            >
              <Plus size={13} /> Aggiungi
            </button>
          </div>
        </div>

        {showForm && (
          <div className="mb-4 rounded-lg border border-card-border p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Cosa si fa *</label>
              <input
                autoFocus
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Es. Piano editoriale del mese"
                className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background"
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Giorno del mese</label>
              <input
                type="number" min={1} max={28}
                value={form.dayOfMonth}
                onChange={(e) => setForm((f) => ({ ...f, dayOfMonth: Number(e.target.value) }))}
                className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Max 28: il 29 non esiste a febbraio.</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Ore stimate</label>
              <input
                type="number" min={1}
                value={form.estimatedHours}
                onChange={(e) => setForm((f) => ({ ...f, estimatedHours: e.target.value }))}
                placeholder="—"
                className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background"
              />
            </div>
            <div className="sm:col-span-2 flex gap-2">
              <button
                onClick={submit}
                disabled={createModel.isPending || form.title.trim().length < 2}
                className="px-3 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50"
              >
                {createModel.isPending ? "Salvo…" : "Aggiungi"}
              </button>
              <button
                onClick={() => { setShowForm(false); setForm(EMPTY_MODEL); }}
                className="px-3 py-2 text-sm rounded-lg bg-secondary text-secondary-foreground"
              >
                Annulla
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Caricamento…</p>
        ) : models.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Niente di ricorrente per questo cliente.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Aggiungi qui il lavoro che rifai ogni mese (PED, report, programmazione):
              il 1° del mese le task nascono da sole.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-card-border/70">
            {models.map((m) => (
              <li key={m.id} className="py-2.5 flex items-center gap-3">
                <span className="shrink-0 w-9 h-9 rounded-lg bg-primary/10 text-primary flex flex-col items-center justify-center leading-none">
                  <span className="text-[9px] uppercase opacity-70">giorno</span>
                  <span className="text-sm font-bold tabular-nums">{m.dayOfMonth}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium truncate", !m.active && "text-muted-foreground line-through")}>
                    {m.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {m.estimatedHours ? `${m.estimatedHours}h stimate` : "Ore non stimate"}
                    {m.categoria ? ` · ${m.categoria}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => { if (confirm(`Togliere "${m.title}" dal retainer?`)) removeModel.mutate(m.id); }}
                  className="p-1.5 text-muted-foreground hover:text-destructive shrink-0"
                  title="Togli dal retainer (le task già create restano)"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
