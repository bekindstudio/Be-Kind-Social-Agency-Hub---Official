import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { portalFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { cn, formatDate } from "@/lib/utils";
import { Send, Mail, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

/* Pagina "Comunicazioni" — invio email ai clienti da un unico punto
   (richieste materiale / notifiche / promemoria) + storico. */

type AnyObj = Record<string, any>;

const TYPES: { value: string; label: string; color: string }[] = [
  { value: "richiesta", label: "Richiesta materiale", color: "bg-sky-500" },
  { value: "notifica", label: "Notifica", color: "bg-emerald-500" },
  { value: "promemoria", label: "Promemoria", color: "bg-amber-500" },
];
const TYPE_LABEL = (v: string | null) => TYPES.find((t) => t.value === v)?.label ?? "Comunicazione";
const TYPE_COLOR = (v: string | null) => TYPES.find((t) => t.value === v)?.color ?? "bg-muted-foreground/40";

function template(type: string, clientName: string): { subject: string; message: string } {
  const ciao = `Ciao ${clientName || ""}`.trim() + ",";
  if (type === "richiesta") {
    return {
      subject: "Ci servono alcuni materiali",
      message: `${ciao}\nper procedere con le attività avremmo bisogno del seguente materiale:\n- \n- \n\nPuoi inviarcelo appena possibile? Grazie!\nBe Kind Social Agency`,
    };
  }
  if (type === "promemoria") {
    return {
      subject: "Promemoria",
      message: `${ciao}\nti ricordiamo che...\n\nA presto,\nBe Kind Social Agency`,
    };
  }
  return {
    subject: "Aggiornamento",
    message: `${ciao}\nvolevamo aggiornarti che...\n\nA presto,\nBe Kind Social Agency`,
  };
}

function useApi<T>(key: (string | number)[], path: string, staleSec = 120): T | null {
  const q = useQuery({
    queryKey: key,
    staleTime: staleSec * 1000,
    queryFn: async () => {
      const r = await portalFetch(path, { credentials: "include" });
      if (!r.ok) return null as any;
      return r.json();
    },
  });
  return (q.data as T) ?? null;
}

export default function CommunicationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const clients = useApi<AnyObj[]>(["comm", "clients"], "/api/clients", 300) ?? [];
  const smtp = useApi<{ configured: boolean; verified: boolean }>(["comm", "smtp"], "/api/email-notifications/smtp-status", 300);

  const historyQ = useQuery({
    queryKey: ["comm", "history"],
    staleTime: 30_000,
    queryFn: async () => {
      const r = await portalFetch("/api/client-communications?limit=100", { credentials: "include" });
      if (!r.ok) return [] as AnyObj[];
      return r.json();
    },
  });
  const history: AnyObj[] = Array.isArray(historyQ.data) ? historyQ.data : [];

  const [clientId, setClientId] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState("richiesta");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const selectedClient = useMemo(() => clients.find((c) => String(c.id) === clientId), [clients, clientId]);

  const onSelectClient = (id: string) => {
    setClientId(id);
    const c = clients.find((x) => String(x.id) === id);
    setTo(c?.email ? String(c.email) : "");
  };

  const applyTemplate = (t: string) => {
    setType(t);
    const tpl = template(t, selectedClient?.name ?? "");
    setSubject(tpl.subject);
    setMessage(tpl.message);
  };

  const send = async () => {
    if (!clientId) { toast({ variant: "destructive", title: "Scegli un cliente" }); return; }
    if (!to.trim()) { toast({ variant: "destructive", title: "Manca l'email del destinatario" }); return; }
    if (!subject.trim() || !message.trim()) { toast({ variant: "destructive", title: "Compila oggetto e messaggio" }); return; }
    setSending(true);
    try {
      const r = await portalFetch("/api/client-communications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: Number(clientId), to: to.trim(), type, subject: subject.trim(), message: message.trim() }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { toast({ variant: "destructive", title: data?.error ?? "Invio non riuscito" }); return; }
      queryClient.invalidateQueries({ queryKey: ["comm", "history"] });
      if (data?.sent) toast({ title: "✓ Email inviata" });
      else toast({ title: "Registrata (SMTP non configurato: email non inviata)" });
      setSubject(""); setMessage("");
    } catch {
      toast({ variant: "destructive", title: "Errore di rete" });
    } finally {
      setSending(false);
    }
  };

  const sentCount = history.filter((h) => h.sent).length;

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-5xl mx-auto">
        {/* Hero */}
        <div className="mb-6">
          <p className="text-sm text-muted-foreground inline-flex items-center gap-2"><Send size={16} className="text-primary" /> Comunicazioni clienti</p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight mt-1">
            Scrivi ai tuoi clienti da un unico posto
          </h1>
          <p className="text-sm text-muted-foreground mt-2">{sentCount} email inviate · {history.length} comunicazioni registrate</p>
        </div>

        {/* Stato SMTP */}
        {smtp && !smtp.configured && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-amber-900">Email non configurata</p>
              <p className="text-amber-800/90 text-xs mt-0.5">Senza SMTP le comunicazioni vengono registrate ma <strong>non partono</strong>. Configura l'invio email in Impostazioni → Email automatiche.</p>
            </div>
          </div>
        )}
        {smtp?.configured && !smtp.verified && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
            <AlertTriangle size={16} className="text-amber-600 shrink-0" /> SMTP configurato ma non verificato: l'invio potrebbe fallire.
          </div>
        )}

        {/* Compositore */}
        <div className="rounded-2xl border border-card-border bg-card p-4 md:p-5 mb-6">
          <p className="text-sm font-semibold mb-3 inline-flex items-center gap-2"><Mail size={15} className="text-primary" /> Nuova comunicazione</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-xs font-medium text-muted-foreground">
              Cliente
              <select value={clientId} onChange={(e) => onSelectClient(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground">
                <option value="">— Scegli un cliente —</option>
                {clients.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Email destinatario
              <input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="email@cliente.it" className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground" />
            </label>
          </div>

          {/* Tipo + template rapido */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Tipo:</span>
            {TYPES.map((t) => (
              <button key={t.value} type="button" onClick={() => applyTemplate(t.value)} className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border", type === t.value ? "border-primary bg-primary/5 text-foreground" : "border-input text-muted-foreground hover:text-foreground")}>
                <span className={cn("w-2 h-2 rounded-full", t.color)} /> {t.label}
              </button>
            ))}
            <span className="text-[11px] text-muted-foreground/70">(precompila un modello)</span>
          </div>

          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Oggetto" className="mt-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground" />
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Messaggio…" rows={7} className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground resize-y" />

          <div className="mt-3 flex items-center justify-end">
            <button type="button" onClick={send} disabled={sending} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
              <Send size={15} /> {sending ? "Invio…" : "Invia email"}
            </button>
          </div>
        </div>

        {/* Storico */}
        <div className="rounded-2xl border border-card-border bg-card p-4 md:p-5">
          <p className="text-sm font-semibold mb-3 inline-flex items-center gap-2"><Clock size={15} className="text-primary" /> Storico comunicazioni</p>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Ancora nessuna comunicazione. Inviane una qui sopra.</p>
          ) : (
            <div className="divide-y divide-card-border/50">
              {history.map((h) => (
                <div key={h.id} className="flex items-start gap-3 py-3">
                  <span className={cn("w-2.5 h-2.5 rounded-full shrink-0 mt-1.5", TYPE_COLOR(h.type))} title={TYPE_LABEL(h.type)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{h.subject}</p>
                    <p className="text-xs text-muted-foreground truncate">{h.clientName ?? "Cliente"} · {h.to} · {TYPE_LABEL(h.type)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">{h.createdAt ? formatDate(h.createdAt) : ""}</p>
                    {h.sent
                      ? <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600"><CheckCircle2 size={12} /> inviata</span>
                      : <span className="inline-flex items-center gap-1 text-[11px] text-amber-600"><AlertTriangle size={12} /> non inviata</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
