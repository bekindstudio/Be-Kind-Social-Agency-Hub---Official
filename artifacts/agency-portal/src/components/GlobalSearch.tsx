import { useState, useEffect, useRef, useCallback } from "react";
import { portalFetch } from "@workspace/api-client-react";
import { Search, X, Users, FolderKanban, CheckSquare, FileText, ScrollText } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

type SearchResults = {
  clients: Array<{ id: number; name: string; company: string | null }>;
  projects: Array<{ id: number; name: string; status: string }>;
  tasks: Array<{ id: number; title: string; status: string }>;
  quotes: Array<{ id: number; name: string; status: string }>;
  contracts: Array<{ id: number; numero: string; oggetto: string }>;
};

const EMPTY: SearchResults = { clients: [], projects: [], tasks: [], quotes: [], contracts: [] };

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null!);
  const containerRef = useRef<HTMLDivElement>(null!);
  const [, navigate] = useLocation();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null!);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(EMPTY); return; }
    setLoading(true);
    try {
      const res = await portalFetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) setResults(await res.json());
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 250);
    return () => clearTimeout(debounceRef.current);
  }, [query, doSearch]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("mousedown", handleClick); document.removeEventListener("keydown", handleKey); };
  }, []);

  const go = (path: string) => { navigate(path); setOpen(false); setQuery(""); };

  const total = results.clients.length + results.projects.length + results.tasks.length + results.quotes.length + results.contracts.length;

  const statusLabel = (s: string) => {
    const map: Record<string, string> = { todo: "Da fare", "in-progress": "In corso", done: "Completato", review: "Revisione", bozza: "Bozza", inviato: "Inviato", accettato: "Accettato", rifiutato: "Rifiutato", firmato: "Firmato", planning: "Pianificazione", active: "Attivo" };
    return map[s] ?? s;
  };

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground bg-muted/50 border border-input rounded-lg hover:bg-muted transition-colors"
      >
        <Search size={13} />
        <span className="hidden sm:inline">Cerca...</span>
        <kbd className="hidden sm:inline ml-2 px-1.5 py-0.5 text-[10px] font-mono bg-background border border-input rounded">Ctrl+K</kbd>
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative z-50">
      <div className="flex items-center gap-2 bg-background border border-input rounded-lg shadow-lg px-3 py-1.5">
        <Search size={14} className="text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          type="text"
          className="w-48 sm:w-72 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
          placeholder="Cerca clienti, progetti, task..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        {query && (
          <button onClick={() => { setQuery(""); inputRef.current?.focus(); }} className="text-muted-foreground hover:text-foreground">
            <X size={14} />
          </button>
        )}
      </div>

      {query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-card-border rounded-xl shadow-xl max-h-[400px] overflow-y-auto">
          {loading && <div className="px-4 py-3 text-xs text-muted-foreground">Ricerca...</div>}
          {!loading && total === 0 && <div className="px-4 py-3 text-xs text-muted-foreground">Nessun risultato</div>}

          {results.clients.length > 0 && (
            <ResultGroup icon={Users} label="Clienti">
              {results.clients.map((c) => (
                <ResultItem key={c.id} onClick={() => go(`/clients/${c.id}`)} title={c.name} subtitle={c.company ?? ""} />
              ))}
            </ResultGroup>
          )}
          {results.projects.length > 0 && (
            <ResultGroup icon={FolderKanban} label="Progetti">
              {results.projects.map((p) => (
                <ResultItem key={p.id} onClick={() => go(`/projects/${p.id}`)} title={p.name} subtitle={statusLabel(p.status)} />
              ))}
            </ResultGroup>
          )}
          {results.tasks.length > 0 && (
            <ResultGroup icon={CheckSquare} label="Task">
              {results.tasks.map((t) => (
                <ResultItem key={t.id} onClick={() => go("/tasks")} title={t.title} subtitle={statusLabel(t.status)} />
              ))}
            </ResultGroup>
          )}
          {results.quotes.length > 0 && (
            <ResultGroup icon={FileText} label="Preventivi">
              {results.quotes.map((q) => (
                <ResultItem key={q.id} onClick={() => go("/quotes")} title={q.name} subtitle={statusLabel(q.status)} />
              ))}
            </ResultGroup>
          )}
          {results.contracts.length > 0 && (
            <ResultGroup icon={ScrollText} label="Contratti">
              {results.contracts.map((c) => (
                <ResultItem key={c.id} onClick={() => go("/contracts")} title={c.numero} subtitle={c.oggetto} />
              ))}
            </ResultGroup>
          )}
        </div>
      )}
    </div>
  );
}

function ResultGroup({ icon: Icon, label, children }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border last:border-b-0">
      <div className="flex items-center gap-2 px-4 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
        <Icon size={12} /> {label}
      </div>
      {children}
    </div>
  );
}

function ResultItem({ onClick, title, subtitle }: { onClick: () => void; title: string; subtitle: string }) {
  return (
    <button onClick={onClick} className="w-full text-left px-4 py-2 hover:bg-muted/50 transition-colors flex items-center justify-between">
      <span className="text-sm font-medium truncate">{title}</span>
      {subtitle && <span className="text-[11px] text-muted-foreground ml-2 shrink-0">{subtitle}</span>}
    </button>
  );
}
