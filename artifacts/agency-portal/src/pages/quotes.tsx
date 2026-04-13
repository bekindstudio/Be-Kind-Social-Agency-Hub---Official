import { useEffect, useMemo, useState } from "react";
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
import { Plus, Trash2, Pencil, X, Check, ChevronDown, ChevronUp, Printer, Copy } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { useClientContext } from "@/context/ClientContext";

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

export default function Quotes() {
  const qc = useQueryClient();
  const { activeClient } = useClientContext();
  const { data: quotes, isLoading } = useListQuoteTemplates();
  const { data: clients } = useListClients();
  const createQuote = useCreateQuoteTemplate();
  const updateQuote = useUpdateQuoteTemplate();
  const deleteQuote = useDeleteQuoteTemplate();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

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

  const invalidate = () => qc.invalidateQueries({ queryKey: getListQuoteTemplatesQueryKey() });

  const subtotal = form.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const total = subtotal * (1 + Number(form.taxRate) / 100);

  useEffect(() => {
    if (!activeBackendClientId) return;
    setForm((prev) => ({ ...prev, clientId: prev.clientId || activeBackendClientId }));
  }, [activeBackendClientId]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
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
    if (!form.name.trim()) return;
    const payload = {
      name: form.name,
      clientId: form.clientId ? Number(form.clientId) : null,
      status: form.status,
      validityDays: Number(form.validityDays),
      notes: form.notes || null,
      taxRate: Number(form.taxRate),
      items: form.items.filter((i) => i.description.trim()),
    };
    if (editingId != null) {
      updateQuote.mutate({ id: editingId, data: payload as any }, { onSuccess: () => { invalidate(); setShowForm(false); } });
    } else {
      createQuote.mutate({ data: payload as any }, { onSuccess: () => { invalidate(); setShowForm(false); } });
    }
  };

  const handleDelete = (id: number) => {
    if (!confirm("Eliminare questo preventivo?")) return;
    deleteQuote.mutate({ id }, { onSuccess: invalidate });
  };

  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, { description: "", quantity: 1, unitPrice: 0 }] }));
  const removeItem = (i: number) => setForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i: number, field: keyof QuoteItem, val: string | number) =>
    setForm((f) => ({ ...f, items: f.items.map((item, idx) => idx === i ? { ...item, [field]: val } : item) }));

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Preventivi</h1>
            <p className="text-muted-foreground text-sm mt-1">{visibleQuotes.length} preventivi template</p>
          </div>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus size={16} />
            Nuovo Preventivo
          </button>
        </div>

        {showForm && (
          <div className="bg-card border border-card-border rounded-xl p-6 mb-6 shadow-sm">
            <h2 className="text-sm font-semibold mb-5">{editingId ? "Modifica Preventivo" : "Nuovo Preventivo"}</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
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
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
                  <div className="col-span-6">Descrizione</div>
                  <div className="col-span-2 text-right">Qtà</div>
                  <div className="col-span-2 text-right">Prezzo (€)</div>
                  <div className="col-span-1 text-right">Totale</div>
                  <div className="col-span-1" />
                </div>
                {form.items.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <input className="col-span-6 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Descrizione servizio" value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} />
                    <input type="number" className="col-span-2 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none text-right" value={item.quantity} onChange={(e) => updateItem(i, "quantity", Number(e.target.value))} />
                    <input type="number" className="col-span-2 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none text-right" value={item.unitPrice} onChange={(e) => updateItem(i, "unitPrice", Number(e.target.value))} />
                    <div className="col-span-1 text-right text-sm font-medium">{formatCurrency(item.quantity * item.unitPrice)}</div>
                    <button onClick={() => removeItem(i)} className="col-span-1 flex justify-center text-muted-foreground hover:text-destructive"><X size={14} /></button>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-border">
                <div className="flex justify-end gap-6 text-sm">
                  <span className="text-muted-foreground">Subtotale: <span className="font-medium text-foreground">{formatCurrency(subtotal)}</span></span>
                  <span className="text-muted-foreground">IVA {form.taxRate}%: <span className="font-medium text-foreground">{formatCurrency(total - subtotal)}</span></span>
                  <span className="font-bold">Totale: {formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
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
        ) : visibleQuotes.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm mb-3">Nessun preventivo creato</p>
            <button onClick={openCreate} className="text-sm text-primary hover:underline">Crea il primo preventivo</button>
          </div>
        ) : (
          <div className="grid gap-3">
            {visibleQuotes.map((q: any) => (
              <div key={q.id} className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-sm">{q.name}</p>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_STYLES[q.status])}>
                        {STATUS_LABELS[q.status]}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {q.clientName && <span>Cliente: <span className="text-foreground">{q.clientName}</span></span>}
                      <span>Validità: {q.validityDays} giorni</span>
                      <span>IVA: {q.taxRate}%</span>
                      <span>Creato: {formatDate(q.createdAt)}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">Totale</p>
                    <p className="font-bold text-lg">{formatCurrency(q.total)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
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
                        } catch {}
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
      </div>
    </Layout>
  );
}
