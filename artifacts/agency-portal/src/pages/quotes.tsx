import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useListQuoteTemplates,
  useCreateQuoteTemplate,
  useUpdateQuoteTemplate,
  useDeleteQuoteTemplate,
  getListQuoteTemplatesQueryKey,
  useListClients,
  portalFetch,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Plus, Trash2, Pencil, X, Check, ChevronDown, ChevronUp, Printer, Copy, Download } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { useClientContext } from "@/context/ClientContext";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

type QuoteItem = { description: string; quantity: number; unitPrice: number };

const STATUS_STYLES: Record<string, string> = {
  bozza: "bg-gray-100 text-gray-600",
  inviato: "bg-blue-100 text-blue-700",
  accettato: "bg-green-100 text-green-700",
  rifiutato: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  bozza: "Bozza",
  inviato: "Inviato",
  accettato: "Accettato",
  rifiutato: "Rifiutato",
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);
}

function isQuoteExpired(quote: any): boolean {
  const createdAt = quote?.createdAt ? new Date(quote.createdAt) : null;
  const validityDays = Number(quote?.validityDays ?? 0);
  if (!createdAt || !Number.isFinite(validityDays) || validityDays <= 0) return false;
  const deadline = new Date(createdAt);
  deadline.setDate(deadline.getDate() + validityDays);
  return deadline < new Date();
}

type FormState = {
  name: string;
  clientId: string;
  status: string;
  validityDays: string;
  notes: string;
  taxRate: string;
  items: QuoteItem[];
};

const EMPTY_FORM: FormState = {
  name: "",
  clientId: "",
  status: "bozza",
  validityDays: "30",
  notes: "",
  taxRate: "22",
  items: [{ description: "", quantity: 1, unitPrice: 0 }],
};

type QuoteStatusFilter = "all" | "bozza" | "inviato" | "accettato" | "rifiutato";
type QuoteSort = "created_desc" | "created_asc" | "total_desc" | "total_asc" | "name_asc" | "name_desc";
type QuotePreset = "all" | "to_send" | "expired" | "accepted";

export default function Quotes() {
  const qc = useQueryClient();
  const { activeClient } = useClientContext();
  const { toast } = useToast();
  const { data: quotes, isLoading } = useListQuoteTemplates();
  const { data: clients } = useListClients();
  const createQuote = useCreateQuoteTemplate();
  const updateQuote = useUpdateQuoteTemplate();
  const deleteQuote = useDeleteQuoteTemplate();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<QuoteStatusFilter>("all");
  const [sortBy, setSortBy] = useState<QuoteSort>("created_desc");
  const [presetFilter, setPresetFilter] = useState<QuotePreset>("all");
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<number[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const clientList = Array.isArray(clients)
    ? clients
    : // @ts-expect-error runtime safety for unknown API shape
      Array.isArray(clients?.items)
      ? // @ts-expect-error runtime safety for unknown API shape
        clients.items
      : clients
        ? [clients as any]
        : [];
  const quoteList = Array.isArray(quotes)
    ? quotes
    : Array.isArray((quotes as any)?.items)
      ? (quotes as any).items
      : quotes
        ? [quotes as any]
        : [];
  const activeBackendClientId = useMemo(() => {
    if (!activeClient) return "";
    const numeric = Number(activeClient.id);
    if (Number.isFinite(numeric)) return String(numeric);
    const byName = clientList.find((c: any) => String(c?.name ?? "").trim().toLowerCase() === String(activeClient.name ?? "").trim().toLowerCase());
    return byName?.id != null ? String(byName.id) : "";
  }, [activeClient, clientList]);
  const visibleQuotes = useMemo(() => {
    if (!activeBackendClientId) return quoteList;
    return quoteList.filter((q: any) => String(q?.clientId ?? "") === activeBackendClientId);
  }, [quoteList, activeBackendClientId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    const status = params.get("status");
    const sort = params.get("sort");
    const preset = params.get("preset");
    if (q != null) setSearchQuery(q);
    if (status === "all" || status === "bozza" || status === "inviato" || status === "accettato" || status === "rifiutato") {
      setStatusFilter(status);
    }
    if (sort === "created_desc" || sort === "created_asc" || sort === "total_desc" || sort === "total_asc" || sort === "name_asc" || sort === "name_desc") {
      setSortBy(sort);
    }
    if (preset === "all" || preset === "to_send" || preset === "expired" || preset === "accepted") {
      setPresetFilter(preset);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    else params.delete("q");
    if (statusFilter !== "all") params.set("status", statusFilter);
    else params.delete("status");
    if (sortBy !== "created_desc") params.set("sort", sortBy);
    else params.delete("sort");
    if (presetFilter !== "all") params.set("preset", presetFilter);
    else params.delete("preset");
    const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState(window.history.state, "", next);
  }, [searchQuery, statusFilter, sortBy, presetFilter]);

  const filteredQuotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = visibleQuotes.filter((quote: any) => {
      const matchStatus = statusFilter === "all" || quote?.status === statusFilter;
      if (!matchStatus) return false;
      if (presetFilter === "to_send" && quote?.status !== "bozza") return false;
      if (presetFilter === "accepted" && quote?.status !== "accettato") return false;
      if (presetFilter === "expired") {
        const closed = quote?.status === "accettato" || quote?.status === "rifiutato";
        if (closed || !isQuoteExpired(quote)) return false;
      }
      if (!q) return true;
      const haystack = [
        quote?.name ?? "",
        quote?.clientName ?? "",
        quote?.notes ?? "",
        quote?.status ?? "",
      ].join(" ").toLowerCase();
      return haystack.includes(q);
    });
    return [...filtered].sort((a: any, b: any) => {
      if (sortBy === "created_asc") return String(a?.createdAt ?? "").localeCompare(String(b?.createdAt ?? ""));
      if (sortBy === "created_desc") return String(b?.createdAt ?? "").localeCompare(String(a?.createdAt ?? ""));
      if (sortBy === "total_asc") return Number(a?.total ?? 0) - Number(b?.total ?? 0);
      if (sortBy === "total_desc") return Number(b?.total ?? 0) - Number(a?.total ?? 0);
      if (sortBy === "name_desc") return String(b?.name ?? "").localeCompare(String(a?.name ?? ""));
      return String(a?.name ?? "").localeCompare(String(b?.name ?? ""));
    });
  }, [visibleQuotes, searchQuery, statusFilter, sortBy, presetFilter]);
  const filteredQuoteIds = useMemo(
    () => filteredQuotes.map((quote: any) => Number(quote?.id)).filter((id: number) => Number.isFinite(id)),
    [filteredQuotes],
  );
  const statusCounts = useMemo(() => {
    const counts: Record<QuoteStatusFilter, number> = { all: visibleQuotes.length, bozza: 0, inviato: 0, accettato: 0, rifiutato: 0 };
    for (const quote of visibleQuotes) {
      const status = String(quote?.status ?? "") as QuoteStatusFilter;
      if (status in counts) counts[status] += 1;
    }
    return counts;
  }, [visibleQuotes]);
  const presetCounts = useMemo(() => {
    const toSend = visibleQuotes.filter((quote: any) => quote?.status === "bozza").length;
    const accepted = visibleQuotes.filter((quote: any) => quote?.status === "accettato").length;
    const expired = visibleQuotes.filter((quote: any) => {
      const closed = quote?.status === "accettato" || quote?.status === "rifiutato";
      return !closed && isQuoteExpired(quote);
    }).length;
    return { toSend, accepted, expired };
  }, [visibleQuotes]);
  const allFilteredSelected = filteredQuoteIds.length > 0 && filteredQuoteIds.every((id: number) => selectedQuoteIds.includes(id));

  const invalidate = () => qc.invalidateQueries({ queryKey: getListQuoteTemplatesQueryKey() });
  const toggleQuoteSelection = useCallback((id: number) => {
    setSelectedQuoteIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);
  const toggleSelectAllFiltered = useCallback(() => {
    setSelectedQuoteIds((prev) => {
      if (allFilteredSelected) return prev.filter((id) => !filteredQuoteIds.includes(id));
      return Array.from(new Set([...prev, ...filteredQuoteIds]));
    });
  }, [allFilteredSelected, filteredQuoteIds]);

  const exportQuotesCsv = useCallback(() => {
    const source = selectedQuoteIds.length > 0
      ? filteredQuotes.filter((quote: any) => selectedQuoteIds.includes(Number(quote?.id)))
      : filteredQuotes;
    if (source.length === 0) {
      toast({ title: "Nessun preventivo da esportare", variant: "destructive" });
      return;
    }
    const headers = ["Nome", "Cliente", "Stato", "Validita giorni", "IVA", "Subtotale", "Totale", "Creato"];
    const rows = source.map((quote: any) => [
      quote?.name ?? "",
      quote?.clientName ?? "",
      quote?.status ?? "",
      String(quote?.validityDays ?? ""),
      String(quote?.taxRate ?? ""),
      String(quote?.subtotal ?? ""),
      String(quote?.total ?? ""),
      String(quote?.createdAt ?? ""),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell: string) => `"${String(cell).replace(/"/g, "\"\"")}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `preventivi-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV esportato" });
  }, [filteredQuotes, selectedQuoteIds, toast]);

  const exportQuotesXlsx = useCallback(() => {
    const source = selectedQuoteIds.length > 0
      ? filteredQuotes.filter((quote: any) => selectedQuoteIds.includes(Number(quote?.id)))
      : filteredQuotes;
    if (source.length === 0) {
      toast({ title: "Nessun preventivo da esportare", variant: "destructive" });
      return;
    }
    const rows = source.map((quote: any) => ({
      Nome: quote?.name ?? "",
      Cliente: quote?.clientName ?? "",
      Stato: STATUS_LABELS[quote?.status] ?? quote?.status ?? "",
      "Validita (giorni)": Number(quote?.validityDays ?? 0),
      "Aliquota IVA %": Number(quote?.taxRate ?? 0),
      Subtotale: Number(quote?.subtotal ?? 0),
      Totale: Number(quote?.total ?? 0),
      "Numero voci": Array.isArray(quote?.items) ? quote.items.length : 0,
      Creato: quote?.createdAt ? formatDate(quote.createdAt) : "",
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Preventivi");
    XLSX.writeFile(wb, `preventivi-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: "Excel esportato" });
  }, [filteredQuotes, selectedQuoteIds, toast]);

  const exportQuotesPdf = useCallback(() => {
    const source = selectedQuoteIds.length > 0
      ? filteredQuotes.filter((quote: any) => selectedQuoteIds.includes(Number(quote?.id)))
      : filteredQuotes;
    if (source.length === 0) {
      toast({ title: "Nessun preventivo da esportare", variant: "destructive" });
      return;
    }
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    let y = 14;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Export Preventivi Dettagliato", 14, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Generato il: ${new Date().toLocaleString("it-IT")}`, 14, y);
    y += 8;
    for (const quote of source) {
      const title = `${quote?.name ?? "—"} (${STATUS_LABELS[quote?.status] ?? quote?.status ?? "—"})`;
      const meta = `Cliente: ${quote?.clientName ?? "—"}  |  Validita: ${quote?.validityDays ?? "—"} giorni  |  IVA: ${quote?.taxRate ?? 0}%`;
      const totals = `Subtotale: ${formatCurrency(Number(quote?.subtotal ?? 0))}   Totale: ${formatCurrency(Number(quote?.total ?? 0))}`;
      if (y > 250) {
        doc.addPage();
        y = 14;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(doc.splitTextToSize(title, 180), 14, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(doc.splitTextToSize(meta, 180), 14, y);
      y += 4;
      doc.text(doc.splitTextToSize(totals, 180), 14, y);
      y += 5;
      doc.setDrawColor(220, 220, 220);
      doc.line(14, y, 196, y);
      y += 3;

      const items = Array.isArray(quote?.items) ? quote.items : [];
      for (const item of items) {
        const itemLine = `- ${item?.description ?? "Voce"} | Qtà ${Number(item?.quantity ?? 0)} | Prezzo ${formatCurrency(Number(item?.unitPrice ?? 0))} | Totale ${formatCurrency(Number(item?.total ?? 0))}`;
        const wrapped = doc.splitTextToSize(itemLine, 178);
        if (y + wrapped.length * 4 > 285) {
          doc.addPage();
          y = 14;
        }
        doc.text(wrapped, 16, y);
        y += wrapped.length * 4 + 1;
      }
      if (quote?.notes) {
        const notes = doc.splitTextToSize(`Note: ${String(quote.notes)}`, 178);
        if (y + notes.length * 4 > 285) {
          doc.addPage();
          y = 14;
        }
        doc.setTextColor(110, 110, 110);
        doc.text(notes, 16, y);
        doc.setTextColor(0, 0, 0);
        y += notes.length * 4 + 1;
      }
      y += 3;
    }
    doc.save(`preventivi-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast({ title: "PDF esportato" });
  }, [filteredQuotes, selectedQuoteIds, toast]);

  const handleBulkDeleteQuotes = useCallback(async () => {
    if (selectedQuoteIds.length === 0) return;
    const ok = window.confirm(`Eliminare ${selectedQuoteIds.length} preventivi selezionati?`);
    if (!ok) return;
    try {
      setBulkDeleting(true);
      const results = await Promise.all(
        selectedQuoteIds.map(async (id) => {
          const res = await portalFetch(`/api/quotes/${id}`, { method: "DELETE" });
          return { id, ok: res.ok };
        }),
      );
      const deleted = results.filter((r) => r.ok).map((r) => r.id);
      const failed = results.filter((r) => !r.ok).map((r) => r.id);
      setSelectedQuoteIds(failed);
      invalidate();
      if (failed.length > 0) {
        toast({
          title: "Eliminazione parziale",
          description: `${deleted.length} eliminati, ${failed.length} non eliminati.`,
          variant: "destructive",
        });
      } else {
        toast({ title: "Preventivi spostati nel cestino", description: `${deleted.length} elementi.` });
      }
    } catch {
      toast({ title: "Eliminazione bulk non riuscita", variant: "destructive" });
    } finally {
      setBulkDeleting(false);
    }
  }, [selectedQuoteIds, toast, invalidate]);

  const subtotal = form.items.reduce((sum, item) => {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    const safeQty = Number.isFinite(quantity) ? Math.max(0, quantity) : 0;
    const safePrice = Number.isFinite(unitPrice) ? Math.max(0, unitPrice) : 0;
    return sum + safeQty * safePrice;
  }, 0);
  const safeTaxRate = Number.isFinite(Number(form.taxRate)) ? Math.max(0, Number(form.taxRate)) : 0;
  const total = subtotal * (1 + safeTaxRate / 100);

  useEffect(() => {
    if (!activeBackendClientId) return;
    setForm((prev) => ({ ...prev, clientId: prev.clientId || activeBackendClientId }));
  }, [activeBackendClientId]);

  useEffect(() => {
    const availableIds = new Set(quoteList.map((quote: any) => Number(quote?.id)).filter((id: number) => Number.isFinite(id)));
    setSelectedQuoteIds((prev) => prev.filter((id) => availableIds.has(id)));
  }, [quoteList]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, clientId: activeBackendClientId || "" });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (q: any) => {
    setForm({
      name: q.name,
      clientId: q.clientId != null ? String(q.clientId) : "",
      status: q.status,
      validityDays: String(q.validityDays),
      notes: q.notes ?? "",
      taxRate: String(q.taxRate),
      items: q.items?.length > 0 ? q.items.map((i: any) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })) : [{ description: "", quantity: 1, unitPrice: 0 }],
    });
    setEditingId(q.id);
    setShowForm(true);
  };

  const handleSubmit = () => {
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      toast({ title: "Nome obbligatorio", description: "Inserisci un nome per il preventivo.", variant: "destructive" });
      return;
    }
    const normalizedItems = form.items
      .map((item) => {
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unitPrice);
        return {
          description: String(item.description ?? "").trim(),
          quantity: Number.isFinite(quantity) ? Math.max(0, quantity) : 0,
          unitPrice: Number.isFinite(unitPrice) ? Math.max(0, unitPrice) : 0,
        };
      })
      .filter((item) => item.description.length > 0);
    if (normalizedItems.length === 0) {
      toast({ title: "Voci mancanti", description: "Aggiungi almeno una voce valida al preventivo.", variant: "destructive" });
      return;
    }
    const validityDays = Number(form.validityDays);
    const taxRate = Number(form.taxRate);
    const payload = {
      name: trimmedName,
      clientId: form.clientId ? Number(form.clientId) : null,
      status: form.status,
      validityDays: Number.isFinite(validityDays) ? Math.max(1, validityDays) : 30,
      notes: form.notes.trim() || null,
      taxRate: Number.isFinite(taxRate) ? Math.max(0, taxRate) : 22,
      items: normalizedItems.map((item) => ({
        ...item,
        total: item.quantity * item.unitPrice,
      })),
    };
    if (editingId != null) {
      updateQuote.mutate(
        { id: editingId, data: payload as any },
        {
          onSuccess: () => {
            invalidate();
            setShowForm(false);
            toast({ title: "Preventivo aggiornato" });
          },
          onError: () => {
            toast({ title: "Aggiornamento non riuscito", variant: "destructive" });
          },
        },
      );
    } else {
      createQuote.mutate(
        { data: payload as any },
        {
          onSuccess: () => {
            invalidate();
            setShowForm(false);
            toast({ title: "Preventivo creato" });
          },
          onError: () => {
            toast({ title: "Creazione non riuscita", variant: "destructive" });
          },
        },
      );
    }
  };

  const handleDelete = (id: number) => {
    if (!confirm("Eliminare questo preventivo?")) return;
    deleteQuote.mutate(
      { id },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "Preventivo spostato nel cestino" });
        },
        onError: () => {
          toast({ title: "Eliminazione non riuscita", variant: "destructive" });
        },
      },
    );
  };

  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, { description: "", quantity: 1, unitPrice: 0 }] }));
  const removeItem = (i: number) => setForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i: number, field: keyof QuoteItem, val: string | number) =>
    setForm((f) => ({ ...f, items: f.items.map((item, idx) => idx === i ? { ...item, [field]: val } : item) }));

  return (
    <Layout>
      <div className="p-4 md:p-8">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Preventivi</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {filteredQuotes.length} di {visibleQuotes.length} preventivi
            </p>
          </div>
          <div className="grid grid-cols-2 md:flex items-center gap-2">
            <button onClick={exportQuotesCsv} className="flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors">
              <Download size={14} />
              CSV
            </button>
            <button onClick={exportQuotesXlsx} className="flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors">
              <Download size={14} />
              XLSX
            </button>
            <button onClick={exportQuotesPdf} className="flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors">
              <Download size={14} />
              PDF
            </button>
            <button onClick={openCreate} className="col-span-2 md:col-span-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
              <Plus size={16} />
              Nuovo Preventivo
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca per nome, cliente, note..."
            className="w-full sm:max-w-sm px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as QuoteStatusFilter)}
            className="px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none"
          >
            <option value="all">Tutti gli stati ({statusCounts.all})</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label} ({statusCounts[value as QuoteStatusFilter] ?? 0})</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as QuoteSort)}
            className="px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none"
          >
            <option value="created_desc">Piu recenti</option>
            <option value="created_asc">Piu vecchi</option>
            <option value="total_desc">Totale: alto-basso</option>
            <option value="total_asc">Totale: basso-alto</option>
            <option value="name_asc">Nome: A-Z</option>
            <option value="name_desc">Nome: Z-A</option>
          </select>
          <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={toggleSelectAllFiltered}
            />
            Seleziona tutti i risultati
          </label>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setPresetFilter("all")}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${presetFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
          >
            Tutti
          </button>
          <button
            onClick={() => setPresetFilter("to_send")}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${presetFilter === "to_send" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
          >
            Da inviare ({presetCounts.toSend})
          </button>
          <button
            onClick={() => setPresetFilter("expired")}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${presetFilter === "expired" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
          >
            Scaduti ({presetCounts.expired})
          </button>
          <button
            onClick={() => setPresetFilter("accepted")}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${presetFilter === "accepted" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
          >
            Accettati ({presetCounts.accepted})
          </button>
        </div>

        {showForm && (
          <div className="bg-card border border-card-border rounded-xl p-6 mb-6 shadow-sm">
            <h2 className="text-sm font-semibold mb-5">{editingId ? "Modifica Preventivo" : "Nuovo Preventivo"}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nome *</label>
                <input className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Es. Preventivo Social Media Q1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Cliente</label>
                <select className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
                  <option value="">Nessun cliente</option>
                  {clientList.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Stato</label>
                <select className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Validità (giorni)</label>
                <input type="number" className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" value={form.validityDays} onChange={(e) => setForm({ ...form, validityDays: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">IVA %</label>
                <input type="number" className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Note</label>
                <input className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Note aggiuntive..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Voci</label>
                <button onClick={addItem} className="text-xs text-primary hover:underline flex items-center gap-1"><Plus size={12} /> Aggiungi voce</button>
              </div>
              <div className="space-y-2 md:space-y-0">
                <div className="hidden md:grid md:grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
                  <div className="col-span-6">Descrizione</div>
                  <div className="col-span-2 text-right">Qtà</div>
                  <div className="col-span-2 text-right">Prezzo (€)</div>
                  <div className="col-span-1 text-right">Totale</div>
                  <div className="col-span-1" />
                </div>
                {form.items.map((item, i) => (
                  <div key={i} className="rounded-lg border border-border/60 p-3 md:p-0 md:border-0 md:grid md:grid-cols-12 md:gap-2 md:items-center">
                    <div className="md:col-span-6">
                      <label className="mb-1 block text-[11px] text-muted-foreground md:hidden">Descrizione</label>
                      <input className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Descrizione servizio" value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} />
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 md:mt-0 md:col-span-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[11px] text-muted-foreground md:hidden">Qtà</label>
                        <input type="number" className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none text-right" value={item.quantity} onChange={(e) => updateItem(i, "quantity", Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-muted-foreground md:hidden">Prezzo (€)</label>
                        <input type="number" className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none text-right" value={item.unitPrice} onChange={(e) => updateItem(i, "unitPrice", Number(e.target.value))} />
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between md:mt-0 md:col-span-2 md:justify-end md:gap-2">
                      <div className="text-sm font-medium md:text-right">{formatCurrency(item.quantity * item.unitPrice)}</div>
                      <button onClick={() => removeItem(i)} className="flex justify-center text-muted-foreground hover:text-destructive"><X size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-border">
                <div className="flex flex-col md:flex-row md:justify-end gap-2 md:gap-6 text-sm">
                  <span className="text-muted-foreground">Subtotale: <span className="font-medium text-foreground">{formatCurrency(subtotal)}</span></span>
                  <span className="text-muted-foreground">IVA {form.taxRate}%: <span className="font-medium text-foreground">{formatCurrency(total - subtotal)}</span></span>
                  <span className="font-bold">Totale: {formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button onClick={handleSubmit} disabled={createQuote.isPending || updateQuote.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
                <Check size={14} />
                {editingId ? "Aggiorna" : "Crea Preventivo"}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:opacity-80">Annulla</button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="text-center text-muted-foreground py-12">Caricamento...</div>
        ) : filteredQuotes.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm mb-3">
              {visibleQuotes.length === 0 ? "Nessun preventivo creato" : "Nessun preventivo con i filtri attivi"}
            </p>
            <button onClick={openCreate} className="text-sm text-primary hover:underline">Crea il primo preventivo</button>
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredQuotes.map((q: any) => (
              <div key={q.id} className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
                <div className="flex flex-wrap md:flex-nowrap items-start md:items-center gap-3 md:gap-4 p-4">
                  <input
                    type="checkbox"
                    checked={selectedQuoteIds.includes(Number(q.id))}
                    onChange={() => toggleQuoteSelection(Number(q.id))}
                    aria-label={`Seleziona preventivo ${q.name}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-sm">{q.name}</p>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_STYLES[q.status])}>
                        {STATUS_LABELS[q.status]}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 md:gap-3 text-xs text-muted-foreground">
                      {q.clientName && <span>Cliente: <span className="text-foreground">{q.clientName}</span></span>}
                      <span>Validità: {q.validityDays} giorni</span>
                      <span>IVA: {q.taxRate}%</span>
                      <span>Creato: {formatDate(q.createdAt)}</span>
                    </div>
                  </div>
                  <div className="text-left md:text-right shrink-0 w-full md:w-auto">
                    <p className="text-xs text-muted-foreground">Totale</p>
                    <p className="font-bold text-lg">{formatCurrency(q.total)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 w-full md:w-auto justify-end">
                    <button onClick={() => setExpandedId(expandedId === q.id ? null : q.id)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                      {expandedId === q.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                    <button
                      onClick={() => {
                        const q2 = q;
                        const esc = (s: string) => { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; };
                        const itemsHtml = q2.items.map((i: any) => `<tr><td style="padding:8px;border-bottom:1px solid #eee">${esc(i.description)}</td><td style="padding:8px;text-align:right;border-bottom:1px solid #eee">${i.quantity}</td><td style="padding:8px;text-align:right;border-bottom:1px solid #eee">${formatCurrency(i.unitPrice)}</td><td style="padding:8px;text-align:right;border-bottom:1px solid #eee;font-weight:600">${formatCurrency(i.total)}</td></tr>`).join("");
                        const html = `<html><head><title>Preventivo ${esc(q2.name)}</title><style>body{font-family:system-ui,sans-serif;margin:40px;color:#333}h1{color:#4a6629;font-size:24px}table{width:100%;border-collapse:collapse;margin:20px 0}th{text-align:left;padding:8px;border-bottom:2px solid #4a6629;font-size:12px;text-transform:uppercase;color:#666}.totals{text-align:right;margin-top:16px;font-size:14px}.brand{font-size:10px;color:#999;margin-top:40px;border-top:1px solid #eee;padding-top:12px}@media print{body{margin:20px}}</style></head><body><h1>Preventivo: ${esc(q2.name)}</h1><p style="color:#666;font-size:13px">${q2.clientName ? `Cliente: ${esc(q2.clientName)} · ` : ""}Validità: ${q2.validityDays} giorni · IVA: ${q2.taxRate}% · Creato: ${formatDate(q2.createdAt)}</p><table><thead><tr><th>Descrizione</th><th style="text-align:right">Qtà</th><th style="text-align:right">Prezzo unit.</th><th style="text-align:right">Totale</th></tr></thead><tbody>${itemsHtml}</tbody></table><div class="totals"><p>Subtotale: <strong>${formatCurrency(q2.subtotal)}</strong></p><p>IVA ${q2.taxRate}%: <strong>${formatCurrency(q2.total - q2.subtotal)}</strong></p><p style="font-size:18px;font-weight:bold;color:#4a6629">Totale: ${formatCurrency(q2.total)}</p></div>${q2.notes ? `<p style="margin-top:20px;color:#666;font-style:italic;font-size:12px">Note: ${esc(q2.notes)}</p>` : ""}<div class="brand">Be Kind Social Agency HUB</div></body></html>`;
                        const win = window.open("", "_blank");
                        if (!win) return;
                        win.document.write(html);
                        win.document.close();
                        setTimeout(() => { win.print(); }, 300);
                      }}
                      className="p-1.5 text-muted-foreground hover:text-emerald-600 transition-colors"
                      title="Esporta PDF"
                    >
                      <Printer size={14} />
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await portalFetch(`/api/quotes/${q.id}/duplicate`, { method: "POST" });
                          qc.invalidateQueries({ queryKey: getListQuoteTemplatesQueryKey() });
                          toast({ title: "Preventivo duplicato" });
                        } catch {
                          toast({ title: "Duplicazione non riuscita", variant: "destructive" });
                        }
                      }}
                      className="p-1.5 text-muted-foreground hover:text-blue-600 transition-colors"
                      title="Duplica"
                    >
                      <Copy size={14} />
                    </button>
                    <button onClick={() => openEdit(q)} className="p-1.5 text-muted-foreground hover:text-primary transition-colors" title="Modifica">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(q.id)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors" title="Elimina">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {expandedId === q.id && (
                  <div className="border-t border-border px-4 pb-4 pt-3 bg-muted/30">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs font-medium text-muted-foreground border-b border-border">
                          <th className="text-left pb-2">Descrizione</th>
                          <th className="text-right pb-2 w-16">Qtà</th>
                          <th className="text-right pb-2 w-28">Prezzo unit.</th>
                          <th className="text-right pb-2 w-28">Totale</th>
                        </tr>
                      </thead>
                      <tbody>
                        {q.items.map((item: any, idx: number) => (
                          <tr key={idx} className="border-b border-border/50 last:border-0">
                            <td className="py-2">{item.description}</td>
                            <td className="py-2 text-right">{item.quantity}</td>
                            <td className="py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                            <td className="py-2 text-right font-medium">{formatCurrency(item.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-3 flex justify-end gap-6 text-sm">
                      <span className="text-muted-foreground">Subtotale: <span className="font-medium text-foreground">{formatCurrency(q.subtotal)}</span></span>
                      <span className="text-muted-foreground">IVA {q.taxRate}%: <span className="font-medium text-foreground">{formatCurrency(q.total - q.subtotal)}</span></span>
                      <span className="font-bold">Totale: {formatCurrency(q.total)}</span>
                    </div>
                    {q.notes && <p className="mt-3 text-xs text-muted-foreground italic">Note: {q.notes}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {selectedQuoteIds.length > 0 && (
          <div className="fixed bottom-4 left-4 right-4 md:left-1/2 md:right-auto z-40 md:-translate-x-1/2 rounded-xl border border-border bg-card px-4 py-3 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <span className="text-sm">{selectedQuoteIds.length} selezionati</span>
              <button
                onClick={() => void handleBulkDeleteQuotes()}
                disabled={bulkDeleting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
              >
                <Trash2 size={13} />
                {bulkDeleting ? "Eliminazione..." : "Elimina selezionati"}
              </button>
              <button
                onClick={() => setSelectedQuoteIds([])}
                className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted"
              >
                Annulla
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
