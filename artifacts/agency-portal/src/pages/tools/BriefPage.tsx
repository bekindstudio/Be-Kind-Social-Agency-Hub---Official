import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { useClientContext } from "@/context/ClientContext";
import { portalFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { generateBriefPDF } from "@/lib/brief-pdf";
import { ShareClientDialog } from "@/components/ShareClientDialog";
import {
  BRIEF_SECTIONS,
  emptyBriefData,
  normalizeBriefData,
  briefEssentialStats,
  sectionHasEssential,
  visibleFields,
  type BriefData,
} from "@/lib/briefSchema";
import {
  ChevronDown,
  CheckCircle2,
  Loader2,
  CloudOff,
  Cloud,
  FileText,
  FileDown,
  Share2,
} from "lucide-react";

/* ────────────────────────────────────────────────────────────────────────
   Brief cliente — form manuale con salvataggio automatico. Lo schema (sezioni,
   campi, testi di aiuto, campi essenziali) vive in un solo posto,
   lib/briefSchema.ts, condiviso con l'area cliente pubblica: prima questa
   pagina aveva una copia separata che era divergita.
   I dati vanno in client_briefs.parsedJson (oggetto sezione→campo).
   ──────────────────────────────────────────────────────────────────────── */

type SaveState = "idle" | "saving" | "saved" | "error";

function cnChevron(open: boolean): string {
  return `shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`;
}

function SaveBadge({ state, loading }: { state: SaveState; loading: boolean }) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 size={13} className="animate-spin" /> Caricamento…
      </span>
    );
  }
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 size={13} className="animate-spin" /> Salvataggio…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600">
        <Cloud size={13} /> Salvato
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-red-600">
        <CloudOff size={13} /> Errore di salvataggio
      </span>
    );
  }
  return null;
}

export default function BriefPage() {
  const { activeClient } = useClientContext();
  const { toast } = useToast();
  const clientId =
    activeClient?.id && Number.isFinite(Number(activeClient.id)) ? Number(activeClient.id) : null;

  const [data, setData] = useState<BriefData>(emptyBriefData);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  // Percorso essenziale acceso di default: prima si vedono solo le domande da
  // cui dipende la strategia (~poche), il resto è a un clic.
  const [essentialOnly, setEssentialOnly] = useState(true);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ [BRIEF_SECTIONS[0].key]: true });

  const loadedRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<{ data: BriefData; notes: string }>({ data, notes });
  latest.current = { data, notes };

  // Le sezioni da mostrare: nel percorso essenziale solo quelle con almeno un
  // campo essenziale.
  const shownSections = useMemo(
    () => (essentialOnly ? BRIEF_SECTIONS.filter(sectionHasEssential) : BRIEF_SECTIONS),
    [essentialOnly],
  );

  // Carica il brief del cliente attivo.
  useEffect(() => {
    loadedRef.current = false;
    if (!clientId) {
      setData(emptyBriefData());
      setNotes("");
      return;
    }
    let alive = true;
    setLoading(true);
    setSaveState("idle");
    void (async () => {
      try {
        const res = await portalFetch(`/api/clients/${clientId}/brief`, { credentials: "include" });
        if (!alive) return;
        if (res.ok) {
          const row = await res.json();
          let parsed: unknown = {};
          try {
            parsed = row?.parsedJson ? JSON.parse(row.parsedJson) : {};
          } catch {
            parsed = {};
          }
          setData(normalizeBriefData(parsed));
          setNotes(typeof row?.rawText === "string" ? row.rawText : "");
        } else {
          setData(emptyBriefData());
          setNotes("");
        }
      } catch {
        if (alive) {
          setData(emptyBriefData());
          setNotes("");
        }
      } finally {
        if (alive) {
          setLoading(false);
          setTimeout(() => {
            loadedRef.current = true;
          }, 0);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [clientId]);

  const persist = useCallback(async () => {
    if (!clientId) return;
    setSaveState("saving");
    try {
      const res = await portalFetch(`/api/clients/${clientId}/brief`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parsedJson: latest.current.data, rawText: latest.current.notes }),
      });
      if (!res.ok) {
        // Mostra il vero errore dell'API invece di un generico.
        let detail = `HTTP ${res.status}`;
        try { const b = await res.json(); if (b?.error) detail = String(b.error); } catch { /* non-JSON */ }
        setSaveState("error");
        toast({ variant: "destructive", title: "Salvataggio non riuscito", description: `${detail} · il testo digitato resta nei campi.` });
        return;
      }
      setSaveState("saved");
    } catch {
      setSaveState("error");
      toast({ variant: "destructive", title: "Salvataggio non riuscito", description: "Connessione assente: il testo digitato resta nei campi." });
    }
  }, [clientId, toast]);

  const scheduleSave = useCallback(() => {
    if (!loadedRef.current) return;
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void persist();
    }, 800);
  }, [persist]);

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  const setField = (sectionKey: string, fieldKey: string, value: string) => {
    setData((prev) => ({ ...prev, [sectionKey]: { ...prev[sectionKey], [fieldKey]: value } }));
    scheduleSave();
  };

  const handleExportPdf = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      await generateBriefPDF({
        clientName: activeClient?.name ?? "Cliente",
        clientLogoUrl: activeClient?.logo ?? null,
        brandColor: activeClient?.color ?? null,
        // Il PDF contiene sempre TUTTE le sezioni compilate, non solo le essenziali.
        sections: BRIEF_SECTIONS.map((s) => ({
          key: s.key,
          label: s.label,
          fields: s.fields.map((f) => ({ key: f.key, label: f.label, value: data[s.key]?.[f.key] ?? "" })),
        })),
      });
    } catch {
      toast({ variant: "destructive", title: "Esportazione PDF non riuscita", description: "Riprova tra poco." });
    } finally {
      setPdfBusy(false);
    }
  };

  // La barra guida i campi essenziali; il totale complessivo resta come nota.
  const essential = useMemo(() => briefEssentialStats(data), [data]);
  const totalFilled = useMemo(
    () => BRIEF_SECTIONS.reduce((acc, s) => acc + s.fields.filter((f) => (data[s.key]?.[f.key] ?? "").trim().length > 0).length, 0),
    [data],
  );
  const totalFields = useMemo(() => BRIEF_SECTIONS.reduce((acc, s) => acc + s.fields.length, 0), []);

  const allOpen = shownSections.every((s) => openSections[s.key]);
  const toggleAll = () => {
    const next: Record<string, boolean> = { ...openSections };
    for (const s of shownSections) next[s.key] = !allOpen;
    setOpenSections(next);
  };

  if (!clientId) {
    return (
      <Layout>
        <div className="p-8">
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-card-border py-20 text-center">
            <FileText size={28} className="text-muted-foreground/60 mb-3" />
            <p className="font-medium">Seleziona un cliente</p>
            <p className="text-sm text-muted-foreground mt-1">
              Scegli un cliente dalla barra in alto per compilare il suo brief.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">Brief cliente</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{activeClient?.name}</p>
            </div>
            <div className="flex items-center gap-3">
              <SaveBadge state={saveState} loading={loading} />
              <button
                onClick={toggleAll}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-input hover:bg-muted transition-colors"
              >
                {allOpen ? "Comprimi tutto" : "Espandi tutto"}
              </button>
              <button
                onClick={() => setShareOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-input hover:bg-muted transition-colors"
                title="Condividi il brief col cliente (link senza login)"
              >
                <Share2 size={14} /> Condividi col cliente
              </button>
              <button
                onClick={() => void handleExportPdf()}
                disabled={pdfBusy || totalFilled === 0}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:brightness-105 transition disabled:opacity-50"
                title={totalFilled === 0 ? "Compila almeno un campo per esportare" : "Genera il PDF del brief"}
              >
                {pdfBusy ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
                {pdfBusy ? "Genero…" : "Genera PDF"}
              </button>
            </div>
          </div>

          {/* Toggle percorso essenziale / tutte le domande */}
          <div className="mt-4 inline-flex items-center rounded-lg border border-input bg-background p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setEssentialOnly(true)}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${essentialOnly ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Essenziali
            </button>
            <button
              type="button"
              onClick={() => setEssentialOnly(false)}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${!essentialOnly ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Tutte le domande
            </button>
          </div>

          {/* Progress: guida i campi essenziali */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>{essentialOnly ? "Percorso essenziale" : "Completamento"}</span>
              <span className="font-semibold text-foreground tabular-nums">
                {essential.pct}% essenziali · {essential.filled}/{essential.total}
                <span className="font-normal text-muted-foreground"> · {totalFilled}/{totalFields} in tutto</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all duration-500" style={{ width: `${essential.pct}%` }} />
            </div>
            {essentialOnly && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Bastano queste domande per partire. Vuoi entrare nel dettaglio?{" "}
                <button type="button" onClick={() => setEssentialOnly(false)} className="text-primary hover:underline font-medium">
                  Mostra tutte le domande
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Sezioni */}
        <div className="space-y-3">
          {shownSections.map((s) => {
            const open = !!openSections[s.key];
            const Icon = s.icon;
            const fields = visibleFields(s, essentialOnly);
            const filled = fields.filter((f) => (data[s.key]?.[f.key] ?? "").trim().length > 0).length;
            const optional = !sectionHasEssential(s);
            return (
              <section key={s.key} className="rounded-xl border border-card-border bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenSections((p) => ({ ...p, [s.key]: !p[s.key] }))}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{s.label}</span>
                      {filled === fields.length && filled > 0 && (
                        <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                      )}
                      {optional && !essentialOnly && (
                        <span className="text-[10px] rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground shrink-0">facoltativa</span>
                      )}
                    </span>
                    {s.hint && <span className="block text-[11px] text-muted-foreground truncate">{s.hint}</span>}
                  </span>
                  <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                    {filled}/{fields.length}
                  </span>
                  <ChevronDown size={16} className={cnChevron(open)} />
                </button>
                {open && (
                  <div className="px-4 pb-4 pt-1 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
                    {fields.map((f) => (
                      <div key={f.key} className={f.long ? "md:col-span-2" : undefined}>
                        <label className="block text-xs font-semibold text-foreground mb-0.5">{f.label}</label>
                        {f.help && <p className="text-[11px] text-muted-foreground mb-1.5 leading-snug">{f.help}</p>}
                        <textarea
                          value={data[s.key]?.[f.key] ?? ""}
                          onChange={(e) => setField(s.key, f.key, e.target.value)}
                          placeholder={f.placeholder ?? "Scrivi qui…"}
                          rows={f.long ? 3 : 2}
                          className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}

          {/* Note libere / brief grezzo */}
          <section className="rounded-xl border border-card-border bg-card overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenSections((p) => ({ ...p, __notes: !p.__notes }))}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-semibold text-sm">Note libere</span>
                <span className="block text-[11px] text-muted-foreground truncate">
                  Appunti, testo grezzo del questionario, qualsiasi cosa
                </span>
              </span>
              <ChevronDown size={16} className={cnChevron(!!openSections.__notes)} />
            </button>
            {openSections.__notes && (
              <div className="px-4 pb-4 pt-1">
                <textarea
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    scheduleSave();
                  }}
                  rows={8}
                  placeholder="Incolla qui il questionario compilato o qualsiasi nota libera…"
                  className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
            )}
          </section>
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Le modifiche vengono salvate automaticamente.
        </p>
      </div>

      <ShareClientDialog
        clientId={clientId}
        clientName={activeClient?.name ?? "Cliente"}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />
    </Layout>
  );
}
