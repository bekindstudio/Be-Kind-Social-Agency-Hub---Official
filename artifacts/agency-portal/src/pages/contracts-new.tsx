import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { ArrowLeft, ArrowRight, Check, FileDown, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  applyContractVariables,
  DEFAULT_AGENCY,
  defaultLogoUrl,
  SERVICE_LABELS,
  SERVICE_SLUGS,
  type ServiceSlug,
  todayIt,
} from "@/lib/contracts-shared";
import { exportContractElementToPdf } from "@/lib/contract-pdf";
import { ContractRichEditor } from "@/components/contracts/ContractRichEditor";

const BASE = "/api";

type TemplateRow = {
  id: number;
  name: string;
  type: string;
  content: string;
  status: string;
  variables?: string[];
};

const AUTO_VARIABLES = new Set([
  "NOME_CLIENTE",
  "EMAIL_CLIENTE",
  "PIVA_CLIENTE",
  "INDIRIZZO_CLIENTE",
  "AGENZIA_NOME",
  "AGENZIA_INDIRIZZO",
  "AGENZIA_PIVA",
  "AGENZIA_PEC",
  "AGENZIA_IBAN",
  "DATA_ODIERNA",
  "URL_LOGO",
  "DATA_INIZIO",
  "DATA_FINE",
  "NUMERO_CONTRATTO",
]);

function formatItDate(iso: string) {
  if (!iso) return "";
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function fmtEurInput(n: string) {
  const v = parseFloat(n.replace(",", "."));
  if (isNaN(v)) return "";
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(v);
}

export default function ContractsNew() {
  const qc = useQueryClient();
  const search = useSearch();
  const loadId = useMemo(() => new URLSearchParams(search).get("id"), [search]);

  const [step, setStep] = useState(1);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [slug, setSlug] = useState<ServiceSlug | "">("");
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientVat, setClientVat] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [valueEur, setValueEur] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [extraVars, setExtraVars] = useState<Record<string, string>>({});
  const [content, setContent] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [contractNumber, setContractNumber] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.type === slug),
    [templates, slug],
  );

  const manualVarKeys = useMemo(() => {
    const vars = Array.isArray(selectedTemplate?.variables) ? selectedTemplate!.variables! : [];
    return vars.filter((k) => !AUTO_VARIABLES.has(k));
  }, [selectedTemplate]);

  const buildVarMap = useCallback((): Record<string, string> => {
    const num = contractNumber || "— bozza —";
    const base: Record<string, string> = {
      ...DEFAULT_AGENCY,
      URL_LOGO: defaultLogoUrl(),
      DATA_ODIERNA: todayIt(),
      NOME_CLIENTE: clientName,
      EMAIL_CLIENTE: clientEmail,
      PIVA_CLIENTE: clientVat,
      INDIRIZZO_CLIENTE: clientAddress,
      DATA_INIZIO: formatItDate(startDate),
      DATA_FINE: formatItDate(endDate),
      NUMERO_CONTRATTO: num,
      ...extraVars,
    };
    const ve = fmtEurInput(valueEur);
    if (ve) {
      if (!base.IMPORTO_MENSILE) base.IMPORTO_MENSILE = ve;
      if (!base.IMPORTO) base.IMPORTO = ve;
      if (!base.IMPORTO_TOTALE) base.IMPORTO_TOTALE = ve;
      if (!base.FEE_GESTIONE && slug === "ads") base.FEE_GESTIONE = ve;
    }
    return base;
  }, [
    clientName,
    clientEmail,
    clientVat,
    clientAddress,
    startDate,
    endDate,
    extraVars,
    contractNumber,
    valueEur,
    slug,
  ]);

  useEffect(() => {
    fetch(`${BASE}/contracts`)
      .then((r) => r.json())
      .then((rows: TemplateRow[]) => setTemplates(Array.isArray(rows) ? rows : []))
      .catch(() => setTemplates([]));
  }, []);

  useEffect(() => {
    if (!loadId) return;
    fetch(`${BASE}/contract-documents/${loadId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((doc: null | Record<string, unknown>) => {
        if (!doc) return;
        setSavedId(String(doc.id));
        setContractNumber(String(doc.contractNumber ?? ""));
        setClientName(String(doc.clientName ?? ""));
        setClientEmail(String(doc.clientEmail ?? ""));
        setClientVat(String(doc.clientVat ?? ""));
        setClientAddress(String(doc.clientAddress ?? ""));
        setSlug((doc.serviceType as ServiceSlug) || "");
        setTemplateId(doc.templateId != null ? Number(doc.templateId) : null);
        setContent(String(doc.content ?? ""));
        if (doc.value != null) setValueEur(String(doc.value).replace(".", ","));
        if (doc.startDate) setStartDate(String(doc.startDate).slice(0, 10));
        if (doc.endDate) setEndDate(String(doc.endDate).slice(0, 10));
        setStep(4);
      })
      .catch(() => {});
  }, [loadId]);

  useEffect(() => {
    if (selectedTemplate) setTemplateId(selectedTemplate.id);
  }, [selectedTemplate]);

  const goNext = () => {
    if (step === 3 && selectedTemplate?.content && !loadId) {
      setContent(applyContractVariables(selectedTemplate.content, buildVarMap()));
    }
    setStep((s) => Math.min(4, s + 1));
  };

  const persist = async (status: "bozza" | "inviato") => {
    setSaving(true);
    try {
      const num = parseFloat(valueEur.replace(",", "."));
      const body = {
        templateId,
        clientName,
        clientEmail: clientEmail || null,
        clientVat: clientVat || null,
        clientAddress: clientAddress || null,
        serviceType: slug,
        content,
        status,
        value: isNaN(num) ? null : num,
        startDate: startDate || null,
        endDate: endDate || null,
      };
      let res: Response;
      if (savedId) {
        res = await fetch(`${BASE}/contract-documents/${savedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch(`${BASE}/contract-documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Errore salvataggio");
      setSavedId(data.id);
      setContractNumber(data.contractNumber);
      qc.invalidateQueries({ queryKey: ["contract-documents"] });
      qc.invalidateQueries({ queryKey: ["contract-documents-stats"] });
      return data as { id: string; contractNumber: string };
    } finally {
      setSaving(false);
    }
  };

  const handlePdf = async (fileNumber?: string) => {
    if (!previewRef.current) return;
    const num = fileNumber || contractNumber || "bozza";
    await exportContractElementToPdf(
      previewRef.current,
      `contratto_${String(num).replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`,
    );
  };

  const canNext =
    (step === 1 && slug !== "") ||
    (step === 2 && clientName.trim().length > 0) ||
    step === 3 ||
    step === 4;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/contracts" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" />
            Elenco contratti
          </Link>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">Nuovo contratto</h1>

        {/* Step indicator */}
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => s < step && setStep(s)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                step === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              {s}. {s === 1 ? "Servizio" : s === 2 ? "Cliente" : s === 3 ? "Dettagli" : "Anteprima"}
            </button>
          ))}
        </div>

        {step === 1 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SERVICE_SLUGS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSlug(s)}
                className={cn(
                  "text-left rounded-xl border p-4 transition-all hover:border-primary/50 hover:shadow-sm",
                  slug === s ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "border-card-border bg-card",
                )}
              >
                <p className="font-semibold text-foreground">{SERVICE_LABELS[s].title}</p>
                <p className="text-xs text-muted-foreground mt-1">{SERVICE_LABELS[s].description}</p>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="rounded-xl border border-card-border bg-card p-6 space-y-4 max-w-lg">
            <div>
              <label className="text-xs text-muted-foreground">Ragione sociale / Nome *</label>
              <input
                className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Email</label>
              <input
                type="email"
                className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">P.IVA / C.F.</label>
              <input
                className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"
                value={clientVat}
                onChange={(e) => setClientVat(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Indirizzo</label>
              <textarea
                className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background min-h-[72px]"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="rounded-xl border border-card-border bg-card p-6 space-y-4 max-w-2xl">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">Importo (EUR)</label>
                <input
                  className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"
                  placeholder="es. 1500"
                  value={valueEur}
                  onChange={(e) => setValueEur(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Data inizio</label>
                <input
                  type="date"
                  className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Data fine</label>
                <input
                  type="date"
                  className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            {manualVarKeys.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-card-border">
                <p className="text-sm font-medium text-foreground">Personalizzazioni template</p>
                {manualVarKeys.map((key) => (
                  <div key={key}>
                    <label className="text-xs text-muted-foreground font-mono">{key}</label>
                    <input
                      className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"
                      value={extraVars[key] ?? ""}
                      onChange={(e) => setExtraVars((prev) => ({ ...prev, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="grid lg:grid-cols-2 gap-6 items-start">
            <div>
              <p className="text-sm font-medium mb-2">Testo finale (WYSIWYG)</p>
              <ContractRichEditor value={content} onChange={setContent} />
              <p className="text-xs text-muted-foreground mt-2">
                Le variabili sono già sostituite; puoi rifinire il testo prima di salvare o esportare.
              </p>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Anteprima stampa / PDF</p>
              <div
                ref={previewRef}
                className="rounded-xl border border-card-border bg-white text-gray-900 p-6 max-h-[560px] overflow-y-auto text-sm prose prose-sm max-w-none"
              >
                <div dangerouslySetInnerHTML={{ __html: content }} />
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-card-border">
          <button
            type="button"
            disabled={step <= 1}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-input text-sm disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" />
            Indietro
          </button>
          <div className="flex flex-wrap gap-2">
            {step === 4 && (
              <>
                <button
                  type="button"
                  disabled={saving || !content}
                  onClick={() => persist("bozza").catch((e) => alert(String(e.message)))}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-input bg-background text-sm font-medium hover:bg-muted/60 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  Salva bozza
                </button>
                <button
                  type="button"
                  disabled={saving || !content}
                  onClick={() =>
                    persist("inviato")
                      .then((data) => handlePdf(data.contractNumber))
                      .catch((e) => alert(String(e.message)))
                  }
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  <FileDown className="h-4 w-4" />
                  Salva e genera PDF
                </button>
                <button
                  type="button"
                  disabled={!content}
                  onClick={() => handlePdf().catch(() => alert("Errore PDF"))}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-primary text-primary text-sm font-medium hover:bg-primary/5 disabled:opacity-50"
                >
                  <FileDown className="h-4 w-4" />
                  Solo PDF
                </button>
              </>
            )}
            {step < 4 ? (
              <button
                type="button"
                disabled={!canNext}
                onClick={goNext}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
              >
                Avanti
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              savedId && (
                <Link
                  href="/contracts"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium"
                >
                  <Check className="h-4 w-4" />
                  Torna all&apos;elenco
                </Link>
              )
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
