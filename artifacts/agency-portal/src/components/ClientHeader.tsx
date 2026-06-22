import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useClientContext } from "@/context/ClientContext";

function statusLabel(status: "active" | "paused" | "archived"): string {
  if (status === "active") return "Attivo";
  if (status === "paused") return "In pausa";
  return "Archiviato";
}

// Palette semantica soft, coerente con lib/utils (Wave BO).
function statusClass(status: "active" | "paused" | "archived"): string {
  if (status === "active") return "bg-emerald-50 text-emerald-700";
  if (status === "paused") return "bg-amber-50 text-amber-700";
  return "bg-muted text-muted-foreground";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CL";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function ClientAvatar({ name, color, logo }: { name: string; color?: string; logo?: string }) {
  return (
    <span
      className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-semibold text-white"
      style={{ backgroundColor: color ?? "hsl(var(--primary))" }}
    >
      <span>{initials(name)}</span>
      {logo && (
        <img
          src={logo}
          alt={name}
          className="absolute inset-0 h-full w-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      )}
    </span>
  );
}

// Barra cliente compatta (Wave BO): avatar + nome + stato + 1 CTA, su una sola
// riga anche su mobile. Le metriche brief/post sono state tolte (rumore) — il
// dettaglio sta nella pagina Brief, raggiungibile dal pulsante.
export function ClientHeader() {
  const [, navigate] = useLocation();
  const { activeClient } = useClientContext();

  if (!activeClient) {
    return (
      <div className="border-b border-border bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
        Nessun cliente selezionato: scegli un cliente per abilitare i tool contestuali.
      </div>
    );
  }

  return (
    <div className="border-b border-border bg-card/40 px-4 py-2.5">
      <div className="flex items-center gap-3">
        <ClientAvatar name={activeClient.name} color={activeClient.color} logo={activeClient.logo} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{activeClient.name}</p>
          <p className="truncate text-xs text-muted-foreground">{activeClient.industry}</p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", statusClass(activeClient.status))}>
          {statusLabel(activeClient.status)}
        </span>
        <button
          type="button"
          onClick={() => navigate("/tools/brief")}
          className="ml-auto shrink-0 rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted"
        >
          Vai al brief
        </button>
      </div>
    </div>
  );
}
