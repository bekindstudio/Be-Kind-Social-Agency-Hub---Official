import { useRef, useState } from "react";
import { GripVertical, Plus, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskRow } from "@/types/client";

export type ChecklistItem = {
  id: string;
  testo: string;
  completato: boolean;
  gruppo: string;
};

export const CATEGORIE = [
  "Onboarding Nuovo Cliente",
  "Piano Editoriale Mensile",
  "Setup Business Manager Meta",
  "Campagna ADV Meta",
  "Campagna ADV Google",
  "Report Cliente",
  "Personalizzata",
] as const;

export const MESI = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
export const PACCHETTI = [
  { value: "4", label: "Base – 4 contenuti/mese" },
  { value: "8", label: "Standard – 8 contenuti/mese" },
  { value: "12", label: "Premium – 12 contenuti/mese" },
];
export const TIPI_REPORT = ["Mensile", "Trimestrale", "Semestrale"];

export const CATEGORIA_COLORS: Record<string, string> = {
  "Onboarding Nuovo Cliente": "bg-violet-100 text-violet-700",
  "Piano Editoriale Mensile": "bg-blue-100 text-blue-700",
  "Setup Business Manager Meta": "bg-orange-100 text-orange-700",
  "Campagna ADV Meta": "bg-blue-100 text-blue-800",
  "Campagna ADV Google": "bg-green-100 text-green-700",
  "Report Cliente": "bg-amber-100 text-amber-700",
  "Personalizzata": "bg-gray-100 text-gray-600",
};

function uid() { return Math.random().toString(36).slice(2, 9); }

export function createChecklistItem(testo: string, gruppo = ""): ChecklistItem {
  return { id: uid(), testo, completato: false, gruppo };
}

function checklistOnboarding(): ChecklistItem[] {
  return [
    { id: uid(), testo: "Analisi gratuita", completato: false, gruppo: "" },
    { id: uid(), testo: "Meeting conoscitivo", completato: false, gruppo: "" },
    { id: uid(), testo: "Preventivo con portfolio", completato: false, gruppo: "" },
    { id: uid(), testo: "Contratto firmato", completato: false, gruppo: "" },
    { id: uid(), testo: "Drive condiviso creato (template)", completato: false, gruppo: "" },
    { id: uid(), testo: "Briefing con domande e obiettivi (Excel)", completato: false, gruppo: "" },
    { id: uid(), testo: "Facebook", completato: false, gruppo: "Credenziali ricevute o pagine create" },
    { id: uid(), testo: "Instagram", completato: false, gruppo: "Credenziali ricevute o pagine create" },
    { id: uid(), testo: "LinkedIn", completato: false, gruppo: "Credenziali ricevute o pagine create" },
    { id: uid(), testo: "TikTok", completato: false, gruppo: "Credenziali ricevute o pagine create" },
    { id: uid(), testo: "YouTube", completato: false, gruppo: "Credenziali ricevute o pagine create" },
    { id: uid(), testo: "Sito Web", completato: false, gruppo: "Credenziali ricevute o pagine create" },
    { id: uid(), testo: "Brand Kit Canva creato", completato: false, gruppo: "" },
    { id: uid(), testo: "Ricerca competitors completata", completato: false, gruppo: "" },
  ];
}

function checklistPianoEditoriale(mese: string, pacchetto: string): ChecklistItem[] {
  const n = pacchetto === "4" ? 4 : pacchetto === "12" ? 12 : 8;
  const stories = n * 2;
  const reel = Math.round(n / 2);
  return [
    { id: uid(), testo: `PED ${mese} - Piano editoriale creato`, completato: false, gruppo: "" },
    { id: uid(), testo: "Template Carosello", completato: false, gruppo: "Template grafici creati" },
    { id: uid(), testo: "Template Storia", completato: false, gruppo: "Template grafici creati" },
    { id: uid(), testo: "Template Post IG", completato: false, gruppo: "Template grafici creati" },
    { id: uid(), testo: `Contenuti Foto/Video creati (0 su ${n} post + ${stories} stories + ${reel} reel)`, completato: false, gruppo: "" },
    { id: uid(), testo: `Contenuti grafici creati (0 su ${n})`, completato: false, gruppo: "" },
    { id: uid(), testo: "Programmazione completata", completato: false, gruppo: "" },
    { id: uid(), testo: "Pubblicazioni verificate", completato: false, gruppo: "" },
    { id: uid(), testo: "Approvazione cliente ricevuta", completato: false, gruppo: "" },
  ];
}

function checklistSetupBM(): ChecklistItem[] {
  return [
    { id: uid(), testo: "Business Manager configurato", completato: false, gruppo: "" },
    { id: uid(), testo: "Check collegamento pagine Facebook/Instagram", completato: false, gruppo: "" },
    { id: uid(), testo: "Impostazioni di pagamento configurate", completato: false, gruppo: "" },
    { id: uid(), testo: "Pixel di Meta installato e verificato", completato: false, gruppo: "" },
    { id: uid(), testo: "Google Tag Manager installato", completato: false, gruppo: "" },
    { id: uid(), testo: "Google Analytics collegato e verificato", completato: false, gruppo: "" },
  ];
}

function checklistCampagnaMeta(): ChecklistItem[] {
  return [
    { id: uid(), testo: "Strategia campagna definita", completato: false, gruppo: "" },
    { id: uid(), testo: "Pubblici target creati (Tofu)", completato: false, gruppo: "" },
    { id: uid(), testo: "Pubblici retargeting creati (Bofu)", completato: false, gruppo: "" },
    { id: uid(), testo: "Creatività ads realizzate", completato: false, gruppo: "" },
    { id: uid(), testo: "Copy ads scritto e approvato", completato: false, gruppo: "" },
    { id: uid(), testo: "Campagna configurata su Meta Ads Manager", completato: false, gruppo: "" },
    { id: uid(), testo: "Pixel eventi verificati", completato: false, gruppo: "" },
    { id: uid(), testo: "Campagna attivata", completato: false, gruppo: "" },
    { id: uid(), testo: "Primo check performance (dopo 48h)", completato: false, gruppo: "" },
    { id: uid(), testo: "Ottimizzazione in corso", completato: false, gruppo: "" },
    { id: uid(), testo: "Report risultati", completato: false, gruppo: "" },
  ];
}

function checklistCampagnaGoogle(): ChecklistItem[] {
  return [
    { id: uid(), testo: "Ricerca e analisi parole chiave completata", completato: false, gruppo: "" },
    { id: uid(), testo: "Struttura campagna definita", completato: false, gruppo: "" },
    { id: uid(), testo: "Campagna principale creata", completato: false, gruppo: "" },
    { id: uid(), testo: "Campagna brand creata", completato: false, gruppo: "" },
    { id: uid(), testo: "Campagna competitors creata", completato: false, gruppo: "" },
    { id: uid(), testo: "Annunci scritti e approvati", completato: false, gruppo: "" },
    { id: uid(), testo: "Estensioni annunci configurate", completato: false, gruppo: "" },
    { id: uid(), testo: "Conversioni tracciate con GTM", completato: false, gruppo: "" },
    { id: uid(), testo: "Campagna attivata", completato: false, gruppo: "" },
    { id: uid(), testo: "Check performance iniziale", completato: false, gruppo: "" },
    { id: uid(), testo: "Report risultati", completato: false, gruppo: "" },
  ];
}

function checklistReport(): ChecklistItem[] {
  return [
    { id: uid(), testo: "Dati social raccolti (follower, reach, engagement)", completato: false, gruppo: "" },
    { id: uid(), testo: "Dati Meta Ads raccolti (spesa, risultati, ROAS)", completato: false, gruppo: "" },
    { id: uid(), testo: "Dati Google Ads raccolti (click, conversioni, CPC)", completato: false, gruppo: "" },
    { id: uid(), testo: "Grafici e tabelle preparati", completato: false, gruppo: "" },
    { id: uid(), testo: "Analisi risultati scritta", completato: false, gruppo: "" },
    { id: uid(), testo: "Confronto periodo precedente fatto", completato: false, gruppo: "" },
    { id: uid(), testo: "Raccomandazioni strategiche aggiunte", completato: false, gruppo: "" },
    { id: uid(), testo: "Report formattato e revisionato", completato: false, gruppo: "" },
    { id: uid(), testo: "Report inviato al cliente", completato: false, gruppo: "" },
    { id: uid(), testo: "Meeting di presentazione risultati fatto", completato: false, gruppo: "" },
  ];
}

export function generateChecklist(categoria: string, mese = "", pacchetto = "8"): ChecklistItem[] {
  switch (categoria) {
    case "Onboarding Nuovo Cliente": return checklistOnboarding();
    case "Piano Editoriale Mensile": return checklistPianoEditoriale(mese || "Gennaio", pacchetto || "8");
    case "Setup Business Manager Meta": return checklistSetupBM();
    case "Campagna ADV Meta": return checklistCampagnaMeta();
    case "Campagna ADV Google": return checklistCampagnaGoogle();
    case "Report Cliente": return checklistReport();
    default: return [];
  }
}

export function parseChecklist(json: string): ChecklistItem[] {
  try { return JSON.parse(json) as ChecklistItem[]; } catch { return []; }
}

export function calcProgress(items: ChecklistItem[]) {
  if (items.length === 0) return { done: 0, total: 0, pct: 0 };
  const done = items.filter((item) => item.completato).length;
  return { done, total: items.length, pct: Math.round((done / items.length) * 100) };
}

export function isOverdue(dueDate?: string | null, status?: string): boolean {
  if (!dueDate || status === "done") return false;
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

export function ProgressBar({ pct, className }: { pct: number; className?: string }) {
  const color = pct === 100 ? "bg-emerald-500" : pct >= 50 ? "bg-primary" : "bg-amber-400";
  return (
    <div className={cn("w-full h-1.5 rounded-full bg-muted overflow-hidden", className)}>
      <div className={cn("h-full rounded-full transition-all duration-300", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ChecklistModal({ task, onClose, onToggle }: {
  task: TaskRow;
  onClose: () => void;
  onToggle: (itemId: string) => void;
}) {
  const items = parseChecklist(task.checklistJson);
  const { done, total, pct } = calcProgress(items);

  const groups: Record<string, ChecklistItem[]> = {};
  const ungrouped: ChecklistItem[] = [];
  items.forEach((item) => {
    if (item.gruppo) {
      if (!groups[item.gruppo]) groups[item.gruppo] = [];
      groups[item.gruppo].push(item);
    } else {
      ungrouped.push(item);
    }
  });

  const renderItem = (item: ChecklistItem) => (
    <label key={item.id} className="flex items-start gap-2.5 cursor-pointer group py-1.5 hover:bg-muted/30 rounded px-2 -mx-2">
      <button
        onClick={() => onToggle(item.id)}
        className={cn(
          "mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all",
          item.completato ? "bg-emerald-500 border-emerald-500" : "border-muted-foreground/50 hover:border-primary"
        )}
      >
        {item.completato && <span className="text-white text-[9px] font-bold">✓</span>}
      </button>
      <span className={cn("text-sm leading-tight", item.completato && "line-through text-muted-foreground")}>
        {item.testo}
      </span>
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-card-border">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", CATEGORIA_COLORS[task.categoria ?? ""] ?? "bg-gray-100 text-gray-600")}>
                {task.categoria}
              </span>
              {task.meseRiferimento && (
                <span className="text-xs text-muted-foreground">{task.meseRiferimento}</span>
              )}
            </div>
            <h3 className="font-semibold text-base">{task.title}</h3>
            <div className="mt-2 flex items-center gap-3">
              <ProgressBar pct={pct} className="flex-1" />
              <span className="text-xs font-medium tabular-nums text-muted-foreground whitespace-nowrap">{done}/{total}</span>
              <span className="text-xs font-bold text-primary">{pct}%</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {ungrouped.map(renderItem)}
          {Object.entries(groups).map(([group, groupItems]) => (
            <div key={group}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 mt-3">{group}</p>
              <div className="pl-1">{groupItems.map(renderItem)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ChecklistEditor({ items, onChange }: {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
}) {
  const [newItemText, setNewItemText] = useState("");
  const dragIndexRef = useRef<number | null>(null);
  const groups: Record<string, ChecklistItem[]> = {};
  const ungrouped: ChecklistItem[] = [];
  items.forEach((item) => {
    if (item.gruppo) {
      if (!groups[item.gruppo]) groups[item.gruppo] = [];
      groups[item.gruppo].push(item);
    } else {
      ungrouped.push(item);
    }
  });

  const addItem = () => {
    const text = newItemText.trim();
    if (!text) return;
    onChange([...items, { id: uid(), testo: text, completato: false, gruppo: "" }]);
    setNewItemText("");
  };

  const removeItem = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, testo: string) => {
    onChange(items.map((item) => item.id === id ? { ...item, testo } : item));
  };

  const moveItem = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return;
    const next = [...items];
    const [picked] = next.splice(from, 1);
    next.splice(to, 0, picked);
    onChange(next);
  };

  const renderEditable = (item: ChecklistItem) => {
    const idx = items.findIndex((current) => current.id === item.id);
    return (
      <div
        key={item.id}
        className="flex items-center gap-2 py-1"
        draggable
        onDragStart={() => { dragIndexRef.current = idx; }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => {
          if (dragIndexRef.current != null) moveItem(dragIndexRef.current, idx);
          dragIndexRef.current = null;
        }}
      >
        <GripVertical size={13} className="text-muted-foreground/40 shrink-0" />
        <Square size={14} className="text-muted-foreground/40 shrink-0" />
        <input
          className="flex-1 text-sm border-0 border-b border-transparent focus:border-primary bg-transparent outline-none py-0.5"
          value={item.testo}
          onChange={(e) => updateItem(item.id, e.target.value)}
          placeholder="Voce checklist..."
        />
        <button onClick={() => removeItem(item.id)} className="text-muted-foreground/40 hover:text-destructive shrink-0">
          <X size={12} />
        </button>
      </div>
    );
  };

  return (
    <div className="mt-3 bg-muted/30 rounded-xl p-4 space-y-0.5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Checklist ({items.length} voci)</p>
        <span className="text-[11px] text-muted-foreground">drag & drop per riordinare</span>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <input
          className="flex-1 px-2.5 py-1.5 text-xs border border-input rounded-lg bg-background"
          placeholder="Nuova voce checklist..."
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem();
            }
          }}
        />
        <button onClick={addItem} className="text-xs text-primary hover:underline flex items-center gap-1">
          <Plus size={11} /> Add item
        </button>
      </div>
      {ungrouped.map(renderEditable)}
      {Object.entries(groups).map(([group, groupItems]) => (
        <div key={group}>
          <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wide mt-3 mb-1">{group}</p>
          {groupItems.map(renderEditable)}
        </div>
      ))}
    </div>
  );
}
