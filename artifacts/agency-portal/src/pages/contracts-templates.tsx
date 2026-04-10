import { useState } from "react";
import { useListContractTemplates, getListContractTemplatesQueryKey, portalFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { ArrowLeft, Plus, Pencil, X } from "lucide-react";
import { ContractRichEditor } from "@/components/contracts/ContractRichEditor";
import { extractVariableKeys, highlightVariablesInHtml, SERVICE_LABELS } from "@/lib/contracts-shared";

type TemplateRow = {
  id: number;
  name: string;
  type: string;
  content: string;
  status: string;
  variables?: string[];
  createdAt: string;
  updatedAt: string;
};

const BASE = "/api";

export default function ContractsTemplates() {
  const qc = useQueryClient();
  const { data: raw, isLoading } = useListContractTemplates();

  const templates: TemplateRow[] = Array.isArray(raw)
    ? (raw as TemplateRow[])
    : Array.isArray((raw as unknown as { items?: unknown } | undefined)?.items)
      ? ((raw as unknown as { items: TemplateRow[] }).items ?? [])
      : [];

  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftType, setDraftType] = useState("");
  const [draftContent, setDraftContent] = useState("");

  const openEdit = (t: TemplateRow) => {
    setEditing(t);
    setDraftName(t.name);
    setDraftType(t.type);
    setDraftContent(t.content ?? "");
  };

  const closeEdit = () => {
    setEditing(null);
    setDraftName("");
    setDraftType("");
    setDraftContent("");
  };

  const saveEdit = async () => {
    if (!editing) return;
    const vars = extractVariableKeys(draftContent);
    const res = await portalFetch(`${BASE}/contracts/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draftName,
        type: draftType,
        content: draftContent,
        status: editing.status,
        variables: vars,
      }),
    });
    if (!res.ok) {
      alert("Errore salvataggio template");
      return;
    }
    await qc.invalidateQueries({ queryKey: getListContractTemplatesQueryKey() });
    closeEdit();
  };

  const addCustom = async () => {
    const name = prompt("Nome template personalizzato?");
    if (!name?.trim()) return;
    const slug =
      prompt("Slug tipo servizio (es. custom_branding) — solo lettere, numeri e underscore:")?.trim() ||
      `custom_${Date.now()}`;
    const typeSlug = slug.replace(/[^a-zA-Z0-9_]/g, "_");
    const content =
      "<p><strong>Nuovo contratto</strong></p><p>Cliente: {{NOME_CLIENTE}}</p><p>Data: {{DATA_ODIERNA}}</p>";
    const variables = extractVariableKeys(content);
    const res = await portalFetch(`${BASE}/contracts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        type: typeSlug,
        content,
        status: "attivo",
        variables,
      }),
    });
    if (!res.ok) {
      alert("Errore creazione template");
      return;
    }
    await qc.invalidateQueries({ queryKey: getListContractTemplatesQueryKey() });
  };

  const labelForType = (type: string) =>
    (SERVICE_LABELS as Record<string, { title: string }>)[type]?.title ?? type;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link href="/contracts" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">
              <ArrowLeft className="h-4 w-4" />
              Contratti
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight">Template contratti</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Modifica i testi predefiniti. Le variabili <code className="text-blue-600 dark:text-blue-400">{"{{NOME}}"}</code> sono evidenziate in anteprima.
            </p>
          </div>
          <button
            type="button"
            onClick={() => addCustom()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Aggiungi template personalizzato
          </button>
        </div>

        <style>{`
          .contract-var-preview .contract-var-token { color: rgb(37 99 235); font-weight: 600; font-family: ui-monospace, monospace; }
        `}</style>

        {isLoading ? (
          <p className="text-muted-foreground">Caricamento…</p>
        ) : (
          <div className="grid gap-4">
            {templates.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-card-border bg-card p-5 shadow-sm flex flex-col lg:flex-row lg:items-stretch gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="font-semibold text-foreground">{t.name}</h2>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{t.type}</p>
                      <p className="text-xs text-muted-foreground mt-1">{labelForType(t.type)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openEdit(t)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-input text-sm hover:bg-muted/60 shrink-0"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Modifica
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(Array.isArray(t.variables) && t.variables.length > 0
                      ? t.variables
                      : extractVariableKeys(t.content ?? "")
                    ).map((v) => (
                      <span
                        key={v}
                        className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200"
                      >
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-card border border-card-border rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-card-border">
                <h3 className="font-semibold">Modifica template</h3>
                <button type="button" onClick={closeEdit} className="p-2 rounded-lg hover:bg-muted">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Nome</label>
                    <input
                      className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Slug tipo (service_type)</label>
                    <input
                      className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background font-mono"
                      value={draftType}
                      onChange={(e) => setDraftType(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid lg:grid-cols-2 gap-4 items-start">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Editor</p>
                    <ContractRichEditor value={draftContent} onChange={setDraftContent} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Anteprima variabili</p>
                    <div
                      className="contract-var-preview rounded-lg border border-input bg-muted/20 p-4 min-h-[220px] text-sm prose prose-sm max-w-none overflow-y-auto max-h-[360px]"
                      dangerouslySetInnerHTML={{ __html: highlightVariablesInHtml(draftContent) }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 px-5 py-3 border-t border-card-border">
                <button type="button" onClick={closeEdit} className="px-4 py-2 rounded-lg border border-input text-sm">
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={() => saveEdit()}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
                >
                  Salva
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
