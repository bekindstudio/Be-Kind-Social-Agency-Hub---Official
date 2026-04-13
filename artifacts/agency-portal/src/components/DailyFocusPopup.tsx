import { useState, useEffect, useCallback, useRef } from "react";
import { portalFetch } from "@workspace/api-client-react";
import { usePortalUser } from "@/hooks/usePortalUser";
import { useLocation } from "wouter";
import {
  X, ChevronRight, ChevronLeft, Play, SkipForward, CheckCircle2,
  Users, CalendarClock, Clock, Trophy, Target, Sparkles, ArrowRight
} from "lucide-react";
import confetti from "canvas-confetti";
import { useToast } from "@/hooks/use-toast";

interface FocusTask {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  projectId: number | null;
  projectName: string | null;
  clientId: number | null;
  clientName: string | null;
  assigneeId: number | null;
  assigneeName: string | null;
  categoria: string | null;
  checklistJson?: string | null;
  estimatedHours?: number | null;
  score: number;
  quadrant: number;
  postponedCount: number;
}

interface TeamMember {
  id: number;
  name: string;
}

const API = "/api";

const QUADRANT_CONFIG: Record<number, { color: string; bg: string; border: string; label: string; explanation: string }> = {
  1: { color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/40", border: "border-red-200 dark:border-red-800", label: "Da fare subito", explanation: "In scadenza oggi — completala prima di tutto il resto" },
  2: { color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/40", border: "border-purple-200 dark:border-purple-800", label: "Pianifica oggi", explanation: "Importante per il progetto — pianifica quando farla oggi" },
  3: { color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-amber-200 dark:border-amber-800", label: "Valuta se delegare", explanation: "Urgente ma a bassa priorita — valuta se delegarla al team" },
  4: { color: "text-gray-500 dark:text-gray-400", bg: "bg-gray-50 dark:bg-gray-900/40", border: "border-gray-200 dark:border-gray-700", label: "Bassa priorita", explanation: "Non urgente — tienila in mente ma non bloccarti ora" },
};

const QUADRANT_DOT: Record<number, string> = {
  1: "bg-red-500",
  2: "bg-purple-500",
  3: "bg-amber-500",
  4: "bg-gray-400",
};

const QUADRANT_BAR: Record<number, string> = {
  1: "bg-red-500",
  2: "bg-purple-500",
  3: "bg-amber-500",
  4: "bg-gray-400",
};

const TIPS = [
  "Inizia con la task piu difficile — il resto della giornata sara piu facile",
  "Blocca 2 ore di lavoro profondo senza notifiche per le task importanti",
  "Comunica al team le tue priorita di oggi nel canale #generale",
  "Ogni task completata aumenta il momentum — non fermarti dopo la prima",
  "Se una task richiede meno di 2 minuti, falla subito senza metterla in lista",
  "Controlla le scadenze dei clienti prima di iniziare le task interne",
];

function getGreeting(name: string): string {
  const h = new Date().getHours();
  if (h < 12) return `Buongiorno, ${name} ☀️`;
  if (h < 17) return `Buon pomeriggio, ${name} 👋`;
  return `Buonasera, ${name} 🌙`;
}

function formatItalianDate(): string {
  const days = ["Domenica", "Lunedi", "Martedi", "Mercoledi", "Giovedi", "Venerdi", "Sabato"];
  const months = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
  const d = new Date();
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function DailyFocusPopup({ open, onClose, onStartTimer }: {
  open: boolean;
  onClose: () => void;
  onStartTimer?: (task: FocusTask) => void;
}) {
  const { user } = usePortalUser();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [tasks, setTasks] = useState<FocusTask[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [delegated, setDelegated] = useState<Set<number>>(new Set());
  const [postponed, setPostponed] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showDelegate, setShowDelegate] = useState(false);
  const [delegateTarget, setDelegateTarget] = useState<number | null>(null);
  const [showTip, setShowTip] = useState(false);
  const [authUnavailable, setAuthUnavailable] = useState(false);
  const [animatingOut, setAnimatingOut] = useState(false);
  const [memberName, setMemberName] = useState<string | null>(null);
  const lastQ1Index = useRef(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await portalFetch(`${API}/daily-focus`, { credentials: "include" });
      if (res.status === 401 || res.status === 403) {
        setAuthUnavailable(true);
        setTasks([]);
        return;
      }
      if (!res.ok) return;
      setAuthUnavailable(false);
      const data = await res.json();
      setTasks(data.tasks ?? []);
      setTeamMembers(data.teamMembers ?? []);
      setMemberName(data.memberName);
      if (data.tasks?.length > 0) {
        const q1Last = data.tasks.reduce((acc: number, t: FocusTask, i: number) => t.quadrant === 1 ? i : acc, -1);
        lastQ1Index.current = q1Last;
      }
    } catch (err) {
      console.error("Daily Focus fetch error:", err);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      if (authUnavailable) {
        setTasks([]);
        setLoading(false);
        return;
      }
      fetchTasks();
      setCurrentIndex(0);
      setCompleted(new Set());
      setSkipped(new Set());
      setDelegated(new Set());
      setPostponed(new Set());
    }
  }, [open, fetchTasks, authUnavailable]);

  const logAction = useCallback(async (taskId: number, action: string, extra?: any) => {
    try {
      await portalFetch(`${API}/daily-focus/action`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, action, ...extra }),
      });
    } catch {}
  }, []);

  const saveSession = useCallback(async () => {
    try {
      await portalFetch(`${API}/daily-focus/session`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasksShownJson: tasks.map(t => t.id),
          tasksCompletedJson: Array.from(completed),
          tasksSkippedJson: Array.from(skipped),
          tasksDelegatedJson: Array.from(delegated),
          tasksPostponedJson: Array.from(postponed),
          completionRate: tasks.length > 0 ? completed.size / tasks.length : 0,
        }),
      });
    } catch {}
  }, [tasks, completed, skipped, delegated, postponed]);

  const handleClose = useCallback(() => {
    saveSession();
    onClose();
  }, [saveSession, onClose]);

  const goNext = useCallback(() => {
    const currentTask = tasks[currentIndex];
    if (currentTask) logAction(currentTask.id, "viewed");
    if (currentIndex === lastQ1Index.current && !showTip && tasks[currentIndex]?.quadrant === 1) {
      const nextTask = tasks[currentIndex + 1];
      if (nextTask && nextTask.quadrant !== 1) {
        setShowTip(true);
        return;
      }
    }
    if (showTip) { setShowTip(false); }
    if (currentIndex < tasks.length - 1) {
      setAnimatingOut(true);
      setTimeout(() => {
        setCurrentIndex(i => i + 1);
        setAnimatingOut(false);
        setShowDelegate(false);
      }, 200);
    }
  }, [currentIndex, tasks, showTip, logAction]);

  const goPrev = useCallback(() => {
    if (showTip) { setShowTip(false); return; }
    if (currentIndex > 0) {
      setCurrentIndex(i => i - 1);
      setShowDelegate(false);
    }
  }, [currentIndex, showTip]);

  const handleStartNow = useCallback((task: FocusTask) => {
    logAction(task.id, "started");
    if (onStartTimer) {
      onStartTimer(task);
    }
    toast({ title: `Timer avviato per ${task.title}` });
    handleClose();
    navigate(`/projects`);
  }, [logAction, onStartTimer, handleClose, navigate, toast]);

  const handleSkip = useCallback(() => {
    const task = tasks[currentIndex];
    if (task) {
      logAction(task.id, "skipped");
      setSkipped(s => new Set(s).add(task.id));
    }
    goNext();
  }, [tasks, currentIndex, logAction, goNext]);

  const handleComplete = useCallback(() => {
    const task = tasks[currentIndex];
    if (task) {
      logAction(task.id, "completed");
      setCompleted(c => new Set(c).add(task.id));
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: ["#7a8f5c", "#9bb068", "#f59e0b", "#ef4444"] });
      setTimeout(() => {
        if (currentIndex < tasks.length - 1) {
          setCurrentIndex(i => i + 1);
        }
      }, 800);
    }
  }, [tasks, currentIndex, logAction]);

  const handlePostpone = useCallback(() => {
    const task = tasks[currentIndex];
    if (task) {
      logAction(task.id, "postponed", { note: `Posticipata da ${user?.firstName ?? "utente"}` });
      setPostponed((p) => new Set(p).add(task.id));
      goNext();
    }
  }, [tasks, currentIndex, logAction, user, goNext]);

  const handleDelegate = useCallback(() => {
    const task = tasks[currentIndex];
    if (task && delegateTarget) {
      logAction(task.id, "delegated", { newAssigneeId: delegateTarget, note: `Delegata da ${user?.firstName ?? "utente"}` });
      setDelegated((d) => new Set(d).add(task.id));
      setShowDelegate(false);
      goNext();
    }
  }, [tasks, currentIndex, delegateTarget, logAction, user, goNext]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "n") goNext();
      else if (e.key === "ArrowLeft" || e.key === "p") goPrev();
      else if (e.key === "Enter") { const t = tasks[currentIndex]; if (t) handleStartNow(t); }
      else if (e.key === "s") handleSkip();
      else if (e.key === "c") handleComplete();
      else if (e.key.toLowerCase() === "d") setShowDelegate(true);
      else if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, goNext, goPrev, handleStartNow, handleSkip, handleComplete, handleClose, tasks, currentIndex]);

  if (!open) return null;

  const displayName = user?.firstName ?? memberName ?? "Team";
  const task = tasks[currentIndex];
  const isEnd = currentIndex >= tasks.length || !task;
  const qConfig = task ? QUADRANT_CONFIG[task.quadrant] ?? QUADRANT_CONFIG[4] : QUADRANT_CONFIG[4];
  const progress = tasks.length > 0 ? ((currentIndex + 1) / tasks.length) * 100 : 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        ref={containerRef}
        onTouchStart={(e) => { touchStartX.current = e.changedTouches[0]?.clientX ?? null; }}
        onTouchEnd={(e) => {
          const start = touchStartX.current;
          const end = e.changedTouches[0]?.clientX ?? null;
          if (start == null || end == null) return;
          const delta = end - start;
          if (delta < -40) goNext();
          if (delta > 40) goPrev();
          touchStartX.current = null;
        }}
        className="relative z-10 w-full max-w-[560px] mx-4 bg-card rounded-2xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-300"
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{getGreeting(displayName)}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{formatItalianDate()}</p>
            </div>
            <div className="flex items-center gap-3">
              {tasks.length > 0 && (
                <span className="text-sm text-muted-foreground font-medium">{currentIndex + 1} di {tasks.length}</span>
              )}
              <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <X size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        {tasks.length > 0 && (
          <div className="h-1 bg-muted mx-6 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${task ? QUADRANT_BAR[task.quadrant] : "bg-gray-400"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Content */}
        <div className="px-6 py-4 min-h-[320px]">
          {loading ? (
            <div className="flex items-center justify-center h-[300px]">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : tasks.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-[300px] text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Tutto in ordine!</h3>
              <p className="text-muted-foreground mb-1">Non hai task urgenti per oggi. Ottimo lavoro.</p>
              <p className="text-sm text-muted-foreground mb-6">Puoi usare questo tempo per lavorare sui progetti in anticipo o dedicarti alla strategia.</p>
              <button
                onClick={() => { handleClose(); navigate("/projects"); }}
                className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                Vedi tutti i progetti
              </button>
            </div>
          ) : showTip ? (
            /* Tip card between Q1 and Q2 */
            <div className="flex flex-col items-center justify-center h-[300px] text-center">
              <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center mb-4">
                <Sparkles className="w-7 h-7 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold mb-3">Suggerimento del giorno</h3>
              <p className="text-muted-foreground max-w-sm italic">
                "{TIPS[new Date().getDate() % TIPS.length]}"
              </p>
              <button onClick={() => { setShowTip(false); setCurrentIndex(i => i + 1); }} className="mt-6 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center gap-2">
                Continua <ArrowRight size={16} />
              </button>
            </div>
          ) : isEnd ? (
            /* End of list */
            <div className="flex flex-col items-center justify-center h-[300px] text-center">
              {completed.size === tasks.length ? (
                <>
                  <Trophy className="w-12 h-12 text-amber-500 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Giornata completata!</h3>
                  <p className="text-muted-foreground mb-2">Hai completato tutte le {tasks.length} task di oggi. Sei in forma!</p>
                  <button onClick={() => { handleClose(); navigate("/"); }} className="mt-4 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90">
                    Chiudi e vai alla dashboard
                  </button>
                </>
              ) : completed.size > 0 ? (
                <>
                  <Target className="w-12 h-12 text-primary mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{completed.size} task completate, {skipped.size} saltate</h3>
                  <p className="text-sm text-muted-foreground mb-4">Le task saltate saranno visibili nel tuo backlog</p>
                  <div className="flex gap-3">
                    <button onClick={() => setCurrentIndex(0)} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors">Rivedi le saltate</button>
                    <button onClick={() => { handleClose(); navigate("/"); }} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90">Vai alla dashboard</button>
                  </div>
                </>
              ) : (
                <>
                  <Target className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Hai visto tutte le {tasks.length} task di oggi</h3>
                  <p className="text-sm text-muted-foreground mb-4">Ricorda: inizia sempre dalla prima della lista!</p>
                  <div className="flex gap-3">
                    <button onClick={() => setCurrentIndex(0)} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors">Inizia dalla prima</button>
                    <button onClick={() => { handleClose(); navigate("/"); }} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90">Vai alla dashboard</button>
                  </div>
                </>
              )}
            </div>
          ) : (
            /* Task card */
            <div className={`transition-all duration-200 ${animatingOut ? "opacity-0 translate-x-8" : "opacity-100 translate-x-0"}`}>
              {/* Quadrant badge + client */}
              <div className="flex items-center justify-between mb-3">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${qConfig.bg} ${qConfig.color} ${qConfig.border} border`}>
                  <span className={`w-2 h-2 rounded-full ${QUADRANT_DOT[task.quadrant]}`} />
                  {qConfig.label}
                </span>
                {task.clientName && (
                  <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">{task.clientName}</span>
                )}
              </div>

              {/* Title */}
              <h3 className="text-[20px] font-medium text-foreground mb-2 leading-tight">{task.title}</h3>

              {/* Project + category */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                {task.projectName && <span>{task.projectName}</span>}
                {task.projectName && task.categoria && <span>·</span>}
                {task.categoria && <span>{task.categoria}</span>}
              </div>

              {/* Description */}
              {task.description && (
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{task.description}</p>
              )}

              {/* Info chips */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted text-xs">
                  <CalendarClock size={14} className="text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-muted-foreground">Scadenza</p>
                    <p className="font-medium text-foreground">{task.dueDate ?? "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted text-xs">
                  <Clock size={14} className="text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-muted-foreground">Stimato</p>
                    <p className="font-medium text-foreground">{task.estimatedHours ? `${task.estimatedHours}h` : "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted text-xs">
                  <Users size={14} className="text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-muted-foreground">Cliente</p>
                    <p className="font-medium text-foreground truncate">{task.clientName ?? "—"}</p>
                  </div>
                </div>
              </div>

              {/* Score bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Priorita: {Math.min(100, Math.round((task.score / 150) * 100))}/100</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${QUADRANT_BAR[task.quadrant]}`} style={{ width: `${Math.min(100, (task.score / 150) * 100)}%` }} />
                </div>
              </div>

              {/* Quadrant explanation */}
              <p className="text-xs text-muted-foreground italic">{qConfig.explanation}</p>

              {/* Delegate panel */}
              {showDelegate && (
                <div className="mt-3 p-3 rounded-lg border border-border bg-muted/50">
                  <p className="text-sm font-medium mb-2">Delega a:</p>
                  <select
                    value={delegateTarget ?? ""}
                    onChange={e => setDelegateTarget(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background mb-2"
                  >
                    <option value="">Seleziona membro...</option>
                    {teamMembers.filter(m => m.id !== task.assigneeId).map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button onClick={handleDelegate} disabled={!delegateTarget} className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg disabled:opacity-50">Conferma</button>
                    <button onClick={() => setShowDelegate(false)} className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted">Annulla</button>
                  </div>
                </div>
              )}

              {task.categoria === "Onboarding Nuovo Cliente" && task.checklistJson && (
                <div className="mt-3 p-3 rounded-lg border border-border bg-muted/50">
                  <p className="text-xs font-medium mb-1">Checklist onboarding</p>
                  <p className="text-xs text-muted-foreground">Vedi checklist completa →</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        {!loading && tasks.length > 0 && !isEnd && !showTip && (
          <div className="px-6 pb-4 space-y-3">
            {/* Primary actions */}
            <div className="flex gap-2">
              <button
                onClick={() => handleStartNow(task)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity text-sm"
              >
                <Play size={15} /> Inizia ora
              </button>
              <button
                onClick={goNext}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-border rounded-lg font-medium hover:bg-muted transition-colors text-sm"
              >
                Prossima <ChevronRight size={15} />
              </button>
              <button
                onClick={handleSkip}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors text-sm text-muted-foreground"
              >
                <SkipForward size={15} /> Salta
              </button>
            </div>

            {/* Secondary actions */}
            <div className="flex items-center justify-center gap-4 text-xs">
              <button onClick={() => setShowDelegate(true)} className="text-muted-foreground hover:text-foreground transition-colors">Delega al team</button>
              <span className="text-border">|</span>
              <button onClick={handlePostpone} className="text-muted-foreground hover:text-foreground transition-colors">Sposta a domani</button>
              <span className="text-border">|</span>
              <button onClick={handleComplete} className="text-muted-foreground hover:text-foreground transition-colors">Segna come completata</button>
            </div>

            {/* Dots */}
            <div className="flex items-center justify-center gap-1.5 pt-1">
              {tasks.slice(0, 10).map((t, i) => (
                <button
                  key={t.id}
                  onClick={() => { setCurrentIndex(i); setShowDelegate(false); }}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === currentIndex
                      ? `${QUADRANT_DOT[t.quadrant]} scale-125`
                      : completed.has(t.id)
                        ? "bg-green-400"
                        : "bg-muted-foreground/30"
                  }`}
                />
              ))}
              {tasks.length > 10 && <span className="text-xs text-muted-foreground ml-1">+{tasks.length - 10}</span>}
            </div>
          </div>
        )}

        {/* Navigation arrows */}
        {!loading && tasks.length > 1 && !isEnd && (
          <>
            {currentIndex > 0 && (
              <button onClick={goPrev} className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-background/80 border border-border hover:bg-muted transition-colors shadow-sm">
                <ChevronLeft size={16} />
              </button>
            )}
            {currentIndex < tasks.length - 1 && (
              <button onClick={goNext} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-background/80 border border-border hover:bg-muted transition-colors shadow-sm">
                <ChevronRight size={16} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
