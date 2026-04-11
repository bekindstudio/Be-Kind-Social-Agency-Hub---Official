import { useState, useCallback, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import {
  Plus, Trash2, Pencil, X, Save, Phone, Mail, Calendar, Briefcase,
  User, MapPin, Linkedin, FileText, Camera, ChevronDown, ChevronUp, Shield, Building, Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { portalFetch } from "@workspace/api-client-react";

const AVATAR_COLORS = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#0ea5e9", "#8b5cf6", "#ef4444", "#14b8a6", "#f97316", "#06b6d4", "#84cc16", "#a855f7"];

const ROLES = [
  "Titolare",
  "Direttore Creativo",
  "Account Manager",
  "Social Media Manager",
  "Content Creator",
  "Graphic Designer",
  "Copywriter",
  "Media Buyer",
  "Web Developer",
  "Video Editor",
  "Fotografo",
  "SEO Specialist",
  "Community Manager",
  "Strategist",
  "Project Manager",
  "Stagista",
  "Collaboratore",
];

const DEPARTMENTS = [
  "Direzione",
  "Creativo",
  "Account",
  "Social Media",
  "Advertising",
  "Sviluppo Web",
  "Contenuti",
  "Strategia",
];

type TeamMember = {
  id: number;
  authUserId: string | null;
  name: string;
  surname: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  birthDate: string | null;
  hireDate: string | null;
  photoUrl: string;
  avatarColor: string;
  linkedin: string;
  notes: string;
  isActive: string;
  createdAt: string;
  updatedAt: string;
};

type ClientOption = {
  id: number;
  name: string;
};

type ClientAccess = {
  id: number;
  teamMemberId: number;
  clientId: number;
  clientName: string | null;
  createdAt: string;
};

const EMPTY_FORM = {
  name: "",
  surname: "",
  email: "",
  phone: "",
  role: "Collaboratore",
  department: "",
  birthDate: "",
  hireDate: "",
  photoUrl: "",
  avatarColor: "#6366f1",
  linkedin: "",
  notes: "",
  authUserId: "",
};

export default function Team() {
  const { isAdmin } = useUserRole();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [allClients, setAllClients] = useState<ClientOption[]>([]);
  const [memberAccess, setMemberAccess] = useState<Record<number, number[]>>({});
  const [savingAccess, setSavingAccess] = useState<number | null>(null);
  const [invitingId, setInvitingId] = useState<number | null>(null);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await portalFetch("/api/team");
      if (res.ok) {
        const raw: unknown[] = await res.json();
        setMembers(
          raw.map((row) => {
            const o = row as Record<string, unknown>;
            return {
              ...o,
              authUserId:
                (typeof o.authUserId === "string" && o.authUserId) ||
                (typeof o.clerkUserId === "string" && o.clerkUserId) ||
                null,
            } as TeamMember;
          }),
        );
      }
    } catch {} finally { setLoading(false); }
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      const res = await portalFetch("/api/clients");
      if (res.ok) {
        const data = await res.json();
        setAllClients(data.map((c: any) => ({ id: c.id, name: c.name })));
      }
    } catch {}
  }, []);

  const fetchMemberAccess = useCallback(async (memberId: number) => {
    try {
      const res = await portalFetch(`/api/team-client-access/${memberId}`);
      if (res.ok) {
        const data: ClientAccess[] = await res.json();
        setMemberAccess((prev) => ({ ...prev, [memberId]: data.map((a) => a.clientId) }));
      }
    } catch {}
  }, []);

  const saveClientAccess = useCallback(async (memberId: number, clientIds: number[]) => {
    setSavingAccess(memberId);
    try {
      await portalFetch(`/api/team-client-access/${memberId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientIds }),
      });
      setMemberAccess((prev) => ({ ...prev, [memberId]: clientIds }));
    } catch {} finally { setSavingAccess(null); }
  }, []);

  useEffect(() => { fetchMembers(); fetchClients(); }, [fetchMembers, fetchClients]);

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) return;
    setSaving(true);
    try {
      const url = editId ? `/api/team/${editId}` : "/api/team";
      const method = editId ? "PATCH" : "POST";
      const res = await portalFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          birthDate: form.birthDate || null,
          hireDate: form.hireDate || null,
        }),
      });
      if (res.ok) {
        await fetchMembers();
        setShowForm(false);
        setEditId(null);
        setForm(EMPTY_FORM);
      }
    } catch {} finally { setSaving(false); }
  };

  const handleEdit = (m: TeamMember) => {
    setEditId(m.id);
    setForm({
      name: m.name,
      surname: m.surname ?? "",
      email: m.email,
      phone: m.phone ?? "",
      role: m.role,
      department: m.department ?? "",
      birthDate: m.birthDate ?? "",
      hireDate: m.hireDate ?? "",
      photoUrl: m.photoUrl ?? "",
      avatarColor: m.avatarColor,
      linkedin: m.linkedin ?? "",
      notes: m.notes ?? "",
      authUserId: m.authUserId ?? "",
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Rimuovere questo membro dal team?")) return;
    await portalFetch(`/api/team/${id}`, { method: "DELETE" });
    await fetchMembers();
  };

  const sendSupabaseInvite = async (e: React.MouseEvent, memberId: number) => {
    e.stopPropagation();
    setInvitingId(memberId);
    try {
      const res = await portalFetch(`/api/team/${memberId}/supabase-invite`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(typeof data.error === "string" ? data.error : "Invito non riuscito");
        return;
      }
      window.alert("Invito inviato all’email del membro. Chiedi di controllare anche lo spam e di usare il link nell’email.");
    } catch {
      window.alert("Errore di rete");
    } finally {
      setInvitingId(null);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditId(null);
    setForm(EMPTY_FORM);
  };

  const filtered = members.filter((m) => {
    const matchSearch = `${m.name} ${m.surname} ${m.email} ${m.role}`.toLowerCase().includes(search.toLowerCase());
    const matchDept = !filterDept || m.department === filterDept;
    return matchSearch && matchDept;
  });

  const activeDepts = [...new Set(members.map((m) => m.department).filter(Boolean))];

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
  };

  const getInitials = (m: TeamMember) => {
    const first = m.name?.[0] ?? "";
    const last = m.surname?.[0] ?? "";
    return (first + last).toUpperCase() || "?";
  };

  const f = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <Layout>
      <div className="p-8 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Team</h1>
            <p className="text-muted-foreground text-sm mt-1">{members.length} collaboratori</p>
          </div>
          <button
            onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY_FORM); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={16} />
            Aggiungi Membro
          </button>
        </div>

        {showForm && (
          <div className="bg-card border border-card-border rounded-xl p-6 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold">{editId ? "Modifica Membro" : "Nuovo Membro"}</h2>
              <button onClick={handleCancel} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted">
                <X size={16} />
              </button>
            </div>

            <div className="flex items-start gap-6 mb-5">
              <div className="flex flex-col items-center gap-2">
                <div className="relative">
                  {form.photoUrl ? (
                    <img src={form.photoUrl} alt="Foto" className="w-20 h-20 rounded-full object-cover border-2 border-card-border" />
                  ) : (
                    <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-xl font-bold" style={{ backgroundColor: form.avatarColor }}>
                      {(form.name[0] ?? "").toUpperCase()}{(form.surname[0] ?? "").toUpperCase()}
                    </div>
                  )}
                  <label className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary rounded-full flex items-center justify-center cursor-pointer hover:opacity-90 shadow-md">
                    <Camera size={13} className="text-primary-foreground" />
                    <input
                      type="text"
                      className="hidden"
                    />
                  </label>
                </div>
                <div className="flex gap-1.5 flex-wrap justify-center max-w-[120px]">
                  {AVATAR_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => f("avatarColor", c)}
                      className="w-5 h-5 rounded-full transition-transform hover:scale-125"
                      style={{ backgroundColor: c, outline: form.avatarColor === c ? `2px solid ${c}` : "none", outlineOffset: "2px" }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex-1 grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Nome *</label>
                  <input className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Mario" value={form.name} onChange={(e) => f("name", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Cognome</label>
                  <input className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Rossi" value={form.surname} onChange={(e) => f("surname", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Email *</label>
                  <input type="email" className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="mario@bekind.it" value={form.email} onChange={(e) => f("email", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Telefono</label>
                  <input type="tel" className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="+39 333 1234567" value={form.phone} onChange={(e) => f("phone", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Ruolo</label>
                  <select className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" value={form.role} onChange={(e) => f("role", e.target.value)}>
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Reparto</label>
                  <select className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" value={form.department} onChange={(e) => f("department", e.target.value)}>
                    <option value="">— Nessuno —</option>
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Data di nascita</label>
                  <input type="date" className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" value={form.birthDate} onChange={(e) => f("birthDate", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Data di assunzione</label>
                  <input type="date" className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" value={form.hireDate} onChange={(e) => f("hireDate", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">URL foto profilo</label>
                  <input type="url" className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="https://..." value={form.photoUrl} onChange={(e) => f("photoUrl", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">LinkedIn</label>
                  <input type="url" className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="https://linkedin.com/in/..." value={form.linkedin} onChange={(e) => f("linkedin", e.target.value)} />
                </div>
                {isAdmin && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Supabase User ID (opzionale)</label>
                    <input type="text" className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring font-mono" placeholder="UUID dopo il primo accesso…" value={form.authUserId} onChange={(e) => f("authUserId", e.target.value)} />
                  </div>
                )}
                <div className={isAdmin ? "" : "col-span-2"}>
                  <label className="text-xs font-medium text-muted-foreground">Note</label>
                  <textarea className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none" rows={2} placeholder="Competenze, note interne..." value={form.notes} onChange={(e) => f("notes", e.target.value)} />
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={handleCancel} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:opacity-80">Annulla</button>
              <button onClick={handleSave} disabled={saving || !form.name.trim() || !form.email.trim()} className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                <Save size={14} />
                {saving ? "Salvataggio..." : editId ? "Salva Modifiche" : "Aggiungi"}
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-xs">
            <input
              className="w-full pl-9 pr-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Cerca per nome, email, ruolo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>
          {activeDepts.length > 0 && (
            <select
              className="px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
            >
              <option value="">Tutti i reparti</option>
              {activeDepts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground py-12">Caricamento...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            {members.length === 0 ? "Nessun membro del team. Aggiungi il primo!" : "Nessun risultato per la ricerca"}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((m) => {
              const isExpanded = expandedId === m.id;
              return (
                <div key={m.id} className="bg-card border border-card-border rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                  <div
                    className="flex items-center gap-4 p-4 cursor-pointer"
                    onClick={() => {
                      const newId = isExpanded ? null : m.id;
                      setExpandedId(newId);
                      if (newId && isAdmin && !memberAccess[newId]) fetchMemberAccess(newId);
                    }}
                  >
                    {m.photoUrl ? (
                      <img src={m.photoUrl} alt={m.name} className="w-12 h-12 rounded-full object-cover border-2 border-card-border shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base shrink-0" style={{ backgroundColor: m.avatarColor }}>
                        {getInitials(m)}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{m.name} {m.surname}</p>
                        {m.department && (
                          <span className="text-[11px] px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">{m.department}</span>
                        )}
                      </div>
                      <p className="text-xs text-primary font-medium">{m.role}</p>
                    </div>

                    <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
                      {m.email && (
                        <span className="flex items-center gap-1.5 truncate max-w-[200px]">
                          <Mail size={12} /> {m.email}
                        </span>
                      )}
                      {m.phone && (
                        <span className="flex items-center gap-1.5">
                          <Phone size={12} /> {m.phone}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isAdmin && m.email && (
                        <button
                          onClick={(e) => sendSupabaseInvite(e, m.id)}
                          disabled={invitingId === m.id}
                          className="p-1.5 text-muted-foreground hover:text-primary rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                          title="Invia invito email (accesso HUB)"
                        >
                          <Send size={14} />
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); handleEdit(m); }} className="p-1.5 text-muted-foreground hover:text-primary rounded-lg hover:bg-muted transition-colors" title="Modifica">
                        <Pencil size={14} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }} className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-muted transition-colors" title="Elimina">
                        <Trash2 size={14} />
                      </button>
                      {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-card-border px-5 py-4 bg-muted/30">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Email</p>
                          <a href={`mailto:${m.email}`} className="text-primary hover:underline text-xs">{m.email}</a>
                        </div>
                        {m.phone && (
                          <div>
                            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Telefono</p>
                            <a href={`tel:${m.phone}`} className="text-xs hover:underline">{m.phone}</a>
                          </div>
                        )}
                        <div>
                          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Ruolo</p>
                          <p className="text-xs">{m.role}</p>
                        </div>
                        {m.department && (
                          <div>
                            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Reparto</p>
                            <p className="text-xs">{m.department}</p>
                          </div>
                        )}
                        {m.birthDate && (
                          <div>
                            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Data di nascita</p>
                            <p className="text-xs flex items-center gap-1.5"><Calendar size={12} className="text-muted-foreground" /> {formatDate(m.birthDate)}</p>
                          </div>
                        )}
                        {m.hireDate && (
                          <div>
                            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Data di assunzione</p>
                            <p className="text-xs flex items-center gap-1.5"><Briefcase size={12} className="text-muted-foreground" /> {formatDate(m.hireDate)}</p>
                          </div>
                        )}
                        {m.linkedin && (
                          <div>
                            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">LinkedIn</p>
                            <a href={m.linkedin} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1.5"><Linkedin size={12} /> Profilo</a>
                          </div>
                        )}
                        {m.notes && (
                          <div className="col-span-2 sm:col-span-3">
                            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Note</p>
                            <p className="text-xs text-muted-foreground whitespace-pre-line">{m.notes}</p>
                          </div>
                        )}
                        {m.authUserId && (
                          <div className="col-span-2 sm:col-span-3">
                            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Supabase User ID</p>
                            <p className="text-xs font-mono text-muted-foreground">{m.authUserId}</p>
                          </div>
                        )}
                      {isAdmin && m.email && (
                        <div className="col-span-2 sm:col-span-3">
                          <button
                            type="button"
                            onClick={(e) => sendSupabaseInvite(e, m.id)}
                            disabled={invitingId === m.id}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-input bg-background hover:bg-muted disabled:opacity-50"
                          >
                            <Send size={14} />
                            {invitingId === m.id ? "Invio…" : "Invia invito accesso (email)"}
                          </button>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            L’email deve essere già quella del membro in anagrafica. Il collegamento all’account avviene automaticamente al primo login con la stessa email.
                          </p>
                        </div>
                      )}
                      </div>

                      {isAdmin && (
                        <div className="mt-4 pt-4 border-t border-card-border">
                          <div className="flex items-center gap-2 mb-3">
                            <Building size={14} className="text-primary" />
                            <p className="text-xs font-semibold">Clienti assegnati</p>
                            <span className="text-[10px] text-muted-foreground ml-1">
                              {!memberAccess[m.id] || memberAccess[m.id].length === 0 ? "(Accesso a tutti i clienti)" : `(${memberAccess[m.id].length} clienti)`}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2 mb-3">
                            {allClients.map((c) => {
                              const assigned = (memberAccess[m.id] ?? []).includes(c.id);
                              return (
                                <button
                                  key={c.id}
                                  onClick={() => {
                                    const current = memberAccess[m.id] ?? [];
                                    const updated = assigned
                                      ? current.filter((id) => id !== c.id)
                                      : [...current, c.id];
                                    saveClientAccess(m.id, updated);
                                  }}
                                  disabled={savingAccess === m.id}
                                  className={cn(
                                    "px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors",
                                    assigned
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "bg-background text-muted-foreground border-input hover:border-primary/50"
                                  )}
                                >
                                  {c.name}
                                </button>
                              );
                            })}
                          </div>
                          {allClients.length === 0 && (
                            <p className="text-xs text-muted-foreground">Nessun cliente presente</p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Se nessun cliente e' assegnato, il membro vede tutti i clienti. Clicca per aggiungere/rimuovere l'accesso.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
