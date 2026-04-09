import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/layout/Layout";
import { Clock, TrendingUp, DollarSign, Calendar, Plus, X, Trash2, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
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

export default function TimeTrackerPage() {
  const [, navigate] = useLocation();
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

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, entriesRes] = await Promise.all([
        fetch(`${API}/time-tracker/stats`, { credentials: "include" }),
        fetch(`${API}/time-entries`, { credentials: "include" }),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (entriesRes.ok) setEntries(await entriesRes.json());
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  const loadClientsProjects = useCallback(async () => {
    try {
      const [cRes, pRes] = await Promise.all([
        fetch(`${API}/clients`, { credentials: "include" }),
        fetch(`${API}/projects`, { credentials: "include" }),
      ]);
      if (cRes.ok) {
        const cData = await cRes.json();
        if (Array.isArray(cData)) setClients(cData);
        else if (Array.isArray((cData as any)?.items)) setClients((cData as any).items);
        else setClients([]);
      }
      if (pRes.ok) setProjects(await pRes.json());
    } catch {}
  }, []);

  useEffect(() => {
    fetchData();
    loadClientsProjects();
    fetch(`${API}/time-tracker/seed`, { method: "POST", credentials: "include" }).catch(() => {});
  }, [fetchData, loadClientsProjects]);

  const handleManualSubmit = useCallback(async () => {
    if (!manualClientId || !manualDescription) return;
    const durationSeconds = (manualHours * 3600) + (manualMinutes * 60);
    if (durationSeconds <= 0) return;

    const startedAt = new Date(`${manualDate}T09:00:00`);
    try {
      const res = await fetch(`${API}/time-entries`, {
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
        setManualClientId(null);
        setManualProjectId(null);
        fetchData();
      }
    } catch {}
  }, [manualClientId, manualProjectId, manualDescription, manualActivityType, manualDate, manualHours, manualMinutes, manualBillable, fetchData]);

  const handleDeleteEntry = useCallback(async (id: number) => {
    try {
      await fetch(`${API}/time-entries/${id}`, { method: "DELETE", credentials: "include" });
      fetchData();
    } catch {}
  }, [fetchData]);

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
    ? projectList.filter((p: any) => p.clientId === manualClientId)
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
          <h3 className="font-semibold mb-4">Registrazioni recenti</h3>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nessuna registrazione trovata. Avvia il timer o aggiungi tempo manualmente.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-2 px-3 text-muted-foreground font-medium">Data</th>
                    <th className="py-2 px-3 text-muted-foreground font-medium">Cliente</th>
                    <th className="py-2 px-3 text-muted-foreground font-medium">Progetto</th>
                    <th className="py-2 px-3 text-muted-foreground font-medium">Descrizione</th>
                    <th className="py-2 px-3 text-muted-foreground font-medium">Tipo</th>
                    <th className="py-2 px-3 text-muted-foreground font-medium text-right">Durata</th>
                    <th className="py-2 px-3 text-muted-foreground font-medium text-center">Fatt.</th>
                    <th className="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.slice(0, 20).map((e: any) => (
                    <tr key={e.id} className="border-b border-border/50 hover:bg-muted/50">
                      <td className="py-2 px-3 text-xs">{e.startedAt?.slice(0, 10) ?? "—"}</td>
                      <td className="py-2 px-3">{e.clientName ?? "—"}</td>
                      <td className="py-2 px-3 text-muted-foreground">{e.projectName ?? "—"}</td>
                      <td className="py-2 px-3 max-w-[200px] truncate">{e.description ?? "—"}</td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">{e.activityType ?? "—"}</td>
                      <td className="py-2 px-3 text-right font-mono">{formatDuration(e.durationSeconds)}</td>
                      <td className="py-2 px-3 text-center">
                        {e.isBillable ? <span className="text-green-600">Si</span> : <span className="text-muted-foreground">No</span>}
                      </td>
                      <td className="py-2 px-3">
                        <button onClick={() => handleDeleteEntry(e.id)} className="p-1 text-muted-foreground hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

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
                  <select value={manualClientId ?? ""} onChange={e => { setManualClientId(Number(e.target.value) || null); setManualProjectId(null); }} className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background">
                    <option value="">Seleziona...</option>
                    {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
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
                    <input type="number" min={0} max={24} value={manualHours} onChange={e => setManualHours(Number(e.target.value))} className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Minuti</label>
                    <input type="number" min={0} max={59} value={manualMinutes} onChange={e => setManualMinutes(Number(e.target.value))} className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background" />
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
