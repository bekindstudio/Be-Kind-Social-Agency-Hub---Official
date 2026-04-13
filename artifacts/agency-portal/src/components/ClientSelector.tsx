import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClientContext } from "@/context/ClientContext";
import type { Client } from "@/types/client";
import { portalFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

function getStatusLabel(status: Client["status"]): string {
  if (status === "active") return "Attivo";
  if (status === "paused") return "In pausa";
  return "Archiviato";
}

function getStatusClasses(status: Client["status"]): string {
  if (status === "active") return "bg-emerald-100 text-emerald-700";
  if (status === "paused") return "bg-amber-100 text-amber-700";
  return "bg-slate-200 text-slate-700";
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CL";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function ClientSelector() {
  const { clients, activeClient, setActiveClient, createClient, importClients } = useClientContext();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [color, setColor] = useState("#4F46E5");
  const [saving, setSaving] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  const ordered = useMemo(() => {
    if (!activeClient) return clients;
    return [activeClient, ...clients.filter((c) => c.id !== activeClient.id)];
  }, [clients, activeClient]);

  const handleCreate = async () => {
    if (!name.trim() || !industry.trim()) return;
    if (saving) return;
    setSaving(true);
    const nextName = name.trim();
    const nextIndustry = industry.trim();
    const nextColor = color;
    createClient({ name, industry, color });
    setName("");
    setIndustry("");
    setColor("#4F46E5");
    setShowCreate(false);
    setOpen(false);
    try {
      const response = await portalFetch("/api/clients", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nextName,
          company: nextName,
          settore: nextIndustry,
          color: nextColor,
          brandColor: nextColor,
        }),
      });
      if (!response.ok) throw new Error("save_failed");
      const data = await response.json();
      importClients([
        {
          id: String(data.id),
          name: String(data.name ?? nextName),
          logo: data.logoUrl ?? undefined,
          color: data.brandColor ?? data.color ?? nextColor,
          industry: String(data.settore ?? nextIndustry),
          status: "active",
          createdAt: String(data.createdAt ?? new Date().toISOString()),
        },
      ]);
    } catch {
      toast({
        variant: "destructive",
        title: "Cliente creato solo localmente",
        description: "Il backend non era raggiungibile. Riprova quando la connessione è stabile.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-2.5 py-1.5 hover:bg-muted transition-colors"
      >
        <span
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
          style={{ backgroundColor: activeClient?.color ?? "#4F46E5" }}
        >
          {activeClient ? getInitials(activeClient.name) : "CL"}
        </span>
        <span className="hidden sm:block text-xs font-medium max-w-[150px] truncate">
          {activeClient?.name ?? "Seleziona cliente"}
        </span>
        <ChevronDown size={14} className={cn("text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-[320px] rounded-xl border border-border bg-card p-2 shadow-xl">
          <div className="max-h-72 overflow-y-auto pr-1">
            {ordered.map((client) => {
              const selected = activeClient?.id === client.id;
              return (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => {
                    setActiveClient(client);
                    setOpen(false);
                  }}
                  className={cn(
                    "mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors",
                    selected ? "bg-primary/10" : "hover:bg-muted",
                  )}
                >
                  <span
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                    style={{ backgroundColor: client.color ?? "#4F46E5" }}
                  >
                    {getInitials(client.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{client.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{client.industry}</p>
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", getStatusClasses(client.status))}>
                    {getStatusLabel(client.status)}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-input px-2 py-2 text-xs font-semibold text-primary hover:bg-primary/5"
          >
            <Plus size={13} />
            Nuovo cliente
          </button>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Nuovo cliente</h3>
              <button type="button" onClick={() => setShowCreate(false)} className="rounded p-1 text-muted-foreground hover:bg-muted">
                <X size={14} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Nome</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Settore</label>
                <input
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Colore identificativo</label>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="mt-1 h-9 w-16 rounded border border-input bg-background"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border border-input px-3 py-2 text-xs font-medium">
                Annulla
              </button>
              <button type="button" onClick={() => void handleCreate()} disabled={saving} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60">
                {saving ? "Salvataggio..." : "Crea cliente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
