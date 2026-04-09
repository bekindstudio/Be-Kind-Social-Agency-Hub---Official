import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { Plus, Trash2, Search, ExternalLink, MessageSquare, List, LayoutGrid, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type ClientRow = any;

const SERVICE_TYPES = ["Social", "Meta Ads", "Google Ads", "Web", "Branding", "Email Marketing"];
const CONTRACT_STATUS = ["attivo", "in_scadenza", "scaduto", "nessuno"];

function getHealthColor(score: number) {
  if (score >= 80) return "bg-emerald-100 text-emerald-700";
  if (score >= 60) return "bg-teal-100 text-teal-700";
  if (score >= 40) return "bg-amber-100 text-amber-700";
  if (score >= 20) return "bg-orange-100 text-orange-700";
  return "bg-red-100 text-red-700";
}

function ClientLogo({ name, color, logoUrl }: { name: string; color?: string; logoUrl?: string | null }) {
  if (logoUrl) {
    return <img src={logoUrl} alt={name} className="w-full h-full object-contain p-2" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />;
  }
  return <div className="w-full h-full flex items-center justify-center text-white font-bold text-3xl" style={{ backgroundColor: color ?? "#7a8f5c" }}>{name.charAt(0).toUpperCase()}</div>;
}

export default function Clients() {
  const [, navigate] = useLocation();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<"generali" | "contatti" | "servizi" | "fatturazione" | "accessi">("generali");
  const [form, setForm] = useState<any>({
    name: "", nomeCommerciale: "", ragioneSociale: "", settore: "", dimensione: "", website: "", descrizione: "", comeAcquisito: "", clienteDal: "", noteInterne: "", color: "#7a8f5c", brandColor: "#7a8f5c", logoUrl: "", accountManagerId: "", tags: "", contacts: [{ nome: "", cognome: "", ruolo: "", email: "", telefono: "", isPrimary: true, metodoContattoPreferito: "Email", orarioPreferito: "Mattina" }], services: [], piva: "", codiceFiscale: "", sdi: "", pec: "", indirizzo: "", metodoPagamento: "Bonifico", terminiPagamento: "30gg", iban: "",
  });
  const [duplicateMatches, setDuplicateMatches] = useState<Array<{ id: number; name: string }>>([]);
  const [filterService, setFilterService] = useState("");
  const [filterContract, setFilterContract] = useState("");
  const [filterSector, setFilterSector] = useState("");
  const [filterHealth, setFilterHealth] = useState("");

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/clients");
        const data = await res.json();
        setClients(Array.isArray(data) ? data : []);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    return clients
      .filter((c) => String(c.name ?? "").toLowerCase().includes(search.toLowerCase()))
      .filter((c) => !filterContract || c.contractStatus === filterContract)
      .filter((c) => !filterSector || c.settore === filterSector)
      .filter((c) => !filterService || JSON.stringify(c.servicesJson ?? "").toLowerCase().includes(filterService.toLowerCase()))
      .filter((c) => {
        if (!filterHealth) return true;
        const hs = Number(c.healthScore ?? 0);
        if (filterHealth === "critical") return hs < 40;
        if (filterHealth === "good") return hs >= 60;
        return hs >= 40 && hs < 60;
      });
  }, [clients, search, filterContract, filterSector, filterService, filterHealth]);

  useEffect(() => {
    const check = async () => {
      if (!form.name?.trim() && !form.piva?.trim()) return setDuplicateMatches([]);
      const res = await fetch(`/api/clients/duplicate-check?q=${encodeURIComponent(form.name ?? "")}&piva=${encodeURIComponent(form.piva ?? "")}`);
      const data = await res.json();
      setDuplicateMatches(Array.isArray(data?.matches) ? data.matches : []);
    };
    const t = setTimeout(check, 300);
    return () => clearTimeout(t);
  }, [form.name, form.piva]);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, company: form.nomeCommerciale || form.name, tags: String(form.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean) }),
    });
    if (!res.ok) return;
    const client = await res.json();
    setClients((prev) => [client, ...prev]);
    setShowForm(false);
    navigate(`/clients/${client.id}`);
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Eliminare questo cliente?")) return;
    const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
    if (res.ok) setClients((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Client Management</h1>
            <p className="text-muted-foreground text-sm mt-1">{clients.length} clienti totali</p>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"><Plus size={16} /> Nuovo Cliente</button>
        </div>

        {showForm && (
          <div className="bg-card border border-card-border rounded-xl p-6 mb-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              {(["generali", "contatti", "servizi", "fatturazione", "accessi"] as const).map((t) => (
                <button key={t} onClick={() => setActiveTab(t)} className={cn("px-3 py-1.5 text-xs rounded-lg", activeTab === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{t}</button>
              ))}
            </div>
            {duplicateMatches.length > 0 && (
              <div className="mb-3 p-3 rounded-lg bg-amber-50 text-amber-700 text-sm">
                <div className="font-medium flex items-center gap-2"><AlertTriangle size={14} /> Esiste già un cliente simile</div>
                <div className="mt-1 flex flex-wrap gap-2">{duplicateMatches.map((m) => <button key={m.id} onClick={() => navigate(`/clients/${m.id}`)} className="px-2 py-1 text-xs rounded bg-white border border-amber-200 hover:bg-amber-100">{m.name}</button>)}</div>
              </div>
            )}
            {activeTab === "generali" && (
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs text-muted-foreground">Company name *</label><input className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">Ragione sociale</label><input className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background" value={form.ragioneSociale} onChange={(e) => setForm({ ...form, ragioneSociale: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">Settore</label><input className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background" value={form.settore} onChange={(e) => setForm({ ...form, settore: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">Dimensione</label><select className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background" value={form.dimensione} onChange={(e) => setForm({ ...form, dimensione: e.target.value })}><option value="">Seleziona</option><option>Freelance</option><option>Micro (1-9)</option><option>Piccola (10-49)</option><option>Media (50-249)</option><option>Grande (250+)</option></select></div>
                <div><label className="text-xs text-muted-foreground">Website</label><input className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">Tags (comma)</label><input className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">Brand color</label><input type="color" className="h-9 w-20 border border-input rounded-lg bg-background mt-1" value={form.brandColor} onChange={(e) => setForm({ ...form, brandColor: e.target.value, color: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">Cliente dal</label><input type="date" className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background" value={form.clienteDal} onChange={(e) => setForm({ ...form, clienteDal: e.target.value })} /></div>
                <div className="col-span-2"><label className="text-xs text-muted-foreground">Descrizione</label><textarea rows={3} className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background" value={form.descrizione} onChange={(e) => setForm({ ...form, descrizione: e.target.value })} /></div>
              </div>
            )}
            {activeTab === "contatti" && (
              <div className="space-y-3">
                {form.contacts.map((c: any, i: number) => (
                  <div key={i} className="grid grid-cols-4 gap-3">
                    <input placeholder="Nome" className="px-3 py-2 text-sm border border-input rounded-lg bg-background" value={c.nome} onChange={(e) => { const next = [...form.contacts]; next[i].nome = e.target.value; setForm({ ...form, contacts: next }); }} />
                    <input placeholder="Cognome" className="px-3 py-2 text-sm border border-input rounded-lg bg-background" value={c.cognome} onChange={(e) => { const next = [...form.contacts]; next[i].cognome = e.target.value; setForm({ ...form, contacts: next }); }} />
                    <input placeholder="Ruolo" className="px-3 py-2 text-sm border border-input rounded-lg bg-background" value={c.ruolo} onChange={(e) => { const next = [...form.contacts]; next[i].ruolo = e.target.value; setForm({ ...form, contacts: next }); }} />
                    <input placeholder="Email" className="px-3 py-2 text-sm border border-input rounded-lg bg-background" value={c.email} onChange={(e) => { const next = [...form.contacts]; next[i].email = e.target.value; setForm({ ...form, contacts: next }); }} />
                  </div>
                ))}
                <button className="text-xs text-primary hover:underline" onClick={() => setForm({ ...form, contacts: [...form.contacts, { nome: "", cognome: "", ruolo: "", email: "", telefono: "" }] })}>+ aggiungi contatto</button>
              </div>
            )}
            {activeTab === "servizi" && (
              <div className="grid grid-cols-3 gap-2">
                {SERVICE_TYPES.map((s) => {
                  const active = form.services.includes(s);
                  return <button key={s} onClick={() => setForm({ ...form, services: active ? form.services.filter((x: string) => x !== s) : [...form.services, s] })} className={cn("px-3 py-2 text-sm rounded-lg border", active ? "bg-primary/10 border-primary text-primary" : "bg-background border-input")}>{s}</button>;
                })}
              </div>
            )}
            {activeTab === "fatturazione" && (
              <div className="grid grid-cols-3 gap-3">
                <input placeholder="P.IVA" className="px-3 py-2 text-sm border border-input rounded-lg bg-background" value={form.piva} onChange={(e) => setForm({ ...form, piva: e.target.value })} />
                <input placeholder="Codice Fiscale" className="px-3 py-2 text-sm border border-input rounded-lg bg-background" value={form.codiceFiscale} onChange={(e) => setForm({ ...form, codiceFiscale: e.target.value })} />
                <input placeholder="PEC" className="px-3 py-2 text-sm border border-input rounded-lg bg-background" value={form.pec} onChange={(e) => setForm({ ...form, pec: e.target.value })} />
              </div>
            )}
            {activeTab === "accessi" && <div className="p-3 rounded-lg bg-amber-50 text-amber-700 text-sm">Non conservare mai le password qui. Usa un password manager separato.</div>}
            <div className="flex gap-2 mt-4">
              <button onClick={handleCreate} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">Salva Cliente</button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:opacity-80">Annulla</button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input className="w-full pl-9 pr-4 py-2.5 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Cerca clienti..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <select className="px-3 py-2 text-sm border border-input rounded-lg bg-background" value={filterService} onChange={(e) => setFilterService(e.target.value)}><option value="">Servizio</option>{SERVICE_TYPES.map((s) => <option key={s}>{s}</option>)}</select>
          <select className="px-3 py-2 text-sm border border-input rounded-lg bg-background" value={filterContract} onChange={(e) => setFilterContract(e.target.value)}><option value="">Contratto</option>{CONTRACT_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          <select className="px-3 py-2 text-sm border border-input rounded-lg bg-background" value={filterHealth} onChange={(e) => setFilterHealth(e.target.value)}><option value="">Health</option><option value="good">Buono/Ottimo</option><option value="attention">Attenzione</option><option value="critical">Rischio/Critico</option></select>
          <button onClick={() => setViewMode(viewMode === "card" ? "table" : "card")} className="px-3 py-2 border border-input rounded-lg bg-background">{viewMode === "card" ? <List size={16} /> : <LayoutGrid size={16} />}</button>
        </div>

        {isLoading ? <div className="text-center text-muted-foreground py-12">Caricamento...</div> : filtered.length === 0 ? <div className="text-center text-muted-foreground py-12">Nessun cliente trovato</div> : viewMode === "card" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((client) => (
              <Link key={client.id} href={`/clients/${client.id}`}>
                <div className="group bg-card border border-card-border rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all cursor-pointer relative">
                  <div className="p-4 flex items-center gap-3">
                    <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0" style={{ backgroundColor: client.logoUrl ? "#f8f8f6" : client.brandColor ?? client.color }}><ClientLogo name={client.name} color={client.brandColor ?? client.color} logoUrl={client.logoUrl} /></div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">{client.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{client.settore ?? "Settore non impostato"}</p>
                      <div className="flex items-center gap-1.5 mt-1"><span className={cn("text-[11px] px-2 py-0.5 rounded-full font-medium", getHealthColor(Number(client.healthScore ?? 0)))}>Health {client.healthScore ?? 0}</span><span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{client.contractStatus ?? "nessuno"}</span></div>
                    </div>
                  </div>
                  <div className="px-4 pb-4">
                    <div className="flex flex-wrap gap-1 mb-3">{(JSON.parse(client.tagsJson ?? "[]") as string[]).slice(0, 4).map((tag) => <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{tag}</span>)}</div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">€ {Number(client.monthlyValue ?? 0).toLocaleString("it-IT")}/mese</div>
                      <div className="flex items-center gap-1">
                        <button onClick={(e) => { e.preventDefault(); navigate(`/clients/${client.id}`); }} className="p-1.5 rounded hover:bg-muted"><ExternalLink size={13} /></button>
                        <button onClick={(e) => { e.preventDefault(); navigate("/tasks"); }} className="p-1.5 rounded hover:bg-muted"><Plus size={13} /></button>
                        <button onClick={(e) => { e.preventDefault(); navigate("/chat"); }} className="p-1.5 rounded hover:bg-muted"><MessageSquare size={13} /></button>
                      </div>
                    </div>
                  </div>
                  <button onClick={(e) => handleDelete(e, client.id)} className="absolute top-2 right-2 p-1.5 bg-white/80 rounded-lg text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all shadow-sm"><Trash2 size={13} /></button>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-card border border-card-border rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-card-border bg-muted/30"><th className="px-3 py-2 text-left">Logo</th><th className="px-3 py-2 text-left">Client</th><th className="px-3 py-2 text-left">Sector</th><th className="px-3 py-2 text-left">Services</th><th className="px-3 py-2 text-left">Contract</th><th className="px-3 py-2 text-left">Monthly value</th><th className="px-3 py-2 text-left">Last activity</th><th className="px-3 py-2 text-right">Actions</th></tr></thead>
              <tbody>{filtered.map((c) => <tr key={c.id} className="border-b border-card-border/50"><td className="px-3 py-2"><div className="w-8 h-8 rounded-full overflow-hidden" style={{ backgroundColor: c.brandColor ?? c.color }}><ClientLogo name={c.name} logoUrl={c.logoUrl} color={c.brandColor ?? c.color} /></div></td><td className="px-3 py-2">{c.name}</td><td className="px-3 py-2">{c.settore ?? "—"}</td><td className="px-3 py-2">{(JSON.parse(c.tagsJson ?? "[]") as string[]).slice(0, 2).join(", ") || "—"}</td><td className="px-3 py-2">{c.contractStatus ?? "nessuno"}</td><td className="px-3 py-2">€ {Number(c.monthlyValue ?? 0).toLocaleString("it-IT")}</td><td className="px-3 py-2">{c.lastActivityAt ? new Date(c.lastActivityAt).toLocaleDateString("it-IT") : "—"}</td><td className="px-3 py-2 text-right"><button onClick={() => navigate(`/clients/${c.id}`)} className="p-1.5 rounded hover:bg-muted"><ExternalLink size={13} /></button></td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
