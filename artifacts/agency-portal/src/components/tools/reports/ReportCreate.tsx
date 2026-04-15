import { AlertCircle, ChevronLeft, Loader2, Zap } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { cn } from "@/lib/utils";
import type { ReportCreateForm } from "@/types/client";

type ReportCreateView = "list" | "create" | "detail" | "edit";

interface ReportClientOption {
  id: number | string;
  name: string;
  metaPageId?: string | null;
  googleAdsId?: string | null;
}

interface ReportCreateViewModel {
  view: ReportCreateView;
  clientList: ReportClientOption[];
  createForm: ReportCreateForm;
  setCreateForm: (updater: (form: ReportCreateForm) => ReportCreateForm) => void;
  defaultMonth: string;
  defaultQuarter: string;
  now: Date;
  TIPO_LABELS: Record<string, string>;
  getPeriodLabel: (tipo: string, period: string) => string;
  creating: boolean;
  createError: string;
  handleCreate: () => void;
  setView: (view: ReportCreateView) => void;
}

export function ReportCreate({ state }: { state: ReportCreateViewModel }) {
  const {
    view,
    clientList,
    createForm,
    setCreateForm,
    defaultMonth,
    defaultQuarter,
    now,
    TIPO_LABELS,
    getPeriodLabel,
    creating,
    createError,
    handleCreate,
    setView,
  } = state;

  if (view !== "create") return null;

  const selectedClient = clientList.find((client) => String(client.id) === String(createForm.clientId));
  const metaConnected = !!selectedClient?.metaPageId;
  const googleConnected = !!selectedClient?.googleAdsId;
  const autoTitle = createForm.clientId
    ? `Report ${TIPO_LABELS[createForm.tipo] ?? "Mensile"} — ${selectedClient?.name ?? "Cliente"} — ${createForm.tipo === "custom" ? `${createForm.customFrom || "..."}\/${createForm.customTo || "..."}` : getPeriodLabel(createForm.tipo, createForm.period || defaultMonth)}`
    : "";

  return (
    <Layout>
      <div className="p-8 max-w-3xl">
        <button onClick={() => setView("list")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4">
          <ChevronLeft size={16} /> Torna ai report
        </button>

        <h1 className="text-2xl font-bold tracking-tight mb-1">Nuovo Report</h1>
        <p className="text-muted-foreground text-sm mb-6">Compila i dati e genera un report per il cliente</p>

        <div className="space-y-5">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground block mb-1.5">Cliente</label>
            <select value={createForm.clientId} onChange={(e) => setCreateForm((form) => ({ ...form, clientId: e.target.value }))}
              className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">Seleziona un cliente...</option>
              {clientList.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground block mb-1.5">Tipo report</label>
            <div className="grid grid-cols-3 gap-2">
              {(["settimanale", "mensile", "trimestrale", "custom"] as const).map((t) => (
                <button key={t} onClick={() => setCreateForm((form) => ({ ...form, tipo: t, period: t === "mensile" ? defaultMonth : t === "trimestrale" ? defaultQuarter : defaultMonth }))}
                  className={cn("py-2.5 rounded-xl text-sm font-medium border transition-all", createForm.tipo === t ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input hover:border-primary/50")}>
                  {TIPO_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground block mb-1.5">Periodo</label>
            {createForm.tipo === "mensile" && (
              <input type="month" value={createForm.period} onChange={(e) => setCreateForm((form) => ({ ...form, period: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            )}
            {createForm.tipo === "trimestrale" && (
              <select value={createForm.period} onChange={(e) => setCreateForm((form) => ({ ...form, period: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                {[1, 2, 3, 4].map((q) => {
                  const y = now.getFullYear();
                  return <option key={q} value={`${y}-Q${q}`}>Q{q} {y}</option>;
                })}
              </select>
            )}
            {createForm.tipo === "settimanale" && (
              <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">Ultimi 7 giorni (automatico)</p>
            )}
            {createForm.tipo === "custom" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input type="date" value={createForm.customFrom} onChange={(e) => setCreateForm((form) => ({ ...form, customFrom: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                <input type="date" value={createForm.customTo} onChange={(e) => setCreateForm((form) => ({ ...form, customTo: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            )}
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground block mb-1.5">Titolo report</label>
            <input value={createForm.title || autoTitle} onChange={(e) => setCreateForm((form) => ({ ...form, title: e.target.value }))}
              className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          {!!selectedClient && !metaConnected && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 text-sm flex items-center justify-between gap-2">
              <span>Account Meta non collegato — i dati ads non saranno disponibili</span>
              <button onClick={() => (window.location.href = `/clients/${selectedClient.id}`)} className="text-xs font-semibold underline">Collega ora →</button>
            </div>
          )}
          {!!selectedClient && !googleConnected && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 text-sm flex items-center justify-between gap-2">
              <span>Account Google Ads non collegato — i dati ads non saranno disponibili</span>
              <button onClick={() => (window.location.href = `/clients/${selectedClient.id}`)} className="text-xs font-semibold underline">Collega ora →</button>
            </div>
          )}

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground block mb-1.5">
              Riepilogo esecutivo <span className="font-normal text-muted-foreground/60">(opzionale — compilato dall'AI se vuoto)</span>
            </label>
            <textarea value={createForm.riepilogoEsecutivo} onChange={(e) => setCreateForm((form) => ({ ...form, riepilogoEsecutivo: e.target.value }))}
              rows={4} placeholder="Sintesi del periodo, highlights principali..."
              className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground block mb-1.5">Analisi e insights</label>
            <textarea value={createForm.analisiInsights} onChange={(e) => setCreateForm((form) => ({ ...form, analisiInsights: e.target.value }))}
              rows={3} placeholder="Cosa ha funzionato, cosa migliorare..."
              className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground block mb-1.5">Strategia prossimo periodo</label>
            <textarea value={createForm.strategiaProssimoPeriodo} onChange={(e) => setCreateForm((form) => ({ ...form, strategiaProssimoPeriodo: e.target.value }))}
              rows={3} placeholder="Azioni pianificate, obiettivi..."
              className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground block mb-1.5">Note aggiuntive</label>
            <textarea value={createForm.noteAggiuntive} onChange={(e) => setCreateForm((form) => ({ ...form, noteAggiuntive: e.target.value }))}
              rows={2} placeholder="Comunicazioni extra per il cliente..."
              className="w-full px-3 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>

          {createError && (
            <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">
              <AlertCircle size={14} /> {createError}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button onClick={handleCreate} disabled={creating}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50">
              {creating ? <><Loader2 size={14} className="animate-spin" /> Generazione in corso...</> : <><Zap size={14} /> Genera report</>}
            </button>
            <button onClick={() => setView("list")} className="px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground">Annulla</button>
          </div>

          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Zap size={11} /> I dati verranno recuperati dalle API Meta collegate. Se non collegati, i grafici risulteranno vuoti. Il riepilogo esecutivo viene generato dall'AI.
          </p>
        </div>
      </div>
    </Layout>
  );
}
