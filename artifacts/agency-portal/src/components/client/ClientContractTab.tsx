import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { portalFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { ContractRichEditor } from "@/components/contracts/ContractRichEditor";
import { applyContractVariables, DEFAULT_AGENCY, SERVICE_LABELS, todayIt, type ServiceSlug } from "@/lib/contracts-shared";
import { cn } from "@/lib/utils";
import {
  FileSignature, Plus, Send, Download, Pencil, Trash2, Loader2, X,
  ShieldCheck, MessageSquare, CheckCircle2, XCircle, ChevronDown, ChevronUp,
} from "lucide-react";

/**
 * Tab "Contratto" nella scheda cliente (Wave DP): crea un contratto da template,
 * modificalo, invialo al portale del cliente (email automatica), gestisci le
 * proposte di modifica e scarica il PDF. Dopo la firma mostra l'audit trail.
 */

type ContractDoc = {
  id: string; contractNumber: string; clientId: number | null; clientName: string;
  serviceType: string; content: string; status: string; value: string | null;
  startDate: string | null; endDate: string | null;
  sentAt: string | null; signedAt: string | null; signedName: string | null;
  signedIp: string | null; signedHash: string | null; vexatiousAcceptedAt: string | null;
};
type Template = { id: number; name: string; type: string; content: string; status: string };
type ChangeRequest = { id: number; message: string; status: string; reply: string | null; createdAt: string };

const STATUS_META: Record<string, { label: string; cls: string }> = {
  bozza: { label: "Bozza", cls: "bg-gray-100 text-gray-600" },
  inviato: { label: "Inviato — in attesa di firma", cls: "bg-amber-100 text-amber-700" },
  firmato: { label: "Firmato", cls: "bg-emerald-100 text-emerald-700" },
  scaduto: { label: "Scaduto", cls: "bg-rose-100 text-rose-700" },
};

export function ClientContractTab({ clientId, clientName, clientEmail }: {
  clientId: number; clientName: string; clientEmail: string | null;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const pdfRef = useRef<HTMLDivElement | null>(null);
  const [pdfContent, setPdfContent] = useState<string | null>(null);

  const [showNew, setShowNew] = useState(false);
  const [templateId, setTemplateId] = useState<string>("");
  const [creating, setCreating] = useState(false);

  const [editing, setEditing] = useState<ContractDoc | null>(null);
  const [draft, setDraft] = useState("");
  const [draftValue, setDraftValue] = useState("");
  const [draftStart, setDraftStart] = useState("");
  const [draftEnd, setDraftEnd] = useState("");
  const [saving, setSaving] = useState(false);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: contracts = [], isLoading } = useQuery<ContractDoc[]>({
    queryKey: ["client-contract-docs", clientId],
    queryFn: async () => {
      const r = await portalFetch(`/api/contract-documents?clientId=${clientId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 15_000,
  });

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["contract-templates"],
    queryFn: async () => {
      const r = await portalFetch("/api/contracts", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 60_000,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["client-contract-docs", clientId] });

  const createFromTemplate = async () => {
    const tpl = templates.find((t) => String(t.id) === templateId);
    setCreating(true);
    try {
      // Variabili: dati reali del cliente + agenzia. L'IBAN NON viene compilato
      // in automatico (placeholder da verificare a mano prima dell'invio).
      const { AGENZIA_IBAN: _iban, ...agency } = DEFAULT_AGENCY;
      const content = tpl
        ? applyContractVariables(tpl.content, {
            ...agency,
            NOME_CLIENTE: clientName,
            EMAIL_CLIENTE: clientEmail ?? "",
            DATA_ODIERNA: todayIt(),
          })
        : `<h2>Contratto — ${clientName}</h2><p>Scrivi qui il testo del contratto…</p>`;
      const r = await portalFetch("/api/contract-documents", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          clientName,
          clientEmail: clientEmail ?? null,
          serviceType: tpl?.type ?? "consulenza",
          content,
          templateId: tpl?.id ?? null,
        }),
      });
      if (!r.ok) throw new Error();
      toast({ title: "Contratto creato in bozza" });
      setShowNew(false); setTemplateId("");
      refresh();
    } catch {
      toast({ variant: "destructive", title: "Creazione non riuscita" });
    } finally { setCreating(false); }
  };

  const openEdit = (c: ContractDoc) => {
    setEditing(c); setDraft(c.content);
    setDraftValue(c.value ?? ""); setDraftStart(c.startDate ?? ""); setDraftEnd(c.endDate ?? "");
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const r = await portalFetch(`/api/contract-documents/${editing.id}`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: draft,
          value: draftValue.trim() ? draftValue.trim() : null,
          startDate: draftStart || null,
          endDate: draftEnd || null,
        }),
      });
      if (!r.ok) throw new Error();
      toast({ title: "Contratto salvato" });
      setEditing(null);
      refresh();
    } catch {
      toast({ variant: "destructive", title: "Salvataggio non riuscito" });
    } finally { setSaving(false); }
  };

  const sendToPortal = async (c: ContractDoc) => {
    if (!confirm(`Inviare il contratto ${c.contractNumber} al portale di ${clientName}?${clientEmail ? ` Verrà avvisato via email (${clientEmail}).` : " Il cliente non ha email: lo vedrà al prossimo accesso al portale."}`)) return;
    setBusyId(c.id);
    try {
      const r = await portalFetch(`/api/contract-documents/${c.id}/send`, { method: "POST", credentials: "include" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { toast({ variant: "destructive", title: data?.error ?? "Invio non riuscito" }); return; }
      toast({ title: "Contratto inviato al portale", description: data?.emailSent ? "Email di avviso inviata al cliente." : "Email non inviata (SMTP non configurato o email mancante): avvisa tu il cliente." });
      refresh();
    } finally { setBusyId(null); }
  };

  const removeDoc = async (c: ContractDoc) => {
    if (!confirm(`Spostare nel cestino il contratto ${c.contractNumber}?`)) return;
    setBusyId(c.id);
    try {
      const r = await portalFetch(`/api/contract-documents/${c.id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) { toast({ variant: "destructive", title: "Eliminazione non riuscita" }); return; }
      toast({ title: "Contratto spostato nel cestino" });
      refresh();
    } finally { setBusyId(null); }
  };

  const downloadPdf = async (c: ContractDoc) => {
    setPdfContent(c.content);
    // aspetta il render del contenuto nascosto
    await new Promise((r) => setTimeout(r, 60));
    if (!pdfRef.current) return;
    try {
      const { exportContractElementToPdf } = await import("@/lib/contract-pdf");
      await exportContractElementToPdf(pdfRef.current, `Contratto-${c.contractNumber}.pdf`);
    } catch {
      toast({ variant: "destructive", title: "Esportazione PDF non riuscita" });
    } finally {
      setPdfContent(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-card-border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-sm flex items-center gap-2"><FileSignature size={15} className="text-primary" /> Contratti di {clientName}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Crea da un modello, invia al portale, gestisci le proposte del cliente e la firma.</p>
          </div>
          <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 shrink-0">
            <Plus size={13} /> Nuovo contratto
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Caricamento…</p>
      ) : contracts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-card-border bg-card p-8 text-center">
          <FileSignature size={28} className="mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm font-medium">Nessun contratto per questo cliente</p>
          <p className="text-xs text-muted-foreground mt-1">Creane uno da un modello e invialo al portale per la firma.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {contracts.map((c) => (
            <ContractCard
              key={c.id}
              doc={c}
              busy={busyId === c.id}
              expanded={expanded === c.id}
              onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
              onEdit={() => openEdit(c)}
              onSend={() => void sendToPortal(c)}
              onPdf={() => void downloadPdf(c)}
              onDelete={() => void removeDoc(c)}
            />
          ))}
        </div>
      )}

      {/* Render nascosto per l'export PDF */}
      {pdfContent != null && (
        <div className="fixed -left-[10000px] top-0 w-[794px] bg-white p-10 text-black" aria-hidden>
          <div ref={pdfRef} dangerouslySetInnerHTML={{ __html: pdfContent }} />
        </div>
      )}

      {/* Dialog nuovo contratto */}
      {showNew && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={() => setShowNew(false)}>
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Nuovo contratto per {clientName}</h3>
              <button onClick={() => setShowNew(false)} className="rounded p-1 text-muted-foreground hover:bg-muted"><X size={14} /></button>
            </div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Modello di partenza</label>
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}
              className="w-full mt-1 mb-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none">
              <option value="">Contratto vuoto</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name} · {SERVICE_LABELS[t.type as ServiceSlug]?.title ?? t.type}</option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground mb-4">Le variabili del modello (nome cliente, email, data, dati agenzia) vengono compilate coi dati reali. L'IBAN va inserito a mano prima dell'invio.</p>
            <button onClick={() => void createFromTemplate()} disabled={creating}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Crea in bozza
            </button>
          </div>
        </div>
      )}

      {/* Dialog modifica */}
      {editing && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Modifica {editing.contractNumber}</h3>
              <button onClick={() => setEditing(null)} className="rounded p-1 text-muted-foreground hover:bg-muted"><X size={14} /></button>
            </div>
            {editing.status === "firmato" && (
              <p className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                Questo contratto è già firmato: modificarlo non cambia il testo accettato dal cliente (l'impronta firmata resta quella originale). Per variazioni, crea un nuovo contratto o un'appendice.
              </p>
            )}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Importo (€)</label>
                <input value={draftValue} onChange={(e) => setDraftValue(e.target.value)} placeholder="es. 825"
                  className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Inizio</label>
                <input type="date" value={draftStart} onChange={(e) => setDraftStart(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Fine</label>
                <input type="date" value={draftEnd} onChange={(e) => setDraftEnd(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" />
              </div>
            </div>
            <ContractRichEditor value={draft} onChange={setDraft} />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="rounded-lg border border-input px-3 py-2 text-sm">Annulla</button>
              <button onClick={() => void saveEdit()} disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                {saving ? <Loader2 size={14} className="animate-spin" /> : null} Salva
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ContractCard({ doc, busy, expanded, onToggle, onEdit, onSend, onPdf, onDelete }: {
  doc: ContractDoc; busy: boolean; expanded: boolean;
  onToggle: () => void; onEdit: () => void; onSend: () => void; onPdf: () => void; onDelete: () => void;
}) {
  const meta = STATUS_META[doc.status] ?? STATUS_META.bozza;
  return (
    <div className="rounded-xl border border-card-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm">{doc.contractNumber}</p>
            <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-medium", meta.cls)}>{meta.label}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {doc.value ? `€ ${doc.value}` : "Importo non indicato"}
            {doc.startDate ? ` · dal ${new Date(doc.startDate).toLocaleDateString("it-IT")}` : ""}
            {doc.endDate ? ` al ${new Date(doc.endDate).toLocaleDateString("it-IT")}` : ""}
            {doc.sentAt ? ` · inviato il ${new Date(doc.sentAt).toLocaleDateString("it-IT")}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {doc.status !== "firmato" && (
            <button onClick={onEdit} title="Modifica" className="rounded-lg border border-input p-1.5 text-muted-foreground hover:text-foreground"><Pencil size={13} /></button>
          )}
          <button onClick={onPdf} title="Scarica PDF" className="rounded-lg border border-input p-1.5 text-muted-foreground hover:text-foreground"><Download size={13} /></button>
          {doc.status !== "firmato" && (
            <button onClick={onSend} disabled={busy} title="Invia al portale"
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} {doc.status === "inviato" ? "Reinvia" : "Invia"}
            </button>
          )}
          <button onClick={onDelete} disabled={busy} title="Cestino" className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 size={13} /></button>
        </div>
      </div>

      {doc.status === "firmato" && (
        <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800">
          <p className="font-semibold flex items-center gap-1.5"><ShieldCheck size={13} /> Firmato da {doc.signedName} il {doc.signedAt ? new Date(doc.signedAt).toLocaleString("it-IT") : ""}</p>
          <p className="mt-0.5 text-emerald-700/80">
            Clausole 1341-1342 approvate {doc.vexatiousAcceptedAt ? `il ${new Date(doc.vexatiousAcceptedAt).toLocaleString("it-IT")}` : ""} · IP {doc.signedIp ?? "n/d"} · impronta testo {doc.signedHash ? `${doc.signedHash.slice(0, 12)}…` : "n/d"}
          </p>
        </div>
      )}

      <button onClick={onToggle} className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        <MessageSquare size={13} /> Proposte di modifica del cliente
      </button>
      {expanded && <ChangeRequests contractId={doc.id} />}
    </div>
  );
}

function ChangeRequests({ contractId }: { contractId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<number | null>(null);

  const { data: requests = [], isLoading } = useQuery<ChangeRequest[]>({
    queryKey: ["contract-change-requests", contractId],
    queryFn: async () => {
      const r = await portalFetch(`/api/contract-documents/${contractId}/change-requests`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 10_000,
  });

  const decide = async (id: number, status: "accettata" | "rifiutata") => {
    const reply = prompt(status === "accettata"
      ? "Risposta al cliente (facoltativa) — es. cosa modificherai nel contratto:"
      : "Motivo del rifiuto (facoltativo, il cliente lo leggerà):") ?? "";
    setBusyId(id);
    try {
      const r = await portalFetch(`/api/contract-documents/change-requests/${id}`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reply: reply.trim() || null }),
      });
      if (!r.ok) { toast({ variant: "destructive", title: "Operazione non riuscita" }); return; }
      toast({ title: status === "accettata" ? "Proposta accettata — ricordati di aggiornare il testo e reinviare" : "Proposta rifiutata" });
      qc.invalidateQueries({ queryKey: ["contract-change-requests", contractId] });
    } finally { setBusyId(null); }
  };

  if (isLoading) return <p className="mt-2 text-xs text-muted-foreground">Caricamento…</p>;
  if (requests.length === 0) return <p className="mt-2 text-xs text-muted-foreground">Nessuna proposta dal cliente.</p>;

  return (
    <div className="mt-2 space-y-2">
      {requests.map((r) => (
        <div key={r.id} className="rounded-lg border border-card-border/70 bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">{new Date(r.createdAt).toLocaleString("it-IT")}</span>
            {r.status === "proposta" ? (
              <div className="flex items-center gap-1.5">
                <button onClick={() => void decide(r.id, "accettata")} disabled={busyId === r.id}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50">
                  <CheckCircle2 size={11} /> Accetta
                </button>
                <button onClick={() => void decide(r.id, "rifiutata")} disabled={busyId === r.id}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-2 py-1 text-[11px] font-semibold text-red-600 disabled:opacity-50">
                  <XCircle size={11} /> Rifiuta
                </button>
              </div>
            ) : (
              <span className={cn("text-[11px] font-semibold", r.status === "accettata" ? "text-emerald-600" : "text-red-600")}>
                {r.status === "accettata" ? "Accettata" : "Rifiutata"}
              </span>
            )}
          </div>
          <p className="text-sm mt-1 whitespace-pre-wrap">{r.message}</p>
          {r.reply && <p className="text-xs mt-1.5 text-muted-foreground whitespace-pre-wrap"><span className="font-semibold">Risposta:</span> {r.reply}</p>}
        </div>
      ))}
    </div>
  );
}
