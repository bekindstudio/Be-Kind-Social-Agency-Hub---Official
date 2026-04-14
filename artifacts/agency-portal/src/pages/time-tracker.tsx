import { useState, useEffect, useCallback, useMemo } from "react";
import { portalFetch } from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { Clock, TrendingUp, DollarSign, Calendar, Plus, X, Trash2, ArrowLeft, Pencil, Save, Download } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useClientContext } from "@/context/ClientContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

const API = "/api";

const ACTIVITY_TYPES = [
  "Strategia e pianificazione",
  "Creazione contenuti",
  "Grafica e design",
  "Copywriting",
  "Gestione campagne ADV",
  "Reportistica",
  "Riunione / Call con cliente",
  "Riunione interna",
  "Revisioni e feedback",
  "Amministrazione",
  "Altro",
];

const COLORS = ["#7a8f5c", "#9bb068", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1"];

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatHours(seconds: number): string {
  return (seconds / 3600).toFixed(1);
}

function toDateKey(input?: string | null): string {
  if (!input) return "";
  return input.slice(0, 10);
}

type PeriodFilter = "today" | "7d" | "30d" | "all";
type SortField = "date" | "client" | "duration";
type SortDir = "asc" | "desc";

interface TimeEntryRow {
  id: number;
  startedAt?: string | null;
  clientName?: string | null;
  projectName?: string | null;
  description?: string | null;
  activityType?: string | null;
  durationSeconds: number;
  isBillable: boolean;
}

export default function TimeTrackerPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { activeClient } = useClientContext();
  const activeClientId = activeClient?.id ? Number(activeClient.id) : NaN;
  const scopedClientId = Number.isFinite(activeClientId) ? activeClientId : null;
  const [stats, setStats] = useState<any>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);

  const [manualClientId, setManualClientId] = useState<number | null>(null);
  const [manualProjectId, setManualProjectId] = useState<number | null>(null);
  const [manualDescription, setManualDescription] = useState("");
  const [manualActivityType, setManualActivityType] = useState("");
  const [manualDate, setManualDate] = useState(new Date().toISOString().slice(0, 10));
  const [manualHours, setManualHours] = useState(1);
  const [manualMinutes, setManualMinutes] = useState(0);
  const [manualBillable, setManualBillable] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("30d");
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [editingDescription, setEditingDescription] = useState("");
  const [editingActivityType, setEditingActivityType] = useState("");
  const [editingMinutes, setEditingMinutes] = useState(0);
  const [editingBillable, setEditingBillable] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedEntryIds, setSelectedEntryIds] = useState<number[]>([]);
  const [deletingBulk, setDeletingBulk] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const qs = scopedClientId != null ? `?clientId=${scopedClientId}` : "";
      const [statsRes, entriesRes] = await Promise.all([
        portalFetch(`${API}/time-tracker/stats${qs}`, { credentials: "include" }),
        portalFetch(`${API}/time-entries${qs}`, { credentials: "include" }),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (entriesRes.ok) setEntries(await entriesRes.json());
    } catch {
      toast({
        title: "Errore caricamento Time Tracker",
        description: "Impossibile caricare statistiche o registrazioni.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [scopedClientId, toast]);

  const loadClientsProjects = useCallback(async () => {
    try {
      const [cRes, pRes] = await Promise.all([
        portalFetch(`${API}/clients`, { credentials: "include" }),
        portalFetch(`${API}/projects${scopedClientId != null ? `?clientId=${scopedClientId}` : ""}`, { credentials: "include" }),
      ]);
      if (cRes.ok) {
        const cData = await cRes.json();
        if (Array.isArray(cData)) setClients(cData);
        else if (Array.isArray((cData as any)?.items)) setClients((cData as any).items);
        else setClients([]);
      }
      if (pRes.ok) setProjects(await pRes.json());
    } catch {
      // Silent fallback: selectors remain usable from already loaded state.
    }
  }, [scopedClientId]);

  useEffect(() => {
    fetchData();
    loadClientsProjects();
  }, [fetchData, loadClientsProjects]);

  useEffect(() => {
    if (scopedClientId != null) {
      setManualClientId(scopedClientId);
      setManualProjectId(null);
    }
  }, [scopedClientId]);

  const handleManualSubmit = useCallback(async () => {
    if (!manualClientId || !manualDescription) return;
    const durationSeconds = (manualHours * 3600) + (manualMinutes * 60);
    if (durationSeconds <= 0) return;

    const startedAt = new Date(`${manualDate}T09:00:00`);
    try {
      const res = await portalFetch(`${API}/time-entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          clientId: manualClientId,
          projectId: manualProjectId,
          description: manualDescription,
          activityType: manualActivityType,
          startedAt: startedAt.toISOString(),
          durationSeconds,
          isBillable: manualBillable,
        }),
      });
      if (res.ok) {
        setShowManualEntry(false);
        setManualDescription("");
        setManualClientId(scopedClientId);
        setManualProjectId(null);
        setManualActivityType("");
        setManualHours(1);
        setManualMinutes(0);
        setManualBillable(true);
        fetchData();
        toast({ title: "Tempo salvato", description: "Registrazione manuale aggiunta correttamente." });
      } else {
        toast({ title: "Salvataggio non riuscito", description: "Controlla i campi e riprova.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Errore salvataggio", description: "Impossibile aggiungere la registrazione.", variant: "destructive" });
    }
  }, [manualClientId, manualProjectId, manualDescription, manualActivityType, manualDate, manualHours, manualMinutes, manualBillable, fetchData, scopedClientId, toast]);

  const handleDeleteEntry = useCallback(async (id: number) => {
    const ok = window.confirm("Eliminare questa registrazione?");
    if (!ok) return;
    try {
      const res = await portalFetch(`${API}/time-entries/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("delete_failed");
      setEntries((prev) => prev.filter((entry) => Number(entry?.id) !== id));
      setSelectedEntryIds((prev) => prev.filter((entryId) => entryId !== id));
      fetchData();
      toast({ title: "Registrazione eliminata" });
    } catch {
      toast({ title: "Eliminazione non riuscita", variant: "destructive" });
    }
  }, [fetchData, toast]);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(field);
    setSortDir(field === "date" ? "desc" : "asc");
  }, [sortField]);

  const projectList = Array.isArray(projects)
    ? projects
    : // @ts-expect-error runtime safety for unknown API shape
      Array.isArray(projects?.items)
      ? // @ts-expect-error runtime safety for unknown API shape
        projects.items
      : projects
        ? [projects]
        : [];

  const filteredProjects = manualClientId
    ? projectList.filter((p: any) => Number(p?.clientId) === manualClientId)
    : projectList;

  const weeklyChartData = stats?.weeklyChart?.map((d: any) => ({
    name: d.day,
    ore: Number((d.seconds / 3600).toFixed(1)),
    fatturabile: Number((d.billable / 3600).toFixed(1)),
  })) ?? [];

  const clientPieData = stats?.clientBreakdown?.map((c: any, i: number) => ({
    name: c.name,
    value: Number((c.seconds / 3600).toFixed(1)),
    color: COLORS[i % COLORS.length],
  })) ?? [];

  const filteredEntries = useMemo(() => {
    const now = new Date();
    const todayKey = toDateKey(now.toISOString());
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const base = entries.filter((entry: TimeEntryRow) => {
      const entryDate = entry?.startedAt ? new Date(entry.startedAt) : null;
      if (!entryDate) return periodFilter === "all";
      if (periodFilter === "all") return true;
      if (periodFilter === "today") return toDateKey(entry.startedAt ?? "") === todayKey;
      if (periodFilter === "7d") return entryDate >= sevenDaysAgo;
      return entryDate >= thirtyDaysAgo;
    });
    const q = searchQuery.trim().toLowerCase();
    const searched = q.length === 0
      ? base
      : base.filter((entry: TimeEntryRow) => {
        const haystack = [
          entry.clientName ?? "",
          entry.projectName ?? "",
          entry.description ?? "",
          entry.activityType ?? "",
          toDateKey(entry.startedAt ?? ""),
        ].join(" ").toLowerCase();
        return haystack.includes(q);
      });
    const sorted = [...searched].sort((a: TimeEntryRow, b: TimeEntryRow) => {
      let cmp = 0;
      if (sortField === "client") {
        cmp = String(a.clientName ?? "").localeCompare(String(b.clientName ?? ""));
      } else if (sortField === "duration") {
        cmp = Number(a.durationSeconds ?? 0) - Number(b.durationSeconds ?? 0);
      } else {
        cmp = String(a.startedAt ?? "").localeCompare(String(b.startedAt ?? ""));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [entries, periodFilter, searchQuery, sortField, sortDir]);

  const periodTotals = useMemo(() => {
    const totalSeconds = filteredEntries.reduce((sum: number, entry: TimeEntryRow) => sum + Number(entry.durationSeconds ?? 0), 0);
    const billableSeconds = filteredEntries
      .filter((entry: TimeEntryRow) => Boolean(entry.isBillable))
      .reduce((sum: number, entry: TimeEntryRow) => sum + Number(entry.durationSeconds ?? 0), 0);
    const nonBillableSeconds = Math.max(0, totalSeconds - billableSeconds);
    return { totalSeconds, billableSeconds, nonBillableSeconds };
  }, [filteredEntries]);

  const visibleEntryIds = useMemo(
    () => filteredEntries.map((entry: TimeEntryRow) => Number(entry.id)).filter((id: number) => Number.isFinite(id)),
    [filteredEntries],
  );
  const allVisibleSelected = visibleEntryIds.length > 0 && visibleEntryIds.every((id: number) => selectedEntryIds.includes(id));

  const toggleEntrySelection = useCallback((id: number) => {
    setSelectedEntryIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const toggleSelectAllVisible = useCallback(() => {
    setSelectedEntryIds((prev) => {
      if (allVisibleSelected) {
        return prev.filter((id) => !visibleEntryIds.includes(id));
      }
      const merged = new Set([...prev, ...visibleEntryIds]);
      return Array.from(merged);
    });
  }, [allVisibleSelected, visibleEntryIds]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedEntryIds.length === 0) return;
    const ok = window.confirm(`Eliminare ${selectedEntryIds.length} registrazioni selezionate?`);
    if (!ok) return;
    try {
      setDeletingBulk(true);
      const results = await Promise.all(
        selectedEntryIds.map(async (id) => {
          const res = await portalFetch(`${API}/time-entries/${id}`, { method: "DELETE", credentials: "include" });
          return { id, ok: res.ok };
        }),
      );
      const deletedIds = results.filter((r) => r.ok).map((r) => r.id);
      const failedIds = results.filter((r) => !r.ok).map((r) => r.id);
      if (deletedIds.length > 0) {
        setEntries((prev) => prev.filter((entry) => !deletedIds.includes(Number(entry?.id))));
      }
      setSelectedEntryIds(failedIds);
      fetchData();
      if (failedIds.length > 0) {
        toast({
          title: "Eliminazione parziale",
          description: `${deletedIds.length} eliminate, ${failedIds.length} non eliminate.`,
          variant: "destructive",
        });
      } else {
        toast({ title: "Registrazioni eliminate", description: `${deletedIds.length} elementi eliminati.` });
      }
    } catch {
      toast({ title: "Eliminazione bulk non riuscita", variant: "destructive" });
    } finally {
      setDeletingBulk(false);
    }
  }, [selectedEntryIds, fetchData, toast]);

  const beginEditEntry = useCallback((entry: TimeEntryRow) => {
    setEditingEntryId(Number(entry.id));
    setEditingDescription(String(entry.description ?? ""));
    setEditingActivityType(String(entry.activityType ?? ""));
    setEditingMinutes(Math.max(1, Math.round(Number(entry.durationSeconds ?? 0) / 60)));
    setEditingBillable(Boolean(entry.isBillable));
  }, []);

  const cancelEditEntry = useCallback(() => {
    setEditingEntryId(null);
    setEditingDescription("");
    setEditingActivityType("");
    setEditingMinutes(0);
    setEditingBillable(true);
  }, []);

  const saveEditedEntry = useCallback(async (id: number) => {
    if (editingMinutes <= 0) {
      toast({ title: "Durata non valida", description: "Inserisci almeno 1 minuto.", variant: "destructive" });
      return;
    }
    try {
      setSavingEdit(true);
      const res = await portalFetch(`${API}/time-entries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          description: editingDescription.trim() || null,
          activityType: editingActivityType || null,
          isBillable: editingBillable,
          durationSeconds: Math.round(editingMinutes * 60),
        }),
      });
      if (!res.ok) throw new Error("update_failed");
      setEntries((prev) => prev.map((entry) => {
        if (Number(entry?.id) !== id) return entry;
        return {
          ...entry,
          description: editingDescription.trim() || null,
          activityType: editingActivityType || null,
          isBillable: editingBillable,
          durationSeconds: Math.round(editingMinutes * 60),
        };
      }));
      cancelEditEntry();
      fetchData();
      toast({ title: "Registrazione aggiornata" });
    } catch {
      toast({ title: "Modifica non riuscita", variant: "destructive" });
    } finally {
      setSavingEdit(false);
    }
  }, [editingMinutes, editingDescription, editingActivityType, editingBillable, fetchData, cancelEditEntry, toast]);

  const exportCsv = useCallback(() => {
    if (filteredEntries.length === 0) {
      toast({ title: "Nessun dato da esportare", variant: "destructive" });
      return;
    }
    const headers = ["Data", "Cliente", "Progetto", "Descrizione", "Tipo attivita", "Durata minuti", "Fatturabile"];
    const rows = filteredEntries.map((entry: TimeEntryRow) => [
      toDateKey(entry.startedAt ?? ""),
      String(entry.clientName ?? ""),
      String(entry.projectName ?? ""),
      String(entry.description ?? ""),
      String(entry.activityType ?? ""),
      String(Math.round(Number(entry.durationSeconds ?? 0) / 60)),
      entry.isBillable ? "Si" : "No",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, "\"\"")}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `time-tracker-${periodFilter}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV esportato" });
  }, [filteredEntries, periodFilter, toast]);

  const exportPdf = useCallback(async () => {
    try {
      if (filteredEntries.length === 0) {
        toast({ title: "Nessun dato da esportare", variant: "destructive" });
        return;
      }
      const jsPDFModule = await import("jspdf");
      const JsPdfCtor = jsPDFModule.default;
      const doc = new JsPdfCtor({ orientation: "portrait", unit: "mm", format: "a4" });
      let y = 14;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Time Tracker Export", 14, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Periodo: ${periodFilter} · Data export: ${new Date().toLocaleString()}`, 14, y);
      y += 8;
      doc.text(`Totale: ${formatDuration(periodTotals.totalSeconds)} · Fatturabile: ${formatDuration(periodTotals.billableSeconds)}`, 14, y);
      y += 8;
      doc.setFontSize(8);
      for (const entry of filteredEntries.slice(0, 120)) {
        const line = `${toDateKey(entry.startedAt ?? "")} | ${entry.clientName ?? "—"} | ${entry.projectName ?? "—"} | ${entry.description ?? "—"} | ${formatDuration(Number(entry.durationSeconds ?? 0))} | ${entry.isBillable ? "Si" : "No"}`;
        const wrapped = doc.splitTextToSize(line, 182);
        if (y + wrapped.length * 4 > 285) {
          doc.addPage();
          y = 14;
        }
        doc.text(wrapped, 14, y);
        y += wrapped.length * 4 + 1;
      }
      doc.save(`time-tracker-${periodFilter}-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast({ title: "PDF esportato" });
    } catch {
      toast({ title: "Export PDF non riuscito", variant: "destructive" });
    }
  }, [filteredEntries, periodFilter, periodTotals, toast]);

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/tools")} className="p-2 rounded-lg hover:bg-muted transition-colors">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Time Tracker</h1>
              <p className="text-sm text-muted-foreground">Monitora il tempo investito per ogni cliente</p>
            </div>
          </div>
          <button
            onClick={() => setShowManualEntry(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={16} /> Aggiungi tempo manuale
          </button>
        </div>

        {loading && (
          <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            Caricamento Time Tracker...
          </div>
        )}

        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={16} className="text-primary" />
                <span className="text-xs text-muted-foreground">Oggi</span>
              </div>
              <p className="text-2xl font-bold">{formatDuration(stats.today)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar size={16} className="text-blue-500" />
                <span className="text-xs text-muted-foreground">Questa settimana</span>
              </div>
              <p className="text-2xl font-bold">{formatDuration(stats.thisWeek)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={16} className="text-amber-500" />
                <span className="text-xs text-muted-foreground">Questo mese</span>
              </div>
              <p className="text-2xl font-bold">{formatDuration(stats.thisMonth)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign size={16} className="text-green-500" />
                <span className="text-xs text-muted-foreground">Fatturabile (mese)</span>
              </div>
              <p className="text-2xl font-bold">{formatDuration(stats.billableMonth)}</p>
              {stats.totalMonth > 0 && (
                <p className="text-xs text-muted-foreground mt-1">{Math.round((stats.billableMonth / stats.totalMonth) * 100)}% del totale</p>
              )}
            </div>
          </div>
        )}

        {/* Charts row */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Weekly bar chart */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-semibold mb-4">Ore settimanali</h3>
            {weeklyChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={weeklyChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => `${v}h`} />
                  <Bar dataKey="ore" fill="#7a8f5c" radius={[4, 4, 0, 0]} name="Ore totali" />
                  <Bar dataKey="fatturabile" fill="#9bb068" radius={[4, 4, 0, 0]} name="Fatturabile" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">Nessun dato questa settimana</p>
            )}
          </div>

          {/* Client breakdown pie */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-semibold mb-4">Distribuzione per cliente</h3>
            {clientPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={clientPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}h`}>
                    {clientPieData.map((entry: any, i: number) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v}h`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">Nessun dato questo mese</p>
            )}
          </div>
        </div>

        {/* Client breakdown table */}
        {stats?.clientBreakdown && stats.clientBreakdown.length > 0 && (
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-semibold mb-4">Riepilogo per cliente (mese)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-2 px-3 text-muted-foreground font-medium">Cliente</th>
                    <th className="py-2 px-3 text-muted-foreground font-medium text-right">Ore totali</th>
                    <th className="py-2 px-3 text-muted-foreground font-medium text-right">Ore fatturabili</th>
                    <th className="py-2 px-3 text-muted-foreground font-medium text-right">% del totale</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.clientBreakdown.map((c: any, i: number) => (
                    <tr key={c.clientId} className="border-b border-border/50 hover:bg-muted/50">
                      <td className="py-2.5 px-3 flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color ?? COLORS[i % COLORS.length] }} />
                        {c.name}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium">{formatHours(c.seconds)}h</td>
                      <td className="py-2.5 px-3 text-right">{formatHours(c.billable)}h</td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground">
                        {stats.totalMonth > 0 ? Math.round((c.seconds / stats.totalMonth) * 100) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Today's timeline */}
        {stats?.todayTimeline && stats.todayTimeline.length > 0 && (
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-semibold mb-4">Timeline di oggi</h3>
            <div className="space-y-2">
              {stats.todayTimeline.map((e: any) => (
                <div key={e.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: e.clientColor ?? "#7a8f5c" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{e.clientName ?? "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">{e.description ?? e.activityType ?? ""}</p>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">{formatDuration(e.durationSeconds)}</span>
                  {e.isBillable && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400">$</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent entries */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="font-semibold">Registrazioni recenti</h3>
            <div className="flex items-center gap-2">
              <button onClick={exportCsv} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted">
                <Download size={13} /> CSV
              </button>
              <button onClick={() => void exportPdf()} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted">
                <Download size={13} /> PDF
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-4">
            {[
              { id: "today", label: "Oggi" },
              { id: "7d", label: "Ultimi 7 giorni" },
              { id: "30d", label: "Ultimi 30 giorni" },
              { id: "all", label: "Tutto" },
            ].map((period) => (
              <button
                key={period.id}
                onClick={() => setPeriodFilter(period.id as PeriodFilter)}
                className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${periodFilter === period.id ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
              >
                {period.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca per cliente, progetto, descrizione, tipo..."
              className="w-full md:w-96 px-3 py-2 text-sm rounded-lg border border-border bg-background"
            />
            <div className="text-xs text-muted-foreground">
              {filteredEntries.length} risultati
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-[11px] text-muted-foreground">Tempo periodo</p>
              <p className="text-lg font-semibold">{formatDuration(periodTotals.totalSeconds)}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-[11px] text-muted-foreground">Fatturabile</p>
              <p className="text-lg font-semibold">{formatDuration(periodTotals.billableSeconds)}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-[11px] text-muted-foreground">Non fatturabile</p>
              <p className="text-lg font-semibold">{formatDuration(periodTotals.nonBillableSeconds)}</p>
            </div>
          </div>

          {filteredEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nessuna registrazione nel periodo selezionato.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-2 px-3 text-muted-foreground font-medium">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAllVisible}
                        aria-label="Seleziona tutto"
                      />
                    </th>
                    <th className="py-2 px-3 text-muted-foreground font-medium">
                      <button onClick={() => handleSort("date")} className="hover:text-foreground transition-colors">
                        Data {sortField === "date" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </th>
                    <th className="py-2 px-3 text-muted-foreground font-medium">
                      <button onClick={() => handleSort("client")} className="hover:text-foreground transition-colors">
                        Cliente {sortField === "client" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </th>
                    <th className="py-2 px-3 text-muted-foreground font-medium">Progetto</th>
                    <th className="py-2 px-3 text-muted-foreground font-medium">Descrizione</th>
                    <th className="py-2 px-3 text-muted-foreground font-medium">Tipo</th>
                    <th className="py-2 px-3 text-muted-foreground font-medium text-right">
                      <button onClick={() => handleSort("duration")} className="hover:text-foreground transition-colors">
                        Durata {sortField === "duration" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </th>
                    <th className="py-2 px-3 text-muted-foreground font-medium text-center">Fatt.</th>
                    <th className="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.slice(0, 50).map((entry: TimeEntryRow) => {
                    const isEditing = editingEntryId === Number(entry.id);
                    return (
                      <tr key={entry.id} className="border-b border-border/50 hover:bg-muted/50">
                        <td className="py-2 px-3">
                          <input
                            type="checkbox"
                            checked={selectedEntryIds.includes(Number(entry.id))}
                            onChange={() => toggleEntrySelection(Number(entry.id))}
                            aria-label={`Seleziona registrazione ${entry.id}`}
                          />
                        </td>
                        <td className="py-2 px-3 text-xs">{toDateKey(entry.startedAt ?? "") || "—"}</td>
                        <td className="py-2 px-3">{entry.clientName ?? "—"}</td>
                        <td className="py-2 px-3 text-muted-foreground">{entry.projectName ?? "—"}</td>
                        <td className="py-2 px-3 max-w-[240px]">
                          {isEditing ? (
                            <input
                              value={editingDescription}
                              onChange={(e) => setEditingDescription(e.target.value)}
                              className="w-full px-2 py-1 text-xs rounded border border-border bg-background"
                            />
                          ) : (
                            <span className="truncate block">{entry.description ?? "—"}</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-xs text-muted-foreground">
                          {isEditing ? (
                            <select
                              value={editingActivityType}
                              onChange={(e) => setEditingActivityType(e.target.value)}
                              className="w-full px-2 py-1 text-xs rounded border border-border bg-background"
                            >
                              <option value="">—</option>
                              {ACTIVITY_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                            </select>
                          ) : (
                            entry.activityType ?? "—"
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          {isEditing ? (
                            <input
                              type="number"
                              min={1}
                              max={24 * 60}
                              value={editingMinutes}
                              onChange={(e) => setEditingMinutes(Math.max(1, Number(e.target.value) || 1))}
                              className="w-20 px-2 py-1 text-xs rounded border border-border bg-background text-right"
                            />
                          ) : (
                            formatDuration(Number(entry.durationSeconds ?? 0))
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {isEditing ? (
                            <button
                              onClick={() => setEditingBillable(!editingBillable)}
                              className={`inline-flex h-5 w-9 items-center rounded-full transition-colors ${editingBillable ? "bg-primary" : "bg-muted"}`}
                            >
                              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${editingBillable ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
                            </button>
                          ) : (
                            entry.isBillable ? <span className="text-green-600">Si</span> : <span className="text-muted-foreground">No</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center justify-end gap-1">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => void saveEditedEntry(Number(entry.id))}
                                  disabled={savingEdit}
                                  className="p-1 text-primary hover:opacity-80 disabled:opacity-50"
                                  title="Salva modifiche"
                                >
                                  <Save size={14} />
                                </button>
                                <button onClick={cancelEditEntry} className="p-1 text-muted-foreground hover:text-foreground" title="Annulla">
                                  <X size={14} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => beginEditEntry(entry)} className="p-1 text-muted-foreground hover:text-primary transition-colors" title="Modifica">
                                  <Pencil size={14} />
                                </button>
                                <button onClick={() => handleDeleteEntry(Number(entry.id))} className="p-1 text-muted-foreground hover:text-red-500 transition-colors" title="Elimina">
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedEntryIds.length > 0 && (
          <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-xl border border-border bg-card px-4 py-3 shadow-xl">
            <div className="flex items-center gap-3">
              <span className="text-sm">{selectedEntryIds.length} selezionate</span>
              <button
                onClick={() => void handleBulkDelete()}
                disabled={deletingBulk}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
              >
                <Trash2 size={13} />
                {deletingBulk ? "Eliminazione..." : "Elimina selezionate"}
              </button>
              <button
                onClick={() => setSelectedEntryIds([])}
                className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted"
              >
                Annulla
              </button>
            </div>
          </div>
        )}

        {/* Manual entry modal */}
        {showManualEntry && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowManualEntry(false)} />
            <div className="relative z-10 w-full max-w-md mx-4 bg-card rounded-2xl shadow-2xl border border-border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Aggiungi tempo manuale</h3>
                <button onClick={() => setShowManualEntry(false)} className="p-1.5 rounded-lg hover:bg-muted"><X size={16} /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Cliente *</label>
                  <select value={manualClientId ?? ""} disabled={scopedClientId != null} onChange={e => { setManualClientId(Number(e.target.value) || null); setManualProjectId(null); }} className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background disabled:opacity-60">
                    <option value="">Seleziona...</option>
                    {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {scopedClientId != null && (
                    <p className="mt-1 text-[11px] text-muted-foreground">Cliente bloccato sul contesto attivo.</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Progetto</label>
                  <select value={manualProjectId ?? ""} onChange={e => setManualProjectId(Number(e.target.value) || null)} className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background">
                    <option value="">Seleziona...</option>
                    {filteredProjects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Descrizione *</label>
                  <input value={manualDescription} onChange={e => setManualDescription(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background" placeholder="Cosa hai fatto?" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Tipo attivita</label>
                  <select value={manualActivityType} onChange={e => setManualActivityType(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background">
                    <option value="">Seleziona...</option>
                    {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Data</label>
                  <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Ore</label>
                    <input type="number" min={0} max={24} value={manualHours} onChange={e => setManualHours(Math.min(24, Math.max(0, Number(e.target.value) || 0)))} className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Minuti</label>
                    <input type="number" min={0} max={59} value={manualMinutes} onChange={e => setManualMinutes(Math.min(59, Math.max(0, Number(e.target.value) || 0)))} className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background" />
                  </div>
                </div>
                <div className="flex items-center justify-between px-1 py-2">
                  <span className="text-sm">Fatturabile</span>
                  <button
                    onClick={() => setManualBillable(!manualBillable)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${manualBillable ? "bg-primary" : "bg-muted"}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${manualBillable ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
                  </button>
                </div>
                {manualClientId && manualDescription && (
                  <p className="text-xs text-muted-foreground italic">Inserimento manuale</p>
                )}
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={handleManualSubmit} disabled={!manualClientId || !manualDescription || (manualHours === 0 && manualMinutes === 0)} className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                  Salva
                </button>
                <button onClick={() => setShowManualEntry(false)} className="px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted">
                  Annulla
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
