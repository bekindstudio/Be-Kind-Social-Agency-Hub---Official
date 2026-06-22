import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Plus, ChevronDown } from "lucide-react";

// Menu "Nuovo" globale (Wave BP): spostato dall'header della Dashboard alla
// topbar, così la creazione rapida è disponibile su ogni pagina.
const ITEMS: [string, string][] = [
  ["Nuovo progetto", "/projects"],
  ["Nuova task", "/tasks"],
  ["Nuovo cliente", "/clients"],
  ["Nuovo preventivo", "/quotes"],
  ["Nuovo messaggio", "/chat"],
];

export function QuickCreate() {
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="inline-flex items-center gap-1 rounded-lg bg-primary px-2 sm:px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
        aria-label="Nuovo"
      >
        <Plus size={14} /> <span className="hidden sm:inline">Nuovo</span> <ChevronDown size={14} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-card border border-card-border rounded-lg shadow-lg p-1 z-30">
          {ITEMS.map(([label, href]) => (
            <button
              key={label}
              type="button"
              onClick={() => { setOpen(false); navigate(href); }}
              className="w-full text-left px-2 py-1.5 rounded hover:bg-muted text-sm"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
