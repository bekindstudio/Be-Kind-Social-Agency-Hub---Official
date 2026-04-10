import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useListContractTemplates,
  useCreateContractTemplate,
  useUpdateContractTemplate,
  useDeleteContractTemplate,
  getListContractTemplatesQueryKey,
  useListClients,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import {
  Plus, Trash2, Pencil, X, Eye, FileText, Copy, Printer,
  AlertTriangle, CalendarClock, ChevronDown, ChevronRight, Check,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

// ─── Agency data (precompilati) ──────────────────────────────────────────────
const AGENZIA = {
  nome: "Michael Balleroni",
  cf: "BLLMHL95D22C357W",
  piva: "02871720419",
  indirizzo: "Via C. Menotti, 184 - 61122 Pesaro",
  sdi: "M5UXCR1",
  pec: "michaelballeroni@pec.it",
  iban: "IT60X0542811101000000123456",
};

// ─── Types ────────────────────────────────────────────────────────────────────
type ContractStato = "bozza" | "inviato" | "firmato" | "scaduto" | "rescisso";

type Tranche = { id: string; data: string; importo: number; descrizione: string };
type Servizio = { id: string; titolo: string; attiva: boolean; descrizione: string; canali?: string[]; piattaforme?: string[]; frequenza?: string; quantitaMin?: number };
type Clausole = { durata: string; rescissione: string; budget: string; materiali: string; riservatezza: string; postazione: string; operativita: string; diritti: string; dispute: string };

type Contract = {
  id: number;
  numero: string;
  clientId: number;
  clientName: string;
  referenteCliente?: string | null;
  oggetto: string;
  dataStipula: string;
  dataInizio: string;
  dataFine: string;
  preavvisoGiorni: number;
  serviziJson: string;
  tranchePagamentoJson: string;
  importoTotale: number;
  clausoleJson: string;
  noteIva?: string | null;
  iban?: string | null;
  marcaDaBollo: number;
  stato: string;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);
const fmtEur = (cents: number) => `€ ${(cents / 100).toLocaleString("it-IT", { minimumFractionDigits: 2 })}`;
const daysUntil = (dateStr: string) => Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);

const STATO_STYLES: Record<string, string> = {
  bozza: "bg-gray-100 text-gray-600",
  inviato: "bg-amber-100 text-amber-700",
  firmato: "bg-green-100 text-green-700",
  scaduto: "bg-red-100 text-red-700",
  rescisso: "bg-gray-200 text-gray-700",
};
const STATO_LABELS: Record<string, string> = {
  bozza: "Bozza", inviato: "Inviato", firmato: "Firmato", scaduto: "Scaduto", rescisso: "Rescisso",
};

const MACRO_SERVIZI = [
  "Analisi e Strategia", "Produzione Contenuti", "Gestione Social",
  "Campagne Advertising", "Reportistica", "Eventi e Copertura", "Materiali di Supporto", "Altro",
];
const CANALI_SOCIAL = ["Facebook", "Instagram", "LinkedIn", "TikTok"];
const PIATTAFORME_ADV = ["Meta Ads", "Google Ads"];

function defaultClausole(dataInizio: string, dataFine: string, preavviso: number, cittaCliente?: string): Clausole {
  return {
    durata: `Il presente contratto ha durata dal ${dataInizio} al ${dataFine}, con rinnovo tacito salvo disdetta.`,
    rescissione: `Ciascuna parte potrà recedere dal contratto con preavviso scritto di ${preavviso} giorni.`,
    budget: "Il budget pubblicitario è concordato separatamente e non è incluso nel presente corrispettivo.",
    materiali: "I materiali prodotti sono di proprietà esclusiva del cliente al saldo completo del corrispettivo.",
    riservatezza: "Le parti si impegnano a mantenere riservate le informazioni acquisite nell'ambito del contratto.",
    postazione: "L'attività si svolge da remoto. L'agenzia garantisce supporto via WhatsApp lun-ven 9-18.",
    operativita: "Il cliente si impegna a fornire accessi agli account e materiali necessari entro 5 giorni dalla richiesta.",
    diritti: "L'agenzia risponde esclusivamente delle attività esplicitamente previste dal presente contratto.",
    dispute: `Per qualsiasi controversia è competente il Foro di ${cittaCliente || "Pesaro"}.`,
  };
}

// ─── API hooks (manual) ──────────────────────────────────────────────────────
const BASE = "/api";

function useContracts() {
  return useQuery<Contract[]>({
    queryKey: ["client-contracts"],
    queryFn: () => fetch(`${BASE}/client-contracts`).then((r) => r.json()),
  });
}

function useCreateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Contract>) =>
      fetch(`${BASE}/client-contracts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-contracts"] }),
  });
}

function useUpdateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Contract> }) =>
      fetch(`${BASE}/client-contracts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-contracts"] }),
  });
}

function useDeleteContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fetch(`${BASE}/client-contracts/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-contracts"] }),
  });
}

function useDuplicateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fetch(`${BASE}/client-contracts/${id}/duplicate`, { method: "POST" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-contracts"] }),
  });
}

// ─── Servizi editor ───────────────────────────────────────────────────────────
function ServiziEditor({ servizi, onChange }: { servizi: Servizio[]; onChange: (s: Servizio[]) => void }) {
  const addServizio = (titolo: string) => {
    onChange([...servizi, { id: uid(), titolo, attiva: true, descrizione: "", canali: [], piattaforme: [], frequenza: "", quantitaMin: undefined }]);
  };
  const update = (id: string, patch: Partial<Servizio>) => onChange(servizi.map((s) => s.id === id ? { ...s, ...patch } : s));
  const remove = (id: string) => onChange(servizi.filter((s) => s.id !== id));

  const available = MACRO_SERVIZI.filter((m) => !servizi.find((s) => s.titolo === m));

  return (
    <div className="space-y-3">
      {servizi.map((s) => (
        <div key={s.id} className="border border-card-border rounded-lg p-3 bg-muted/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-primary">{s.titolo}</span>
            <button onClick={() => remove(s.id)} className="text-muted-foreground hover:text-destructive"><X size={13} /></button>
          </div>
          <textarea
            className="w-full text-xs border border-input rounded-lg px-2 py-1.5 bg-background resize-none focus:outline-none"
            rows={2}
            placeholder="Descrizione attività..."
            value={s.descrizione}
            onChange={(e) => update(s.id, { descrizione: e.target.value })}
          />
          {s.titolo === "Gestione Social" && (
            <div className="mt-2">
              <p className="text-[11px] text-muted-foreground mb-1">Canali</p>
              <div className="flex flex-wrap gap-1.5">
                {CANALI_SOCIAL.map((c) => (
                  <button key={c} onClick={() => update(s.id, { canali: s.canali?.includes(c) ? s.canali.filter((x) => x !== c) : [...(s.canali ?? []), c] })}
                    className={cn("text-[11px] px-2 py-0.5 rounded-full border transition-colors", s.canali?.includes(c) ? "bg-primary text-primary-foreground border-primary" : "border-input text-muted-foreground hover:border-primary/50")}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}
          {s.titolo === "Campagne Advertising" && (
            <div className="mt-2">
              <p className="text-[11px] text-muted-foreground mb-1">Piattaforme</p>
              <div className="flex gap-1.5">
                {PIATTAFORME_ADV.map((p) => (
                  <button key={p} onClick={() => update(s.id, { piattaforme: s.piattaforme?.includes(p) ? s.piattaforme.filter((x) => x !== p) : [...(s.piattaforme ?? []), p] })}
                    className={cn("text-[11px] px-2 py-0.5 rounded-full border transition-colors", s.piattaforme?.includes(p) ? "bg-primary text-primary-foreground border-primary" : "border-input text-muted-foreground hover:border-primary/50")}>
                    {p}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 italic">Budget pubblicitario escluso e definito separatamente.</p>
            </div>
          )}
          {s.titolo === "Produzione Contenuti" && (
            <div className="mt-2 flex items-center gap-2">
              <label className="text-[11px] text-muted-foreground">Contenuti minimi/settimana:</label>
              <input type="number" min={1} className="w-16 text-xs border border-input rounded px-2 py-0.5 bg-background" value={s.quantitaMin ?? ""} onChange={(e) => update(s.id, { quantitaMin: Number(e.target.value) })} />
            </div>
          )}
          {(s.titolo === "Reportistica" || s.titolo === "Gestione Social") && (
            <div className="mt-2 flex items-center gap-2">
              <label className="text-[11px] text-muted-foreground">{s.titolo === "Reportistica" ? "Frequenza report:" : "Frequenza post:"}</label>
              <select className="text-xs border border-input rounded px-2 py-0.5 bg-background" value={s.frequenza ?? ""} onChange={(e) => update(s.id, { frequenza: e.target.value })}>
                <option value="">Seleziona...</option>
                <option value="settimanale">Settimanale</option>
                <option value="mensile">Mensile</option>
                <option value="trimestrale">Trimestrale</option>
                <option value="finale">Finale</option>
              </select>
            </div>
          )}
        </div>
      ))}
      {available.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {available.map((m) => (
            <button key={m} onClick={() => addServizio(m)} className="text-xs border border-dashed border-primary/40 text-primary/70 hover:border-primary hover:text-primary px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
              <Plus size={11} /> {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tranche editor ───────────────────────────────────────────────────────────
function TrancheEditor({ tranche, onChange }: { tranche: Tranche[]; onChange: (t: Tranche[]) => void }) {
  const add = () => onChange([...tranche, { id: uid(), data: "", importo: 0, descrizione: "" }]);
  const update = (id: string, patch: Partial<Tranche>) => onChange(tranche.map((t) => t.id === id ? { ...t, ...patch } : t));
  const remove = (id: string) => onChange(tranche.filter((t) => t.id !== id));

  return (
    <div className="space-y-2">
      {tranche.map((t, i) => (
        <div key={t.id} className="flex gap-2 items-center">
          <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}.</span>
          <input type="date" className="text-xs border border-input rounded px-2 py-1.5 bg-background focus:outline-none" value={t.data} onChange={(e) => update(t.id, { data: e.target.value })} />
          <input className="flex-1 text-xs border border-input rounded px-2 py-1.5 bg-background focus:outline-none" placeholder="Descrizione tranche..." value={t.descrizione} onChange={(e) => update(t.id, { descrizione: e.target.value })} />
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
            <input type="number" min={0} className="w-24 text-xs border border-input rounded pl-5 pr-2 py-1.5 bg-background focus:outline-none" value={t.importo / 100 || ""} onChange={(e) => update(t.id, { importo: Math.round(Number(e.target.value) * 100) })} placeholder="0.00" />
          </div>
          <button onClick={() => remove(t.id)} className="text-muted-foreground hover:text-destructive"><X size={13} /></button>
        </div>
      ))}
      <button onClick={add} className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"><Plus size={11} /> Aggiungi tranche</button>
    </div>
  );
}

// ─── Clausole editor ──────────────────────────────────────────────────────────
function ClausoleEditor({ clausole, onChange }: { clausole: Clausole; onChange: (c: Clausole) => void }) {
  const fields: { key: keyof Clausole; label: string }[] = [
    { key: "durata", label: "Durata contratto" },
    { key: "rescissione", label: "Rescissione anticipata" },
    { key: "budget", label: "Budget pubblicitario" },
    { key: "materiali", label: "Proprietà dei materiali" },
    { key: "riservatezza", label: "Riservatezza" },
    { key: "postazione", label: "Postazione di lavoro" },
    { key: "operativita", label: "Operatività e accesso account" },
    { key: "diritti", label: "Diritti e responsabilità" },
    { key: "dispute", label: "Risoluzione delle dispute" },
  ];
  return (
    <div className="space-y-3">
      {fields.map(({ key, label }) => (
        <div key={key}>
          <label className="text-xs font-medium text-muted-foreground">{label}</label>
          <textarea
            className="w-full mt-1 text-xs border border-input rounded-lg px-2 py-1.5 bg-background resize-none focus:outline-none"
            rows={2}
            value={clausole[key]}
            onChange={(e) => onChange({ ...clausole, [key]: e.target.value })}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Contract Preview (document view) ────────────────────────────────────────
function ContractPreview({ contract, clientData }: { contract: FormState; clientData?: { piva?: string | null; codiceFiscale?: string | null; indirizzo?: string | null; citta?: string | null } }) {
  const servizi: Servizio[] = contract.servizi;
  const tranche: Tranche[] = contract.tranche;
  const clausole: Clausole = contract.clausole;
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString("it-IT") : "—";

  return (
    <div id="contract-print" className="font-serif text-[13px] leading-relaxed text-gray-900 space-y-4 max-w-2xl mx-auto">
      {/* Header agenzia */}
      <div className="text-center border-b pb-4">
        <p className="font-bold text-base">{AGENZIA.nome}</p>
        <p>{AGENZIA.indirizzo}</p>
        <p>P.IVA {AGENZIA.piva} – C.F. {AGENZIA.cf}</p>
        <p>SDI {AGENZIA.sdi} – PEC {AGENZIA.pec}</p>
      </div>

      <h2 className="text-center font-bold text-lg uppercase tracking-wide">{contract.oggetto}</h2>

      {/* Parti */}
      <div className="space-y-2">
        <p><strong>Tra:</strong> {AGENZIA.nome}, P.IVA {AGENZIA.piva}, con sede in {AGENZIA.indirizzo}</p>
        <p><strong>E:</strong> {contract.clientName}, {clientData?.indirizzo ? `con sede in ${clientData.indirizzo}${clientData.citta ? `, ${clientData.citta}` : ""}` : ""}{clientData?.piva ? `, P.IVA ${clientData.piva}` : clientData?.codiceFiscale ? `, C.F. ${clientData.codiceFiscale}` : ""}
          {contract.referenteCliente ? ` – Referente: ${contract.referenteCliente}` : ""}
        </p>
        <p className="font-medium">Si conviene quanto segue:</p>
      </div>

      {/* Articoli */}
      <div className="space-y-3">
        <section><strong>1. Durata</strong><p>{clausole.durata}</p></section>

        <section>
          <strong>2. Servizi Offerti</strong>
          {servizi.map((s, i) => (
            <div key={s.id} className="ml-3 mt-1">
              <p className="font-semibold">2.{i + 1} {s.titolo}</p>
              {s.descrizione && <p className="ml-3">{s.descrizione}</p>}
              {s.canali && s.canali.length > 0 && <p className="ml-3 italic">Canali: {s.canali.join(", ")}</p>}
              {s.piattaforme && s.piattaforme.length > 0 && <p className="ml-3 italic">Piattaforme: {s.piattaforme.join(", ")}</p>}
              {s.frequenza && <p className="ml-3 italic">Frequenza: {s.frequenza}</p>}
              {s.quantitaMin && <p className="ml-3 italic">Min. contenuti/settimana: {s.quantitaMin}</p>}
            </div>
          ))}
          {servizi.length === 0 && <p className="ml-3 text-muted-foreground italic">Nessun servizio specificato.</p>}
        </section>

        <section>
          <strong>3. Corrispettivo e Modalità di Pagamento</strong>
          <p>Importo totale: <strong>{fmtEur(contract.importoTotale)}</strong></p>
          {tranche.length > 0 && (
            <ul className="ml-3 mt-1 list-disc list-inside space-y-0.5">
              {tranche.map((t, i) => (
                <li key={t.id}>{i + 1}^ tranche entro {fmtDate(t.data)}: {fmtEur(t.importo)} {t.descrizione ? `– ${t.descrizione}` : ""}</li>
              ))}
            </ul>
          )}
          {contract.marcaDaBollo === 1 && <p className="mt-1 italic">Marca da bollo da €2,00 applicata su ogni fattura.</p>}
          <p className="mt-1 italic">{contract.noteIva}</p>
          <p className="mt-1">IBAN: {contract.iban}</p>
        </section>

        <section><strong>4. Budget Pubblicitario</strong><p>{clausole.budget}</p></section>
        <section><strong>5. Proprietà dei Materiali</strong><p>{clausole.materiali}</p></section>
        <section><strong>6. Monitoraggio e Reportistica</strong><p>L'agenzia fornisce report periodici sull'andamento delle attività previste dal contratto.</p></section>
        <section><strong>7. Postazione di Lavoro</strong><p>{clausole.postazione}</p></section>
        <section><strong>8. Diritti e Responsabilità</strong><p>{clausole.diritti}</p></section>
        <section><strong>9. Operatività</strong><p>{clausole.operativita}</p></section>
        <section><strong>10. Riservatezza</strong><p>{clausole.riservatezza}</p></section>
        <section><strong>11. Risoluzione delle Dispute</strong><p>{clausole.dispute}</p></section>
      </div>

      {/* Firma */}
      <div className="border-t pt-4 mt-4">
        <p className="mb-4">Data di stipula: <strong>{fmtDate(contract.dataStipula)}</strong> — Luogo: {AGENZIA.indirizzo.split("-")[1]?.trim() ?? "Pesaro"}</p>
        <div className="grid grid-cols-2 gap-8">
          <div>
            <p className="font-medium">Il Cliente: {contract.clientName}</p>
            <p className="mt-6 border-t border-gray-400 pt-1 text-xs">Firma per accettazione</p>
          </div>
          <div>
            <p className="font-medium">L'Agenzia: {AGENZIA.nome}</p>
            <p className="mt-6 border-t border-gray-400 pt-1 text-xs">Firma per accettazione</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Form state ───────────────────────────────────────────────────────────────
type FormState = {
  clientId: string;
  clientName: string;
  referenteCliente: string;
  oggetto: string;
  dataStipula: string;
  dataInizio: string;
  dataFine: string;
  preavvisoGiorni: number;
  servizi: Servizio[];
  tranche: Tranche[];
  importoTotale: number;
  clausole: Clausole;
  noteIva: string;
  iban: string;
  marcaDaBollo: number;
  stato: ContractStato;
  note: string;
};

const today = new Date().toISOString().slice(0, 10);
const in1y = new Date(); in1y.setFullYear(in1y.getFullYear() + 1);

const EMPTY_FORM: FormState = {
  clientId: "",
  clientName: "",
  referenteCliente: "",
  oggetto: "Contratto Gestione Social e ADV",
  dataStipula: today,
  dataInizio: today,
  dataFine: in1y.toISOString().slice(0, 10),
  preavvisoGiorni: 30,
  servizi: [],
  tranche: [],
  importoTotale: 0,
  clausole: defaultClausole(today, in1y.toISOString().slice(0, 10), 30),
  noteIva: "Importi non soggetti a IVA ai sensi dell'art. 1, commi 54-89, Legge n. 190/2014",
  iban: AGENZIA.iban,
  marcaDaBollo: 0,
  stato: "bozza",
  note: "",
};

function contractToForm(c: Contract): FormState {
  return {
    clientId: String(c.clientId),
    clientName: c.clientName,
    referenteCliente: c.referenteCliente ?? "",
    oggetto: c.oggetto,
    dataStipula: c.dataStipula,
    dataInizio: c.dataInizio,
    dataFine: c.dataFine,
    preavvisoGiorni: c.preavvisoGiorni,
    servizi: JSON.parse(c.serviziJson) as Servizio[],
    tranche: JSON.parse(c.tranchePagamentoJson) as Tranche[],
    importoTotale: c.importoTotale,
    clausole: c.clausoleJson !== "{}" ? JSON.parse(c.clausoleJson) as Clausole : defaultClausole(c.dataInizio, c.dataFine, c.preavvisoGiorni),
    noteIva: c.noteIva ?? EMPTY_FORM.noteIva,
    iban: c.iban ?? AGENZIA.iban,
    marcaDaBollo: c.marcaDaBollo,
    stato: c.stato as ContractStato,
    note: c.note ?? "",
  };
}

function formToPayload(form: FormState) {
  return {
    clientId: Number(form.clientId),
    referenteCliente: form.referenteCliente || null,
    oggetto: form.oggetto,
    dataStipula: form.dataStipula,
    dataInizio: form.dataInizio,
    dataFine: form.dataFine,
    preavvisoGiorni: form.preavvisoGiorni,
    serviziJson: JSON.stringify(form.servizi),
    tranchePagamentoJson: JSON.stringify(form.tranche),
    importoTotale: form.importoTotale,
    clausoleJson: JSON.stringify(form.clausole),
    noteIva: form.noteIva,
    iban: form.iban,
    marcaDaBollo: form.marcaDaBollo,
    stato: form.stato,
    note: form.note || null,
  };
}

// ─── Section collapsible ──────────────────────────────────────────────────────
function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-card-border rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left">
        <span className="text-sm font-semibold">{title}</span>
        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
      </button>
      {open && <div className="p-4 space-y-3">{children}</div>}
    </div>
  );
}

// ─── Main Contracts Page ──────────────────────────────────────────────────────
export default function ContractsClassic() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"contratti" | "template">("contratti");

  // Contract state
  const { data: contracts, isLoading } = useContracts();
  const { data: clients } = useListClients();
  const createContract = useCreateContract();
  const updateContract = useUpdateContract();
  const deleteContract = useDeleteContract();
  const duplicateContract = useDuplicateContract();

  const [filterStato, setFilterStato] = useState("");
  const [filterClientId, setFilterClientId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [formSection, setFormSection] = useState<"dati" | "servizi" | "pagamento" | "clausole">("dati");

  // Template state (existing system)
  const { data: templates } = useListContractTemplates();
  const createTemplate = useCreateContractTemplate();
  const updateTemplate = useUpdateContractTemplate();
  const deleteTemplate = useDeleteContractTemplate();
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editTemplateId, setEditTemplateId] = useState<number | null>(null);
  const [templateForm, setTemplateForm] = useState({ name: "", type: "Servizi", status: "bozza", content: "" });

  const clientList = useMemo(() => {
    if (!clients) return [];
    if (Array.isArray(clients)) return clients;
    // @ts-expect-error runtime safety for unknown API shape
    if (Array.isArray(clients.items)) return clients.items;
    return [clients].filter(Boolean);
  }, [clients]);

  const filtered = useMemo(() => {
    const contractList = Array.isArray(contracts)
      ? contracts
      : Array.isArray((contracts as any)?.items)
        ? (contracts as any).items
        : contracts
          ? [contracts as any]
          : [];
    return contractList.filter((c: any) => {
      const matchStato = !filterStato || c.stato === filterStato;
      const matchClient = !filterClientId || String(c.clientId) === filterClientId;
      return matchStato && matchClient;
    });
  }, [contracts, filterStato, filterClientId]);
  const contractList = Array.isArray(contracts)
    ? contracts
    : Array.isArray((contracts as any)?.items)
      ? (contracts as any).items
      : contracts
        ? [contracts as any]
        : [];
  const templateList = Array.isArray(templates)
    ? templates
    : Array.isArray((templates as any)?.items)
      ? (templates as any).items
      : templates
        ? [templates as any]
        : [];

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setFormSection("dati");
    setShowForm(true);
  };

  const openEdit = (c: Contract) => {
    setEditId(c.id);
    setForm(contractToForm(c));
    setFormSection("dati");
    setShowForm(true);
  };

  const handleClientChange = (clientId: string) => {
    const client = clientList.find((c: any) => String(c.id) === clientId);
    if (!client) { setForm((f) => ({ ...f, clientId, clientName: "" })); return; }
    const clausole = defaultClausole(form.dataInizio, form.dataFine, form.preavvisoGiorni, (client as any).citta ?? undefined);
    setForm((f) => ({ ...f, clientId, clientName: client.name, clausole }));
  };

  const handleSave = () => {
    if (!form.clientId || !form.dataStipula) return;
    const payload = formToPayload(form);
    if (editId) {
      updateContract.mutate({ id: editId, data: payload }, { onSuccess: () => { setShowForm(false); setEditId(null); } });
    } else {
      createContract.mutate(payload, { onSuccess: () => { setShowForm(false); setForm(EMPTY_FORM); } });
    }
  };

  const handleDelete = (id: number) => {
    if (!confirm("Eliminare il contratto?")) return;
    deleteContract.mutate(id);
  };

  const handleDuplicate = (id: number) => {
    duplicateContract.mutate(id, { onSuccess: (data: any) => alert(`Contratto duplicato: ${data.numero}`) });
  };

  const handlePrint = () => {
    const printContent = document.getElementById("contract-print");
    if (!printContent) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>${form.oggetto}</title><style>
      body { font-family: Georgia, serif; font-size: 13px; line-height: 1.6; max-width: 700px; margin: 40px auto; color: #111; }
      h2 { text-align: center; text-transform: uppercase; letter-spacing: 0.05em; }
      strong { font-weight: bold; }
      section { margin-bottom: 12px; }
      @media print { body { margin: 20px; } }
    </style></head><body>${printContent.innerHTML}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 300);
  };

  const clientData = useMemo(() => {
    const c = clientList.find((x: any) => String(x.id) === form.clientId);
    return c as any;
  }, [clientList, form.clientId]);

  // ─── Template handlers ─────────────────────────────────────────────────────
  const handleSaveTemplate = () => {
    if (!templateForm.name) return;
    if (editTemplateId) {
      updateTemplate.mutate({ id: editTemplateId, data: templateForm }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListContractTemplatesQueryKey() }); setShowTemplateForm(false); setEditTemplateId(null); } });
    } else {
      createTemplate.mutate({ data: templateForm }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListContractTemplatesQueryKey() }); setShowTemplateForm(false); setTemplateForm({ name: "", type: "Servizi", status: "bozza", content: "" }); } });
    }
  };

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Contratti</h1>
            <p className="text-muted-foreground text-sm mt-1">{contractList.length} contratti totali</p>
          </div>
          {tab === "contratti" && (
            <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
              <Plus size={16} /> Nuovo Contratto
            </button>
          )}
          {tab === "template" && (
            <button onClick={() => { setShowTemplateForm(!showTemplateForm); setEditTemplateId(null); setTemplateForm({ name: "", type: "Servizi", status: "bozza", content: "" }); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
              <Plus size={16} /> Nuovo Template
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-muted p-1 rounded-xl w-fit">
          {(["contratti", "template"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize", tab === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {t === "contratti" ? "Contratti Cliente" : "Template"}
            </button>
          ))}
        </div>

        {/* ─── CONTRATTI TAB ─────────────────────────────────────────────── */}
        {tab === "contratti" && (
          <>
            {/* Filters */}
            <div className="flex gap-3 mb-4">
              <select className="px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" value={filterStato} onChange={(e) => setFilterStato(e.target.value)}>
                <option value="">Tutti gli stati</option>
                {Object.entries(STATO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select className="px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" value={filterClientId} onChange={(e) => setFilterClientId(e.target.value)}>
                <option value="">Tutti i clienti</option>
                {clientList.map((c: any) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
              </select>
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="text-center text-muted-foreground py-12">Caricamento...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">Nessun contratto trovato</div>
            ) : (
              <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-card-border bg-muted/30">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">N.</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cliente</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Oggetto</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Periodo</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valore</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Stato</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c: any) => {
                      const days = daysUntil(c.dataFine);
                      const expiring = c.stato === "firmato" && days >= 0 && days <= 30;
                      const urgentExpiry = expiring && days <= 7;
                      return (
                        <tr key={c.id} className="border-b border-card-border/50 hover:bg-muted/20 transition-colors group">
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.numero}</td>
                          <td className="px-4 py-3 font-medium">{c.clientName}</td>
                          <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{c.oggetto}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            <div>{formatDate(c.dataInizio)} → {formatDate(c.dataFine)}</div>
                            {expiring && (
                              <div className={cn("flex items-center gap-1 mt-0.5", urgentExpiry ? "text-red-500" : "text-amber-500")}>
                                <AlertTriangle size={10} />
                                <span className="text-[11px]">{urgentExpiry ? `Scade tra ${days} giorni` : `Scade tra ${days} giorni`}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-medium tabular-nums">{fmtEur(c.importoTotale)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium", STATO_STYLES[c.stato] ?? "bg-gray-100 text-gray-600")}>
                              {STATO_LABELS[c.stato] ?? c.stato}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                              <button onClick={() => openEdit(c)} className="p-1.5 text-muted-foreground hover:text-foreground rounded" title="Modifica"><Pencil size={13} /></button>
                              <button onClick={() => handleDuplicate(c.id)} className="p-1.5 text-muted-foreground hover:text-foreground rounded" title="Duplica"><Copy size={13} /></button>
                              <button onClick={() => handleDelete(c.id)} className="p-1.5 text-muted-foreground hover:text-destructive rounded" title="Elimina"><Trash2 size={13} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ─── TEMPLATE TAB ─────────────────────────────────────────────── */}
        {tab === "template" && (
          <>
            {showTemplateForm && (
              <div className="bg-card border border-card-border rounded-xl p-6 mb-6 shadow-sm">
                <h2 className="text-sm font-semibold mb-4">{editTemplateId ? "Modifica Template" : "Nuovo Template"}</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">Nome *</label>
                    <input className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" placeholder="Nome template" value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Tipo</label>
                    <select className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" value={templateForm.type} onChange={(e) => setTemplateForm({ ...templateForm, type: e.target.value })}>
                      {["Servizi","NDA","Collaborazione","Licenza","Fornitura","Altro"].map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Stato</label>
                    <select className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" value={templateForm.status} onChange={(e) => setTemplateForm({ ...templateForm, status: e.target.value })}>
                      <option value="bozza">Bozza</option>
                      <option value="attivo">Attivo</option>
                      <option value="archiviato">Archiviato</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">Contenuto (usa {"{{"} VARIABILE {"}}"})</label>
                    <textarea className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none font-mono" rows={10} value={templateForm.content} onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })} />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={handleSaveTemplate} disabled={createTemplate.isPending || updateTemplate.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">Salva Template</button>
                  <button onClick={() => setShowTemplateForm(false)} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:opacity-80">Annulla</button>
                </div>
              </div>
            )}
            <div className="space-y-3">
              {templateList.map((t: any) => (
                <div key={t.id} className="bg-card border border-card-border rounded-xl p-4 shadow-sm flex items-center gap-3 group">
                  <FileText size={16} className="text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.type} · {t.status}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditTemplateId(t.id); setTemplateForm({ name: t.name, type: t.type, status: t.status, content: t.content }); setShowTemplateForm(true); }} className="p-1.5 text-muted-foreground hover:text-foreground rounded"><Pencil size={13} /></button>
                    <button onClick={() => { if (confirm("Eliminare il template?")) deleteTemplate.mutate({ id: t.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListContractTemplatesQueryKey() }) }); }} className="p-1.5 text-muted-foreground hover:text-destructive rounded"><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
              {!templateList.length && <div className="text-center text-muted-foreground py-12">Nessun template. Crea il primo.</div>}
            </div>
          </>
        )}
      </div>

      {/* ─── Contract Form Modal ──────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-3xl my-8">
            {/* Form header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-card-border">
              <h2 className="font-semibold">{editId ? "Modifica Contratto" : "Nuovo Contratto"}</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => setPreviewOpen(!previewOpen)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-muted hover:bg-muted/80 rounded-lg text-muted-foreground transition-colors">
                  <Eye size={13} /> Anteprima
                </button>
                <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-muted hover:bg-muted/80 rounded-lg text-muted-foreground transition-colors">
                  <Printer size={13} /> Esporta PDF
                </button>
                <button onClick={() => { setShowForm(false); setEditId(null); }} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Section tabs */}
            <div className="flex gap-0 border-b border-card-border px-6 overflow-x-auto">
              {(["dati", "servizi", "pagamento", "clausole"] as const).map((s) => (
                <button key={s} onClick={() => setFormSection(s)} className={cn("px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap capitalize", formSection === s ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
                  {s === "dati" ? "Dati Contratto" : s === "servizi" ? "Servizi Offerti" : s === "pagamento" ? "Condizioni Economiche" : "Clausole Standard"}
                </button>
              ))}
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* ─ Dati contratto ─ */}
              {formSection === "dati" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-muted-foreground">Cliente *</label>
                      <select className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" value={form.clientId} onChange={(e) => handleClientChange(e.target.value)}>
                        <option value="">Seleziona cliente...</option>
                        {clientList.map((c: any) => <option key={c.id} value={String(c.id)}>{c.name}{(c as any).ragioneSociale ? ` – ${(c as any).ragioneSociale}` : ""}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Referente cliente</label>
                      <input className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" placeholder="Nome cognome..." value={form.referenteCliente} onChange={(e) => setForm({ ...form, referenteCliente: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Stato</label>
                      <select className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" value={form.stato} onChange={(e) => setForm({ ...form, stato: e.target.value as ContractStato })}>
                        {Object.entries(STATO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-muted-foreground">Oggetto contratto</label>
                      <input className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" value={form.oggetto} onChange={(e) => setForm({ ...form, oggetto: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Data stipula</label>
                      <input type="date" className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" value={form.dataStipula} onChange={(e) => setForm({ ...form, dataStipula: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Preavviso rescissione (giorni)</label>
                      <input type="number" min={1} className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" value={form.preavvisoGiorni} onChange={(e) => setForm({ ...form, preavvisoGiorni: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Data inizio collaborazione</label>
                      <input type="date" className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" value={form.dataInizio} onChange={(e) => setForm({ ...form, dataInizio: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Data termine collaborazione</label>
                      <input type="date" className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" value={form.dataFine} onChange={(e) => setForm({ ...form, dataFine: e.target.value })} />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-muted-foreground">Note interne</label>
                      <textarea className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none resize-none" rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                    </div>
                  </div>
                </div>
              )}

              {/* ─ Servizi ─ */}
              {formSection === "servizi" && (
                <div>
                  <p className="text-xs text-muted-foreground mb-4">Aggiungi le macro-categorie di servizio previste dal contratto.</p>
                  <ServiziEditor servizi={form.servizi} onChange={(s) => setForm({ ...form, servizi: s })} />
                </div>
              )}

              {/* ─ Pagamento ─ */}
              {formSection === "pagamento" && (
                <div className="space-y-5">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Importo totale (€)</label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
                      <input type="number" min={0} step={0.01} className="w-full pl-7 pr-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" value={form.importoTotale / 100 || ""} onChange={(e) => setForm({ ...form, importoTotale: Math.round(Number(e.target.value) * 100) })} placeholder="0.00" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Struttura pagamenti (tranche)</label>
                    <TrancheEditor tranche={form.tranche} onChange={(t) => setForm({ ...form, tranche: t })} />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-medium text-muted-foreground">Marca da bollo (€2 per fattura)</label>
                    <button onClick={() => setForm({ ...form, marcaDaBollo: form.marcaDaBollo === 1 ? 0 : 1 })} className={cn("relative inline-flex h-5 w-9 rounded-full transition-colors", form.marcaDaBollo === 1 ? "bg-primary" : "bg-muted-foreground/30")}>
                      <span className={cn("absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform", form.marcaDaBollo === 1 ? "translate-x-4" : "")} />
                    </button>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Note IVA</label>
                    <textarea className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none resize-none" rows={2} value={form.noteIva} onChange={(e) => setForm({ ...form, noteIva: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">IBAN agenzia</label>
                    <input className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none font-mono" value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} />
                  </div>
                </div>
              )}

              {/* ─ Clausole ─ */}
              {formSection === "clausole" && (
                <div>
                  <p className="text-xs text-muted-foreground mb-4">Tutte le clausole sono precompilate e modificabili.</p>
                  <ClausoleEditor clausole={form.clausole} onChange={(c) => setForm({ ...form, clausole: c })} />
                </div>
              )}
            </div>

            {/* Form footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-card-border">
              <div className="flex gap-1">
                {(["dati", "servizi", "pagamento", "clausole"] as const).map((s, i) => (
                  <button key={s} onClick={() => setFormSection(s)} className={cn("w-2 h-2 rounded-full transition-colors", formSection === s ? "bg-primary" : "bg-muted-foreground/30")} />
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setShowForm(false); setEditId(null); }} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:opacity-80">Annulla</button>
                <button onClick={handleSave} disabled={createContract.isPending || updateContract.isPending || !form.clientId} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                  {createContract.isPending || updateContract.isPending ? "Salvataggio..." : editId ? "Aggiorna" : "Crea Contratto"}
                </button>
              </div>
            </div>
          </div>

          {/* Preview panel */}
          {previewOpen && (
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 ml-4 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
                <h3 className="font-semibold text-sm">Anteprima Contratto</h3>
                <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity">
                  <Printer size={12} /> Esporta PDF
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8">
                <ContractPreview contract={form} clientData={clientData} />
              </div>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
