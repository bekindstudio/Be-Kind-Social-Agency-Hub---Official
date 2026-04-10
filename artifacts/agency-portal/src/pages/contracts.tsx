import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/layout/Layout";
import {
  FileSignature,
  Plus,
  Copy,
  Trash2,
  Pencil,
  LayoutTemplate,
  History,
  Euro,
  CalendarClock,
  Send,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { SERVICE_LABELS, SERVICE_SLUGS } from "@/lib/contracts-shared";

const BASE = "/api";

type ContractDoc = {
  id: string;
  contractNumber: string;
  templateId: number | null;
  clientName: string;
  clientEmail: string | null;
  clientVat: string | null;
  clientAddress: string | null;
  serviceType: string;
  content: string;
  status: string;
  value: string | null;
  startDate: string | null;
  endDate: string | null;
  signedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type Stats = {
  activeCount: number;
  signedValueTotal: number;
  expiring30Count: number;
  awaitingSignatureCount: number;
};

const STATO_STYLES: Record<string, string> = {
  bozza: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  inviato: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  firmato: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  scaduto: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
};

const STATO_LABELS: Record<string, string> = {
  bozza: "Bozza",
  inviato: "Inviato",
  firmato: "Firmato",
  scaduto: "Scaduto",
};

function fmtEur(n: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);
}

function serviceTitle(slug: string) {
  return (SERVICE_LABELS as Record<string, { title: string }>)[slug]?.title ?? slug;
}

export default function Contracts() {
  const qc = useQueryClient();
  const [statusF, setStatusF] = useState<string>("tutti");
  const [serviceF, setServiceF] = useState<string>("tutti");
  const [monthF, setMonthF] = useState<string>("");

  const statsQuery = useQuery({
    queryKey: ["contract-documents-stats"],
    queryFn: (): Promise<Stats> =>
      fetch(`${BASE}/contract-documents/stats`).then((r) => r.json()),
  });

  const listQuery = useQuery({
    queryKey: ["contract-documents", statusF, serviceF, monthF],
    queryFn: (): Promise<ContractDoc[]> => {
      const p = new URLSearchParams();
      if (statusF !== "tutti") p.set("status", statusF);
      if (serviceF !== "tutti") p.set("serviceType", serviceF);
      if (monthF) p.set("month", monthF);
      const q = p.toString();
      return fetch(`${BASE}/contract-documents${q ? `?${q}` : ""}`).then((r) => r.json());
    },
  });

  const duplicate = useMutation({
    mutationFn: (id: string) =>
      fetch(`${BASE}/contract-documents/${id}/duplicate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract-documents"] });
      qc.invalidateQueries({ queryKey: ["contract-documents-stats"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => fetch(`${BASE}/contract-documents/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract-documents"] });
      qc.invalidateQueries({ queryKey: ["contract-documents-stats"] });
    },
  });

  const rows = Array.isArray(listQuery.data) ? listQuery.data : [];
  const stats = statsQuery.data;

  const monthOptions = useMemo(() => {
    const opts: string[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      opts.push(v);
    }
    return opts;
  }, []);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
              <FileSignature className="h-7 w-7 text-primary" />
              Contratti
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Genera, personalizza ed esporta contratti per servizio.{" "}
              <Link href="/contracts/classic" className="text-primary hover:underline inline-flex items-center gap-1">
                <History className="h-3.5 w-3.5" />
                Versione classica (legata ai clienti CRM)
              </Link>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/contracts/templates"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-input bg-background text-sm font-medium hover:bg-muted/60 transition-colors"
            >
              <LayoutTemplate className="h-4 w-4" />
              Template
            </Link>
            <Link
              href="/contracts/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" />
              Nuovo contratto
            </Link>
          </div>
        </div>

        {/* Statistiche */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-card-border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contratti attivi</p>
            <p className="text-2xl font-semibold mt-1 tabular-nums">{stats?.activeCount ?? "—"}</p>
            <p className="text-[11px] text-muted-foreground mt-1">Stato firmato e non scaduti</p>
          </div>
          <div className="rounded-xl border border-card-border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Euro className="h-3 w-3" /> Valore firmati
            </p>
            <p className="text-2xl font-semibold mt-1 tabular-nums">
              {stats ? fmtEur(stats.signedValueTotal) : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-card-border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <CalendarClock className="h-3 w-3" /> In scadenza (30 gg)
            </p>
            <p className="text-2xl font-semibold mt-1 tabular-nums">{stats?.expiring30Count ?? "—"}</p>
          </div>
          <div className="rounded-xl border border-card-border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Send className="h-3 w-3" /> In attesa di firma
            </p>
            <p className="text-2xl font-semibold mt-1 tabular-nums">{stats?.awaitingSignatureCount ?? "—"}</p>
            <p className="text-[11px] text-muted-foreground mt-1">Stato &quot;Inviato&quot;</p>
          </div>
        </div>

        {/* Filtri */}
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-card-border bg-muted/20 p-4">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Stato</label>
            <select
              className="text-sm border border-input rounded-lg px-3 py-2 bg-background min-w-[140px]"
              value={statusF}
              onChange={(e) => setStatusF(e.target.value)}
            >
              <option value="tutti">Tutti</option>
              <option value="bozza">Bozza</option>
              <option value="inviato">Inviato</option>
              <option value="firmato">Firmato</option>
              <option value="scaduto">Scaduto</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Tipo servizio</label>
            <select
              className="text-sm border border-input rounded-lg px-3 py-2 bg-background min-w-[200px]"
              value={serviceF}
              onChange={(e) => setServiceF(e.target.value)}
            >
              <option value="tutti">Tutti</option>
              {SERVICE_SLUGS.map((s) => (
                <option key={s} value={s}>
                  {SERVICE_LABELS[s].title}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Mese (creazione)</label>
            <select
              className="text-sm border border-input rounded-lg px-3 py-2 bg-background min-w-[160px]"
              value={monthF}
              onChange={(e) => setMonthF(e.target.value)}
            >
              <option value="">Tutti</option>
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabella */}
        <div className="rounded-xl border border-card-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border bg-muted/30 text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">Cliente</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Servizio</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Stato</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Valore</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Inizio</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-right">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {listQuery.isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                      Caricamento…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                      Nessun contratto.{" "}
                      <Link href="/contracts/new" className="text-primary font-medium hover:underline">
                        Crea il primo
                      </Link>
                    </td>
                  </tr>
                ) : (
                  rows.map((c) => (
                    <tr key={c.id} className="border-b border-card-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{c.clientName}</div>
                        <div className="text-xs text-muted-foreground font-mono">{c.contractNumber}</div>
                      </td>
                      <td className="px-4 py-3 text-foreground">{serviceTitle(c.serviceType)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                            STATO_STYLES[c.status] ?? "bg-muted text-muted-foreground",
                          )}
                        >
                          {STATO_LABELS[c.status] ?? c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {c.value != null && c.value !== "" ? fmtEur(parseFloat(c.value)) : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {c.startDate ? formatDate(c.startDate) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1 justify-end">
                          <Link
                            href={`/contracts/new?id=${c.id}`}
                            className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                            title="Modifica"
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                          <button
                            type="button"
                            className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-colors disabled:opacity-50"
                            title="Duplica"
                            disabled={duplicate.isPending}
                            onClick={() => duplicate.mutate(c.id)}
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                            title="Elimina"
                            disabled={remove.isPending}
                            onClick={() => {
                              if (!confirm(`Eliminare il contratto ${c.contractNumber}?`)) return;
                              remove.mutate(c.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
