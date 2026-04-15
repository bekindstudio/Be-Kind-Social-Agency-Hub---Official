import { CalendarRange, Download, FileBarChart2, Wand2 } from "lucide-react";
import type { ReportSectionFlags } from "@/components/tools/reports/ReportPreview";

export function ReportFilters({
  state,
  setState,
  labels,
  actions,
  historyNode,
}: {
  state: {
    month: string;
    includeCompetitors: boolean;
    sections: ReportSectionFlags;
    introMessage: string;
    nextGoals: string;
    strategicNotes: string;
    isGeneratingReport: boolean;
    isExporting: boolean;
  };
  setState: {
    setMonth: (value: string) => void;
    setIncludeCompetitors: (value: boolean) => void;
    setSections: (updater: (prev: ReportSectionFlags) => ReportSectionFlags) => void;
    setIntroMessage: (value: string) => void;
    setNextGoals: (value: string) => void;
    setStrategicNotes: (value: string) => void;
  };
  labels: {
    sectionLabels: Record<keyof ReportSectionFlags, string>;
    quickPresets: readonly { id: string; label: string }[];
  };
  actions: {
    onApplyPreset: (presetId: string) => void;
    onSetSectionsPreset: (mode: "full" | "essential") => void;
    onGeneratePreview: () => void;
    onExport: () => void;
  };
  historyNode: React.ReactNode;
}) {
  return (
    <aside className="rounded-2xl border border-card-border bg-card p-4 md:p-5 h-fit xl:sticky xl:top-3 space-y-5 shadow-sm">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FileBarChart2 size={18} className="text-emerald-600" />
          Configurazione report
        </h2>
        <p className="text-sm text-muted-foreground">Personalizza contenuti, blocchi e testi strategici prima dell'export.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">Periodo</span>
          <div className="relative mt-1">
            <CalendarRange size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="month"
              value={state.month}
              onChange={(e) => setState.setMonth(e.target.value)}
              className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2"
            />
          </div>
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 mt-5 text-sm">
          <input type="checkbox" checked={state.includeCompetitors} onChange={(e) => setState.setIncludeCompetitors(e.target.checked)} />
          Includi competitors
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Blocchi nel report</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => actions.onSetSectionsPreset("full")} className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-muted transition-colors">Completo</button>
          <button type="button" onClick={() => actions.onSetSectionsPreset("essential")} className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-muted transition-colors">Essenziale</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(state.sections) as Array<keyof ReportSectionFlags>).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setState.setSections((prev) => ({ ...prev, [key]: !prev[key] }))}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                state.sections[key]
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              {labels.sectionLabels[key]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Preset rapidi</p>
        <div className="flex flex-wrap gap-2">
          {labels.quickPresets.map((preset) => (
            <button key={preset.id} type="button" onClick={() => actions.onApplyPreset(preset.id)} className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors">
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <label className="block text-sm">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">Messaggio introduttivo</span>
        <textarea value={state.introMessage} onChange={(e) => setState.setIntroMessage(e.target.value)} rows={4} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 resize-none" />
      </label>

      <label className="block text-sm">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">Obiettivi prossimo mese</span>
        <textarea value={state.nextGoals} onChange={(e) => setState.setNextGoals(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 resize-none" />
      </label>

      <label className="block text-sm">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">Note strategiche</span>
        <textarea value={state.strategicNotes} onChange={(e) => setState.setStrategicNotes(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 resize-none" />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button onClick={actions.onGeneratePreview} disabled={state.isGeneratingReport} className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium disabled:opacity-60 transition-all hover:-translate-y-0.5">
          <Wand2 size={15} />
          {state.isGeneratingReport ? "Aggiorno..." : "Genera anteprima"}
        </button>
        <button onClick={actions.onExport} disabled={state.isExporting} className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-60 hover:bg-emerald-700 transition-all hover:-translate-y-0.5">
          <Download size={15} />
          {state.isExporting ? "PDF in corso..." : "Esporta PDF"}
        </button>
      </div>

      {historyNode}
    </aside>
  );
}
