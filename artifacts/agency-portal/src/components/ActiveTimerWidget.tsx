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
  description?: string | null;
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
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [elapsedBySession, setElapsedBySession] = useState<Record<number, number>>({});
  const [showStopModal, setShowStopModal] = useState(false);
  const [stopTargetSession, setStopTargetSession] = useState<ActiveSession | null>(null);
  const [stopDescription, setStopDescription] = useState("");
  const [stopActivityType, setStopActivityType] = useState("");
  const [stopBillable, setStopBillable] = useState(true);
  const [showStartDropdown, setShowStartDropdown] = useState(false);
  const [showSessionsPanel, setShowSessionsPanel] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [startClientId, setStartClientId] = useState<number | null>(null);
  const [startProjectId, setStartProjectId] = useState<number | null>(null);
  const [startDescription, setStartDescription] = useState("");
  const [authUnavailable, setAuthUnavailable] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await portalFetch(`${API}/timer/active-all`, { credentials: "include" });
      if (res.status === 401 || res.status === 403) {
        setAuthUnavailable(true);
        setSessions([]);
        return;
      }
      if (!res.ok) return;
      setAuthUnavailable(false);
      const data = await res.json();
      if (Array.isArray(data)) {
        setSessions(data);
      } else {
        setSessions(data ? [data] : []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (authUnavailable) return;
    fetchSessions();
    const poll = setInterval(fetchSessions, 15000);
    return () => clearInterval(poll);
  }, [fetchSessions, authUnavailable]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const update = () => {
      const next: Record<number, number> = {};
      for (const session of sessions) {
        const started = new Date(session.startedAt).getTime();
        if (session.status === "running") {
          const now = Date.now();
          const total = Math.floor((now - started) / 1000);
          next[session.id] = Math.max(0, total - (session.totalPausedSeconds ?? 0));
        } else {
          const pausedAt = session.pausedAt ? new Date(session.pausedAt).getTime() : Date.now();
          const total = Math.floor((pausedAt - started) / 1000);
          next[session.id] = Math.max(0, total - (session.totalPausedSeconds ?? 0));
        }
      }
      setElapsedBySession(next);
    };
    if (sessions.length > 0) {
      update();
      timerRef.current = setInterval(update, 1000);
    } else {
      setElapsedBySession({});
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [sessions]);

  const handlePause = useCallback(async (sessionId: number) => {
    try {
      const res = await portalFetch(`${API}/timer/pause`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) throw new Error("pause_failed");
      fetchSessions();
    } catch {
      toast({ title: "Pausa timer non riuscita", variant: "destructive" });
    }
  }, [fetchSessions, toast]);

  const handleResume = useCallback(async (sessionId: number) => {
    try {
      const res = await portalFetch(`${API}/timer/resume`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) throw new Error("resume_failed");
      fetchSessions();
    } catch {
      toast({ title: "Ripresa timer non riuscita", variant: "destructive" });
    }
  }, [fetchSessions, toast]);

  const handleStopClick = (target: ActiveSession) => {
    setStopTargetSession(target);
    setStopDescription(target.taskTitle ?? target.description ?? target.clientName ?? "");
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
          sessionId: stopTargetSession?.id,
          description: stopDescription,
          activityType: stopActivityType,
          isBillable: stopBillable,
          discard: discard ?? false,
        }),
      });
      if (res.ok) {
        setStopTargetSession(null);
        setShowStopModal(false);
        fetchSessions();
      }
    } catch (err) {
      console.error("Stop timer error:", err);
    }
  }, [stopTargetSession?.id, stopDescription, stopActivityType, stopBillable, fetchSessions]);

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
        fetchSessions();
      } else {
        toast({ title: "Avvio timer non riuscito", variant: "destructive" });
      }
    } catch {
      toast({ title: "Avvio timer non riuscito", variant: "destructive" });
    }
  }, [startClientId, startProjectId, startDescription, fetchSessions, scopedClientId, toast]);

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

  const runningSessionsCount = sessions.filter((s) => s.status === "running").length;
  const totalElapsed = sessions.reduce((sum, s) => sum + (elapsedBySession[s.id] ?? 0), 0);

  return (
    <>
      <div className="relative flex items-center gap-2">
        <button
          onClick={openStart}
          disabled={authUnavailable}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-xs font-medium transition-colors"
          title="Avvia timer"
        >
          <Timer size={14} />
          <span className="hidden sm:inline">Timer</span>
        </button>

        {sessions.length > 0 && (
          <button
            onClick={() => setShowSessionsPanel((prev) => !prev)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-xs font-medium hover:bg-muted/80 transition-colors"
            title="Gestisci timer attivi"
          >
            <span className={`w-2 h-2 rounded-full ${runningSessionsCount > 0 ? "bg-red-500 animate-pulse" : "bg-gray-400"}`} />
            <span className="hidden sm:inline text-foreground">
              {sessions.length} timer
            </span>
            <span className="font-mono text-foreground tabular-nums">{formatTime(totalElapsed)}</span>
          </button>
        )}

        {showSessionsPanel && sessions.length > 0 && (
          <div className="absolute right-0 top-11 z-[95] w-[360px] rounded-xl border border-border bg-card shadow-2xl p-3 space-y-2">
            <div className="text-xs font-semibold text-muted-foreground px-1">Timer attivi in parallelo</div>
            {sessions.map((session) => (
              <div key={session.id} className="rounded-lg border border-border bg-background/70 px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{session.clientName ?? session.projectName ?? session.taskTitle ?? "Timer"}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{session.projectName ?? session.description ?? "Attivita in corso"}</p>
                  </div>
                  <span className="font-mono text-xs tabular-nums">{formatTime(elapsedBySession[session.id] ?? 0)}</span>
                </div>
                <div className="mt-2 flex items-center justify-end gap-1">
                  {session.status === "running" ? (
                    <button onClick={() => handlePause(session.id)} className="p-1 rounded hover:bg-muted transition-colors" title="Pausa">
                      <Pause size={13} />
                    </button>
                  ) : (
                    <button onClick={() => handleResume(session.id)} className="p-1 rounded hover:bg-muted transition-colors" title="Riprendi">
                      <Play size={13} />
                    </button>
                  )}
                  <button onClick={() => handleStopClick(session)} className="p-1 rounded hover:bg-muted transition-colors text-red-500" title="Ferma">
                    <Square size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
                <h3 className="font-semibold">Tempo registrato: {formatDuration(stopTargetSession ? (elapsedBySession[stopTargetSession.id] ?? 0) : 0)}</h3>
                <p className="text-sm text-muted-foreground">{stopTargetSession?.clientName} {stopTargetSession?.projectName ? `/ ${stopTargetSession.projectName}` : ""}</p>
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
      await portalFetch(`${API}/timer/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(opts),
      });
    } catch {}
  }, []);

  return startTimer;
}
