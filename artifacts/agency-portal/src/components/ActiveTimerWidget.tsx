import { useState, useEffect, useCallback, useRef } from "react";
import { portalFetch } from "@workspace/api-client-react";
import { Clock, Pause, Play, Square, Timer } from "lucide-react";
import { useClientContext } from "@/context/ClientContext";
import { useToast } from "@/hooks/use-toast";

const API = "/api";

interface ActiveSession {
  id: number;
  userId: string;
  clientId: number | null;
  projectId: number | null;
  taskId: number | null;
  startedAt: string;
  pausedAt: string | null;
  totalPausedSeconds: number;
  status: string;
  clientName: string | null;
  projectName: string | null;
  taskTitle: string | null;
}

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

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function ActiveTimerWidget() {
  const { activeClient } = useClientContext();
  const { toast } = useToast();
  const activeClientId = activeClient?.id ? Number(activeClient.id) : NaN;
  const scopedClientId = Number.isFinite(activeClientId) ? activeClientId : null;
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [showStopModal, setShowStopModal] = useState(false);
  const [stopDescription, setStopDescription] = useState("");
  const [stopActivityType, setStopActivityType] = useState("");
  const [stopBillable, setStopBillable] = useState(true);
  const [showStartDropdown, setShowStartDropdown] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [startClientId, setStartClientId] = useState<number | null>(null);
  const [startProjectId, setStartProjectId] = useState<number | null>(null);
  const [startDescription, setStartDescription] = useState("");
  const [authUnavailable, setAuthUnavailable] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSession = useCallback(async () => {
    try {
      const res = await portalFetch(`${API}/timer/active`, { credentials: "include" });
      if (res.status === 401 || res.status === 403) {
        setAuthUnavailable(true);
        setSession(null);
        return;
      }
      if (!res.ok) return;
      setAuthUnavailable(false);
      const data = await res.json();
      setSession(data);
      if (data?.taskTitle) setStopDescription(data.taskTitle);
    } catch {}
  }, []);

  useEffect(() => {
    if (authUnavailable) return;
    fetchSession();
    const poll = setInterval(fetchSession, 15000);
    return () => clearInterval(poll);
  }, [fetchSession, authUnavailable]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (session && session.status === "running") {
      const update = () => {
        const started = new Date(session.startedAt).getTime();
        const now = Date.now();
        const total = Math.floor((now - started) / 1000);
        setElapsed(Math.max(0, total - (session.totalPausedSeconds ?? 0)));
      };
      update();
      timerRef.current = setInterval(update, 1000);
    } else if (session && session.status === "paused") {
      const started = new Date(session.startedAt).getTime();
      const pausedAt = session.pausedAt ? new Date(session.pausedAt).getTime() : Date.now();
      const total = Math.floor((pausedAt - started) / 1000);
      setElapsed(Math.max(0, total - (session.totalPausedSeconds ?? 0)));
    } else {
      setElapsed(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [session]);

  const handlePause = useCallback(async () => {
    try {
      const res = await portalFetch(`${API}/timer/pause`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("pause_failed");
      fetchSession();
    } catch {
      toast({ title: "Pausa timer non riuscita", variant: "destructive" });
    }
  }, [fetchSession, toast]);

  const handleResume = useCallback(async () => {
    try {
      const res = await portalFetch(`${API}/timer/resume`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("resume_failed");
      fetchSession();
    } catch {
      toast({ title: "Ripresa timer non riuscita", variant: "destructive" });
    }
  }, [fetchSession, toast]);

  const handleStopClick = () => {
    setStopDescription(session?.taskTitle ?? session?.clientName ?? "");
    setStopActivityType("");
    setStopBillable(true);
    setShowStopModal(true);
  };

  const handleStopConfirm = useCallback(async (discard?: boolean) => {
    try {
      const res = await portalFetch(`${API}/timer/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          description: stopDescription,
          activityType: stopActivityType,
          isBillable: stopBillable,
          discard: discard ?? false,
        }),
      });
      if (res.ok) {
        setSession(null);
        setShowStopModal(false);
        setElapsed(0);
      }
    } catch (err) {
      console.error("Stop timer error:", err);
    }
  }, [stopDescription, stopActivityType, stopBillable]);

  const handleStartNew = useCallback(async () => {
    if (!startClientId) return;
    try {
      const res = await portalFetch(`${API}/timer/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          clientId: startClientId,
          projectId: startProjectId,
          description: startDescription,
        }),
      });
      if (res.ok) {
        setShowStartDropdown(false);
        setStartClientId(scopedClientId);
        setStartProjectId(null);
        setStartDescription("");
        fetchSession();
      } else {
        toast({ title: "Avvio timer non riuscito", variant: "destructive" });
      }
    } catch {
      toast({ title: "Avvio timer non riuscito", variant: "destructive" });
    }
  }, [startClientId, startProjectId, startDescription, fetchSession, scopedClientId, toast]);

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
      // Silent fallback in widget context.
    }
  }, [scopedClientId]);

  const openStart = () => {
    loadClientsProjects();
    if (scopedClientId != null) {
      setStartClientId(scopedClientId);
    }
    setShowStartDropdown(true);
  };

  useEffect(() => {
    if (scopedClientId != null) {
      setStartClientId(scopedClientId);
      setStartProjectId(null);
    }
  }, [scopedClientId]);

  const projectList = Array.isArray(projects)
    ? projects
    : Array.isArray((projects as any)?.items)
      ? (projects as any).items
      : projects
        ? [projects]
        : [];

  const filteredProjects = startClientId
    ? projectList.filter((p: any) => Number(p?.clientId) === startClientId)
    : projectList;

  return (
    <>
      {/* Timer button or active widget */}
      {session ? (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-xs font-medium">
          <span className={`w-2 h-2 rounded-full ${session.status === "running" ? "bg-red-500 animate-pulse" : "bg-gray-400"}`} />
          <span className="hidden sm:inline max-w-[120px] truncate text-foreground">
            {session.clientName ?? session.taskTitle ?? "Timer"}
          </span>
          <span className="font-mono text-foreground tabular-nums">{formatTime(elapsed)}</span>
          {session.status === "running" ? (
            <button onClick={handlePause} className="p-1 rounded hover:bg-background/60 transition-colors" title="Pausa">
              <Pause size={13} />
            </button>
          ) : (
            <button onClick={handleResume} className="p-1 rounded hover:bg-background/60 transition-colors" title="Riprendi">
              <Play size={13} />
            </button>
          )}
          <button onClick={handleStopClick} className="p-1 rounded hover:bg-background/60 transition-colors text-red-500" title="Ferma">
            <Square size={13} />
          </button>
        </div>
      ) : (
        <button
          onClick={openStart}
          disabled={authUnavailable}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-xs font-medium transition-colors"
          title="Avvia timer"
        >
          <Timer size={14} />
          <span className="hidden sm:inline">Timer</span>
        </button>
      )}

      {/* Start dropdown */}
      {showStartDropdown && (
        <div className="fixed inset-0 z-[90]" onClick={() => setShowStartDropdown(false)}>
          <div className="absolute top-12 right-4 w-80 bg-card rounded-xl shadow-2xl border border-border p-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-3">Avvia timer</h3>
            <div className="space-y-2.5">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Cliente *</label>
                <select
                  value={startClientId ?? ""}
                  disabled={scopedClientId != null}
                  onChange={e => { setStartClientId(Number(e.target.value) || null); setStartProjectId(null); }}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background disabled:opacity-60"
                >
                  <option value="">Seleziona cliente...</option>
                  {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {scopedClientId != null && (
                  <p className="mt-1 text-[11px] text-muted-foreground">Cliente bloccato sul contesto attivo.</p>
                )}
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Progetto</label>
                <select
                  value={startProjectId ?? ""}
                  onChange={e => setStartProjectId(Number(e.target.value) || null)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
                >
                  <option value="">Seleziona progetto...</option>
                  {filteredProjects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Descrizione</label>
                <input
                  value={startDescription}
                  onChange={e => setStartDescription(e.target.value)}
                  placeholder="Cosa stai facendo?"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleStartNew}
                  disabled={!startClientId}
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  Avvia timer
                </button>
                <button
                  onClick={() => setShowStartDropdown(false)}
                  className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors"
                >
                  Annulla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stop modal */}
      {showStopModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-md mx-4 bg-card rounded-2xl shadow-2xl border border-border p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock size={20} className="text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Tempo registrato: {formatDuration(elapsed)}</h3>
                <p className="text-sm text-muted-foreground">{session?.clientName} {session?.projectName ? `/ ${session.projectName}` : ""}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Descrizione attivita</label>
                <input
                  value={stopDescription}
                  onChange={e => setStopDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Tipo di attivita</label>
                <select
                  value={stopActivityType}
                  onChange={e => setStopActivityType(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
                >
                  <option value="">Seleziona tipo...</option>
                  {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex items-center justify-between px-1 py-2">
                <span className="text-sm">Fatturabile</span>
                <button
                  onClick={() => setStopBillable(!stopBillable)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${stopBillable ? "bg-primary" : "bg-muted"}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${stopBillable ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
                </button>
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => handleStopConfirm(false)}
                className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
              >
                Salva
              </button>
              <button
                onClick={() => handleStopConfirm(true)}
                className="px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted transition-colors"
              >
                Scarta
              </button>
              <button
                onClick={() => setShowStopModal(false)}
                className="px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted transition-colors"
              >
                Continua timer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function useTimerStart() {
  const startTimer = useCallback(async (opts: {
    clientId?: number | null;
    projectId?: number | null;
    taskId?: number | null;
    description?: string;
  }) => {
    try {
      const res = await portalFetch(`${API}/timer/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(opts),
      });
      if (res.status === 409) {
        const data = await res.json();
        const ok = window.confirm(
          `Hai gia un timer attivo. Vuoi fermarlo e iniziarne uno nuovo?`
        );
        if (ok) {
          await portalFetch(`${API}/timer/force-stop`, { method: "POST", credentials: "include" });
          await portalFetch(`${API}/timer/start`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(opts),
          });
        }
      }
    } catch {}
  }, []);

  return startTimer;
}
