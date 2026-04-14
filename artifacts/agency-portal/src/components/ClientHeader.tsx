import { useMemo } from "react";
import { useLocation } from "wouter";
import { cn, formatDate } from "@/lib/utils";
import { useClientContext } from "@/context/ClientContext";
import { getBriefCompletion } from "@/components/tools/brief/briefCompletion";

function statusLabel(status: "active" | "paused" | "archived"): string {
  if (status === "active") return "Attivo";
  if (status === "paused") return "In pausa";
  return "Archiviato";
}

function statusClass(status: "active" | "paused" | "archived"): string {
  if (status === "active") return "bg-emerald-100 text-emerald-700";
  if (status === "paused") return "bg-amber-100 text-amber-700";
  return "bg-slate-200 text-slate-700";
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
      className="relative inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full text-xs font-semibold text-white"
      style={{ backgroundColor: color ?? "#4F46E5" }}
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

export function ClientHeader() {
  const [, navigate] = useLocation();
  const { activeClient, brief, posts } = useClientContext();

  const postsThisMonth = useMemo(() => {
    const now = new Date();
    return posts.filter((post) => {
      const d = new Date(post.scheduledDate);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  }, [posts]);
  const briefCompletion = useMemo(() => getBriefCompletion(brief), [brief]);

  if (!activeClient) {
    return (
      <div className="border-b border-border bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
        Nessun cliente selezionato: scegli un cliente per abilitare i tool contestuali.
      </div>
    );
  }

  return (
    <div className="border-b border-border bg-card/40 px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-3">
        <ClientAvatar name={activeClient.name} color={activeClient.color} logo={activeClient.logo} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{activeClient.name}</p>
          <p className="truncate text-xs text-muted-foreground">{activeClient.industry}</p>
        </div>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", statusClass(activeClient.status))}>
          {statusLabel(activeClient.status)}
        </span>
        <span className="text-xs text-muted-foreground">
          Brief aggiornato: {brief?.updatedAt ? formatDate(brief.updatedAt) : "mai"}
        </span>
        <span className="text-xs text-muted-foreground">Brief: {briefCompletion}% completo</span>
        <span className="text-xs text-muted-foreground">Post questo mese: {postsThisMonth}</span>
        <button
          type="button"
          onClick={() => navigate("/tools/brief")}
          className="ml-auto rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted"
        >
          Vai al brief
        </button>
      </div>
    </div>
  );
}
