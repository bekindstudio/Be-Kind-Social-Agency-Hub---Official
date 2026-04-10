import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { portalFetch } from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";

type TrashRow = {
  id: string;
  tableName: string;
  recordId: string;
  recordLabel: string | null;
  deletedAt: string;
  typeLabel: string;
  typeKind: string;
  retentionDays: number;
  daysRemaining: number;
  progressPct: number;
  isExpiredRetention: boolean;
};

const TABLE_FILTER = [
  { value: "__all__", label: "Tutti i tipi" },
  { value: "clients", label: "Clienti" },
  { value: "contracts", label: "Contratti cliente" },
  { value: "contract_templates", label: "Template contratti" },
  { value: "contract_documents", label: "Contratti (documenti)" },
  { value: "quote_templates", label: "Preventivi" },
  { value: "editorial_plans", label: "Piani editoriali" },
  { value: "editorial_slots", label: "Post / slot" },
  { value: "content_categories", label: "Categorie" },
  { value: "editorial_templates", label: "Template editoriali" },
  { value: "projects", label: "Progetti" },
  { value: "tasks", label: "Task" },
];

export default function TrashPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { isAdmin } = useUserRole();
  const [typeFilter, setTypeFilter] = useState("__all__");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [confirmPermanent, setConfirmPermanent] = useState<TrashRow | null>(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const queryUrl = useMemo(() => {
    const p = new URLSearchParams();
    if (typeFilter && typeFilter !== "__all__") p.set("type", typeFilter);
    if (q.trim()) p.set("q", q.trim());
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    const qs = p.toString();
    return `/api/trash${qs ? `?${qs}` : ""}`;
  }, [typeFilter, q, from, to]);

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ["trash", queryUrl],
    queryFn: async () => {
      const res = await portalFetch(queryUrl);
      if (!res.ok) throw new Error("Errore caricamento cestino");
      return res.json() as Promise<TrashRow[]>;
    },
  });

  const restore = useCallback(
    async (row: TrashRow) => {
      const res = await portalFetch(`/api/trash/${row.id}/restore`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ variant: "destructive", title: "Ripristino non riuscito", description: data?.error ?? "" });
        return;
      }
      toast({ title: "Elemento ripristinato con successo" });
      void qc.invalidateQueries({ queryKey: ["trash"] });
      void qc.invalidateQueries({ queryKey: ["trash-count"] });
      refetch();
    },
    [qc, refetch, toast],
  );

  const permanent = useCallback(
    async (row: TrashRow) => {
      const res = await portalFetch(`/api/trash/${row.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ variant: "destructive", title: "Eliminazione fallita", description: data?.error ?? "" });
        return;
      }
      toast({ title: "Eliminato definitivamente" });
      setConfirmPermanent(null);
      void qc.invalidateQueries({ queryKey: ["trash"] });
      void qc.invalidateQueries({ queryKey: ["trash-count"] });
      refetch();
    },
    [qc, refetch, toast],
  );

  const emptyAll = useCallback(async () => {
    const res = await portalFetch("/api/trash/empty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ variant: "destructive", title: "Operazione negata", description: data?.error ?? "" });
      return;
    }
    const errs = Array.isArray(data.errors) ? (data.errors as string[]) : [];
    toast({
      title: "Cestino svuotato",
      description:
        errs.length > 0
          ? `Alcuni elementi non sono stati eliminati: ${errs.slice(0, 3).join("; ")}`
          : undefined,
    });
    setConfirmEmpty(false);
    void qc.invalidateQueries({ queryKey: ["trash"] });
    void qc.invalidateQueries({ queryKey: ["trash-count"] });
    refetch();
  }, [qc, refetch, toast]);

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Trash2 className="h-7 w-7 text-muted-foreground" />
              Cestino
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {rows.length} element{rows.length === 1 ? "o" : "i"} nel cestino · Eliminazione definitiva automatica dopo{" "}
              {rows[0]?.retentionDays ?? 30} giorni (vedi promemoria API).
            </p>
          </div>
          {isAdmin && (
            <Button
              variant="destructive"
              disabled={rows.length === 0}
              onClick={() => setConfirmEmpty(true)}
            >
              Svuota cestino
            </Button>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-3 flex-wrap">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full lg:w-[220px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              {TABLE_FILTER.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Cerca per nome…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-xs"
          />
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
          <span className="self-center text-muted-foreground text-sm">→</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
          <Button type="button" variant="secondary" onClick={() => refetch()}>
            Aggiorna
          </Button>
        </div>

        <div className="rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">Tipo</th>
                <th className="p-3 font-medium">Nome</th>
                <th className="p-3 font-medium">Eliminato il</th>
                <th className="p-3 font-medium min-w-[140px]">Giorni rimanenti</th>
                <th className="p-3 font-medium text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    Caricamento…
                  </td>
                </tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    Il cestino è vuoto.
                  </td>
                </tr>
              )}
              {!isLoading &&
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-t border-border",
                      row.isExpiredRetention && "bg-destructive/5 text-destructive",
                    )}
                  >
                    <td className="p-3">{row.typeLabel}</td>
                    <td className="p-3 font-medium">{row.recordLabel ?? row.recordId}</td>
                    <td className="p-3 text-muted-foreground whitespace-nowrap">
                      {new Date(row.deletedAt).toLocaleString("it-IT")}
                    </td>
                    <td className="p-3">
                      <div className="space-y-1">
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              row.isExpiredRetention ? "bg-destructive" : "bg-primary/70",
                            )}
                            style={{ width: `${row.progressPct}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {row.daysRemaining <= 0
                            ? "Oltre la soglia di conservazione"
                            : `${row.daysRemaining} giorni alla scadenza eliminazione`}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-right space-x-2 whitespace-nowrap">
                      <Button size="sm" variant="outline" onClick={() => restore(row)}>
                        Ripristina
                      </Button>
                      {isAdmin && (
                        <Button size="sm" variant="destructive" onClick={() => setConfirmPermanent(row)}>
                          Elimina definitivamente
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-muted-foreground">
          Per eliminare automaticamente gli elementi oltre 30 giorni, configura su Supabase un job che chiami{" "}
          <code className="rounded bg-muted px-1">POST /api/trash/purge-expired</code> con header{" "}
          <code className="rounded bg-muted px-1">x-trash-purge-secret</code> uguale a{" "}
          <code className="rounded bg-muted px-1">TRASH_PURGE_SECRET</code> sull&apos;API.
        </p>
      </div>

      <Dialog open={!!confirmPermanent} onOpenChange={() => setConfirmPermanent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminare definitivamente?</DialogTitle>
            <DialogDescription>
              Sei sicuro? Questa azione è irreversibile. L&apos;elemento verrà rimosso permanentemente dal database.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPermanent(null)}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmPermanent && permanent(confirmPermanent)}
            >
              Elimina definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmEmpty} onOpenChange={setConfirmEmpty}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Svuotare il cestino?</DialogTitle>
            <DialogDescription>
              Vuoi eliminare definitivamente tutti i {rows.length} elementi nel cestino? Questa azione non può essere
              annullata.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmEmpty(false)}>
              Annulla
            </Button>
            <Button variant="destructive" onClick={() => emptyAll()}>
              Svuota cestino
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
