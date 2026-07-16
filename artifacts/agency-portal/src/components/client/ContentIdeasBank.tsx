import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { portalFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { cn, formatDate } from "@/lib/utils";
import { Lightbulb, Link2, Search, Plus, ExternalLink, Trash2 } from "lucide-react";
import {
  type ContentIdeaRow,
  type IdeaStatus,
  type IdeaCategory,
  platformMeta,
  statusMeta,
  categoryMeta,
  STATUS_META,
  CATEGORY_META,
} from "@/lib/ideasSchema";

/**
 * Banca Idee — archivio dei link di ispirazione, riusato in due posti:
 *  - tab "Banca Idee" nel cockpit cliente  → <ContentIdeasBank clientId={7} />
 *  - pagina /banca-idee (tutti i clienti)  → <ContentIdeasBank />
 * Un solo componente per non tenere allineate due UI che fanno la stessa cosa.
 * Con clientId il cliente è implicito; senza, compaiono il selettore nel form
 * e il filtro per cliente.
 */

type AnyObj = Record<string, any>;

export function ContentIdeasBank({ clientId }: { clientId?: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const scoped = clientId != null;

  const listKey = scoped ? ["client-content-ideas", clientId] : ["content-ideas", "all"];
  const listPath = scoped ? `/api/clients/${clientId}/content-ideas` : "/api/content-ideas";

  const { data, isLoading } = useQuery<ContentIdeaRow[]>({
    queryKey: listKey,
    staleTime: 30_000,
    queryFn: async () => {
      const r = await portalFetch(listPath);
      if (!r.ok) throw new Error("content ideas load failed");
      const j = await r.json();
      return Array.isArray(j) ? j : [];
    },
  });
  const list = useMemo(() => data ?? [], [data]);

  // Serve solo in modalità "tutti i clienti": per scegliere dove salvare l'idea.
  const clientsQ = useQuery<AnyObj[]>({
    queryKey: ["content-ideas", "clients"],
    enabled: !scoped,
    staleTime: 300_000,
    queryFn: async () => {
      const r = await portalFetch("/api/clients");
      if (!r.ok) return [];
      const j = await r.json();
      return Array.isArray(j) ? j : Array.isArray(j?.items) ? j.items : [];
    },
  });
  const clients = clientsQ.data ?? [];

  // La tab per cliente e la pagina cross-cliente leggono le STESSE righe da due
  // endpoint diversi: dopo ogni scrittura vanno invalidate entrambe, non solo
  // quella che stai guardando. Altrimenti (staleTime 30s) cancelli un'idea dalla
  // pagina, torni sulla tab del cliente e la vedi ancora lì.
  // Invalido i due prefissi: NON basta ["content-ideas"] da solo, perché
  // catturerebbe anche ["content-ideas","clients"] (la lista clienti, inutile
  // da ricaricare a ogni idea).
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["client-content-ideas"] });
    void queryClient.invalidateQueries({ queryKey: ["content-ideas", "all"] });
  };

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [formClient, setFormClient] = useState("");
  const [formCategory, setFormCategory] = useState<IdeaCategory>("da_classificare");
  const [saving, setSaving] = useState(false);
  // Idea con un PATCH in corso: i suoi controlli restano bloccati fino alla
  // risposta, così un doppio clic non spara due richieste.
  const [busyId, setBusyId] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [fPlatform, setFPlatform] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fClient, setFClient] = useState("");
  const [fCategory, setFCategory] = useState("");

  const targetClientId = scoped ? clientId : Number(formClient) || null;

  const handleAdd = async () => {
    if (!url.trim() || !title.trim() || saving) return;
    if (targetClientId == null) {
      toast({ variant: "destructive", title: "Scegli prima il cliente" });
      return;
    }
    setSaving(true);
    try {
      const r = await portalFetch(`/api/clients/${targetClientId}/content-ideas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), url: url.trim(), category: formCategory }),
      });
      if (!r.ok) {
        let msg = "Salvataggio non riuscito";
        try { const j = await r.json(); if (j?.error) msg = String(j.error); } catch { /* ignore */ }
        toast({ variant: "destructive", title: msg });
        return;
      }
      setUrl("");
      setTitle("");
      // La categoria NON si azzera: chi archivia più idee dello stesso tipo di
      // fila non deve riselezionarla ogni volta.
      refresh();
    } catch {
      toast({ variant: "destructive", title: "Errore di rete" });
    } finally {
      setSaving(false);
    }
  };

  // Un solo PATCH per stato e categoria: cambia solo il campo passato.
  //
  // Aggiorna PRIMA la cache e poi salva (come TaskDetail e il builder del piano
  // editoriale). Senza, la tendina della categoria tornerebbe visibilmente al
  // valore vecchio per tutta la durata della richiesta: React riscrive nel DOM
  // il `value` che gli passiamo, e quel value resta quello vecchio finché non
  // torna il refetch. Sembra che il clic non abbia funzionato → si riclicca →
  // seconda richiesta inutile.
  // In caso di errore non serve un rollback a mano: refresh() rilegge dal
  // server e sovrascrive il valore ottimistico con la verità.
  const patchIdea = async (i: ContentIdeaRow, patch: { status?: IdeaStatus; category?: IdeaCategory }) => {
    const cid = i.clientId ?? clientId;
    const apply = (rows?: ContentIdeaRow[]) =>
      Array.isArray(rows) ? rows.map((r) => (r.id === i.id ? { ...r, ...patch } : r)) : rows;
    queryClient.setQueryData(["client-content-ideas", cid], apply);
    queryClient.setQueryData(["content-ideas", "all"], apply);

    setBusyId(i.id);
    try {
      const r = await portalFetch(`/api/clients/${cid}/content-ideas/${i.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!r.ok) {
        let msg = "Operazione non riuscita";
        try { const j = await r.json(); if (j?.error) msg = String(j.error); } catch { /* ignore */ }
        toast({ variant: "destructive", title: msg });
      }
    } catch {
      toast({ variant: "destructive", title: "Errore di rete" });
    } finally {
      setBusyId(null);
      refresh();
    }
  };

  const handleDelete = async (i: ContentIdeaRow) => {
    if (!confirm("Eliminare questa idea dalla banca?")) return;
    const r = await portalFetch(`/api/clients/${i.clientId ?? clientId}/content-ideas/${i.id}`, { method: "DELETE" });
    if (r.ok || r.status === 204) {
      toast({ title: "Idea eliminata" });
      refresh();
    } else {
      let msg = "Eliminazione non riuscita";
      try { const j = await r.json(); if (j?.error) msg = String(j.error); } catch { /* ignore */ }
      toast({ variant: "destructive", title: msg });
    }
  };

  const filtered = list.filter((i) => {
    if (fPlatform && i.platform !== fPlatform) return false;
    if (fStatus && i.status !== fStatus) return false;
    if (fCategory && i.category !== fCategory) return false;
    if (fClient && String(i.clientId) !== fClient) return false;
    if (q.trim()) {
      const hay = `${i.title} ${i.url} ${i.notes ?? ""} ${i.clientName ?? ""}`.toLowerCase();
      if (!hay.includes(q.trim().toLowerCase())) return false;
    }
    return true;
  });

  const fromClient = list.filter((i) => i.source === "client").length;
  const toUse = list.filter((i) => i.status !== "realizzata").length;
  // Il filtro attivo resta sempre fra le chip anche se l'ultima idea di quella
  // piattaforma sparisce: altrimenti la chip si smonta col filtro ancora attivo
  // e la griglia resta vuota senza niente da cliccare per sbloccarla.
  const platformsInUse = Array.from(new Set([...list.map((i) => i.platform), ...(fPlatform ? [fPlatform] : [])]));

  return (
    <div className="space-y-4 mb-10">
      {/* Hero: una frase che dice la cosa, niente fila di stat card */}
      <div>
        <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
          <Lightbulb size={16} className="text-primary" /> Banca idee contenuti
        </p>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight mt-1">
          {list.length === 0
            ? "Nessuna idea in banca"
            : `${toUse} ${toUse === 1 ? "idea da riprendere" : "idee da riprendere"}`}
        </h2>
        <p className="text-sm text-muted-foreground mt-2 tabular-nums">
          {list.length} in archivio · {fromClient} {fromClient === 1 ? "arrivata" : "arrivate"} dal cliente
        </p>
      </div>

      {/* Incolla link + titolo */}
      <div className="rounded-2xl border border-card-border bg-card p-4 md:p-5">
        <p className="text-sm font-semibold mb-3 inline-flex items-center gap-2">
          <Link2 size={15} className="text-primary" /> Aggiungi un'idea
        </p>
        <div className={cn("grid grid-cols-1 gap-3", scoped ? "md:grid-cols-2" : "md:grid-cols-3")}>
          {!scoped && (
            <label className="text-xs font-medium text-muted-foreground">
              Cliente
              <select
                value={formClient}
                onChange={(e) => setFormClient(e.target.value)}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="">Scegli…</option>
                {clients.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.name}</option>
                ))}
              </select>
            </label>
          )}
          <label className="text-xs font-medium text-muted-foreground">
            Link
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.instagram.com/reel/…"
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            Titolo
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Es. Reel backstage con testo a schermo"
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleAdd(); } }}
            />
          </label>
        </div>
        {/* Tipo di contenuto: facoltativo, si può classificare dopo dalla card. */}
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <label className="text-xs font-medium text-muted-foreground">
            Tipo di contenuto
            <select
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value as IdeaCategory)}
              className="mt-1 block w-full min-w-[200px] rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              {CATEGORY_META.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.value === "da_classificare" ? c.label : `${c.label} — ${c.descr}`}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={saving || !url.trim() || !title.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Plus size={15} /> Salva in banca
          </button>
        </div>
      </div>

      {/* Filtri: chip grafiche, testo al minimo */}
      {list.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cerca…"
              className="w-full rounded-lg border border-input bg-background pl-8 pr-3 py-1.5 text-sm text-foreground"
            />
          </div>
          {/* Popolato dalla lista clienti completa (come il filtro di Report e
              Strumenti), non dai clienti presenti fra le idee: così il filtro
              non può restare attivo dopo che il suo cliente è sparito dalla
              lista, lasciando la banca vuota e non sbloccabile. La condizione
              `|| fClient` garantisce che, se un filtro è attivo, la tendina per
              toglierlo ci sia sempre. */}
          {!scoped && (clients.length > 1 || fClient) && (
            <select
              value={fClient}
              onChange={(e) => setFClient(e.target.value)}
              className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-foreground"
            >
              <option value="">Tutti i clienti</option>
              {clients.map((c) => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </select>
          )}
          {/* Tendina e non chip: 7 categorie + piattaforme + stati diventerebbero
              un muro di bottoni. La lista è fissa, quindi il filtro non può
              restare bloccato su un valore sparito. */}
          <select
            value={fCategory}
            onChange={(e) => setFCategory(e.target.value)}
            className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-foreground"
          >
            <option value="">Tutti i tipi</option>
            {CATEGORY_META.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          {platformsInUse.map((p) => {
            const meta = platformMeta(p);
            const on = fPlatform === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setFPlatform(on ? "" : p)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium",
                  on ? "border-primary bg-primary/10 text-foreground" : "border-input hover:bg-muted",
                )}
              >
                <span className={cn("w-2 h-2 rounded-full", meta.color)} /> {meta.label}
              </button>
            );
          })}
          {STATUS_META.map((s) => {
            const on = fStatus === s.value;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => setFStatus(on ? "" : s.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium",
                  on ? "border-primary bg-primary/10 text-foreground" : "border-input hover:bg-muted",
                )}
              >
                <span className={cn("w-2 h-2 rounded-full", s.color)} /> {s.label}
              </button>
            );
          })}
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Caricamento…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-card-border p-8 text-center">
          <Lightbulb size={20} className="mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {list.length === 0
              ? "Incolla qui sopra il link di un reel o di un post che ti ha ispirato: lo ritrovi quando produci."
              : "Nessuna idea con questi filtri."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((i) => {
            const meta = platformMeta(i.platform);
            const Icon = meta.icon;
            const st = statusMeta(i.status);
            const cat = categoryMeta(i.category);
            return (
              <div key={i.id} className="rounded-xl border border-card-border bg-card p-3 flex items-start gap-3">
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white", meta.color)}>
                  <Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <a
                    href={i.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-medium text-sm hover:underline inline-flex items-center gap-1 max-w-full"
                  >
                    <span className="truncate">{i.title}</span>
                    <ExternalLink size={12} className="shrink-0 text-muted-foreground" />
                  </a>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    {!scoped && i.clientName ? `${i.clientName} · ` : ""}
                    {formatDate(i.createdAt)}
                    {i.source === "client" ? " · dal cliente" : ""}
                    {i.notes ? ` · ${i.notes}` : ""}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    {/* Il pallino colorato è il segnale per scorrere la griglia
                        a colpo d'occhio; la tendina è il controllo. Insieme si
                        leggono come una chip sola, senza badge doppio a destra.
                        Modificabile sul posto: un'idea mal classificata dal
                        cliente si sistema qui in un clic. */}
                    <span
                      className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2 py-1",
                        i.category === "da_classificare" ? "border-dashed border-input" : "border-input")}
                    >
                      <span className={cn("w-2 h-2 rounded-full shrink-0", cat.color)} />
                      <select
                        value={i.category}
                        onChange={(e) => void patchIdea(i, { category: e.target.value as IdeaCategory })}
                        disabled={busyId === i.id}
                        title="Tipo di contenuto"
                        className={cn(
                          "bg-transparent text-xs font-medium focus:outline-none disabled:opacity-60",
                          i.category === "da_classificare" ? "text-muted-foreground" : "text-foreground",
                        )}
                      >
                        {CATEGORY_META.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </span>
                    {STATUS_META.filter((s) => s.value !== i.status).map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => void patchIdea(i, { status: s.value })}
                        disabled={busyId === i.id}
                        className="rounded-lg border border-input px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className={cn("inline-flex items-center text-[11px] rounded-full px-2 py-0.5 text-white", st.color)}>
                    {st.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleDelete(i)}
                    className="text-muted-foreground hover:text-destructive"
                    title="Elimina"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
