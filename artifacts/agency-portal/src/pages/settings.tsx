import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/react";
import { Layout } from "@/components/layout/Layout";
import {
  Settings as SettingsIcon,
  Palette,
  Bell,
  Users,
  Building,
  Share2,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Info,
  ShieldCheck,
  Copy,
  Check,
  Mail,
  RefreshCw,
  X,
  Wifi,
  WifiOff,
  XCircle,
  Shield,
  ChevronDown,
  ChevronUp,
  Send,
  Megaphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";

type AgencyMeta = {
  connected: boolean;
  tokenExpired?: boolean;
  tokenExpiresAt?: string | null;
  tokenDaysLeft?: number | null;
  metaUserId?: string;
  metaUserName?: string;
  pages?: any[];
  instagramAccounts?: any[];
  adAccounts?: any[];
  lastSyncedAt?: string | null;
};

function IntegrationCard({ children, title, icon: Icon, status }: {
  children: React.ReactNode;
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  status: "connected" | "disconnected";
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon size={18} className="text-primary" />
          </div>
          <h3 className="font-semibold text-sm">{title}</h3>
        </div>
        <div className={cn(
          "flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full",
          status === "connected" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
        )}>
          <div className={cn("w-1.5 h-1.5 rounded-full", status === "connected" ? "bg-emerald-500" : "bg-gray-400")} />
          {status === "connected" ? "Connesso" : "Non connesso"}
        </div>
      </div>
      {children}
    </div>
  );
}

export default function Settings() {
  const { user } = useUser();
  const [idCopied, setIdCopied] = useState(false);
  const { isAdmin } = useUserRole();

  // Meta agency-level connection
  const [meta, setMeta] = useState<AgencyMeta | null>(null);
  const [metaToken, setMetaToken] = useState("");
  const [metaConnecting, setMetaConnecting] = useState(false);
  const [metaConnectError, setMetaConnectError] = useState("");
  const [metaRefreshing, setMetaRefreshing] = useState(false);
  const [showTokenInput, setShowTokenInput] = useState(false);

  // Google Ads
  const [googleAdsId, setGoogleAdsId] = useState("");
  const [googleSaved, setGoogleSaved] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);

  const fetchAgencyMeta = useCallback(async () => {
    try {
      const data = await fetch("/api/meta/agency-status").then((r) => r.json());
      setMeta(data);
    } catch { setMeta({ connected: false }); }
  }, []);

  useEffect(() => {
    fetchAgencyMeta();
    const savedGoogle = localStorage.getItem("bekind_google_ads_id") ?? "";
    setGoogleAdsId(savedGoogle);
    setGoogleConnected(!!savedGoogle);
  }, [fetchAgencyMeta]);

  const handleMetaConnect = async () => {
    if (!metaToken.trim()) return;
    setMetaConnecting(true);
    setMetaConnectError("");
    try {
      const res = await fetch("/api/meta/connect-agency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: metaToken.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMetaConnectError(data.error ?? "Errore durante la connessione");
        return;
      }
      await fetchAgencyMeta();
      setMetaToken("");
      setShowTokenInput(false);
    } catch {
      setMetaConnectError("Errore di rete. Riprova.");
    } finally {
      setMetaConnecting(false);
    }
  };

  const handleMetaRefresh = async () => {
    setMetaRefreshing(true);
    try {
      await fetch("/api/meta/refresh-agency", { method: "POST" });
      await fetchAgencyMeta();
    } finally {
      setMetaRefreshing(false);
    }
  };

  const handleMetaDisconnect = async () => {
    if (!confirm("Disconnettere l'account Meta dell'agenzia? Tutti i clienti perderanno l'accesso ai dati Meta.")) return;
    await fetch("/api/meta/disconnect-agency", { method: "POST" });
    setMeta({ connected: false });
    setMetaToken("");
  };

  const saveGoogleAdsId = () => {
    localStorage.setItem("bekind_google_ads_id", googleAdsId);
    setGoogleConnected(!!googleAdsId);
    setGoogleSaved(true);
    setTimeout(() => setGoogleSaved(false), 2500);
  };

  const copyUserId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      setIdCopied(true);
      setTimeout(() => setIdCopied(false), 2000);
    }
  };

  return (
    <Layout>
      <div className="p-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Impostazioni</h1>
          <p className="text-muted-foreground text-sm mt-1">Configura il tuo portale e le integrazioni</p>
        </div>

        {/* Profilo & Accessi */}
        <div className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-4 flex items-center gap-2">
            <ShieldCheck size={14} /> Profilo & Accessi
          </h2>
          <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              {user?.imageUrl && (
                <img src={user.imageUrl} alt="Avatar" className="w-12 h-12 rounded-full object-cover" />
              )}
              <div>
                <p className="font-semibold text-sm">{user?.fullName ?? user?.username ?? "Utente"}</p>
                <p className="text-xs text-muted-foreground">{user?.primaryEmailAddress?.emailAddress}</p>
              </div>
            </div>
            <div className="border-t border-border pt-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Il tuo ID utente Clerk</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-muted rounded-lg text-xs font-mono text-foreground overflow-x-auto">
                  {user?.id ?? "—"}
                </code>
                <button onClick={copyUserId} className="p-2 rounded-lg border border-input bg-background hover:bg-muted transition-colors" title="Copia ID">
                  {idCopied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} className="text-muted-foreground" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Copia questo ID e aggiungilo alla variabile d'ambiente <code className="bg-muted px-1 rounded">ADMIN_CLERK_USER_IDS</code> per ottenere i privilegi di amministratore.
              </p>
            </div>
          </div>
        </div>

        {/* Integrazioni API */}
        <div className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-4 flex items-center gap-2">
            <Share2 size={14} /> Integrazioni
          </h2>
          <div className="space-y-4">

            {/* META — real agency-level connection */}
            <IntegrationCard
              title="Connessione Meta (Facebook & Instagram)"
              icon={Share2}
              status={meta?.connected ? "connected" : "disconnected"}
            >
              {meta?.connected ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                      <Wifi size={15} />
                      Connesso come <strong className="ml-1">{meta.metaUserName}</strong>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {meta.tokenExpired && (
                        <span className="text-xs px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full font-medium">Token scaduto - riconnetti</span>
                      )}
                      {!meta.tokenExpired && meta.tokenDaysLeft != null && meta.tokenDaysLeft <= 7 && (
                        <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">Token scade tra {meta.tokenDaysLeft} giorni</span>
                      )}
                      {!meta.tokenExpired && meta.tokenDaysLeft != null && meta.tokenDaysLeft > 7 && (
                        <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">Token valido ({meta.tokenDaysLeft} giorni)</span>
                      )}
                      {meta.lastSyncedAt && (
                        <span className="text-xs text-muted-foreground">
                          Aggiornato: {new Date(meta.lastSyncedAt).toLocaleString("it-IT")}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {/* Pagine Facebook */}
                    {(meta.pages?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Pagine Facebook ({meta.pages!.length})</p>
                        <div className="space-y-1.5">
                          {meta.pages!.map((page: any) => (
                            <div key={page.id} className="flex items-center gap-3 p-2.5 bg-muted/50 rounded-xl">
                              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                                <Share2 size={12} className="text-blue-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{page.name}</p>
                                <p className="text-[11px] text-muted-foreground font-mono">ID: {page.id}</p>
                              </div>
                              {page.igUserId && (
                                <span className="text-[11px] px-2 py-0.5 bg-pink-100 text-pink-700 rounded-full font-medium">IG collegato</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Account Instagram */}
                    {(meta.instagramAccounts?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Account Instagram Business ({meta.instagramAccounts!.length})</p>
                        <div className="space-y-1.5">
                          {meta.instagramAccounts!.map((ig: any) => (
                            <div key={ig.id} className="flex items-center gap-3 p-2.5 bg-muted/50 rounded-xl">
                              <div className="w-7 h-7 rounded-full overflow-hidden bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center shrink-0">
                                {ig.profile_picture_url
                                  ? <img src={ig.profile_picture_url} alt="" className="w-full h-full object-cover" />
                                  : <span className="text-white text-[10px] font-bold">{ig.username?.[0]?.toUpperCase()}</span>}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">@{ig.username}</p>
                                <p className="text-[11px] text-muted-foreground">{ig.followers_count?.toLocaleString("it-IT")} follower · {ig.media_count} post</p>
                              </div>
                              <a href={`https://instagram.com/${ig.username}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary">
                                <ExternalLink size={12} />
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Account Pubblicitari */}
                    {(meta.adAccounts?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Account Pubblicitari Meta Ads ({meta.adAccounts!.length})</p>
                        <div className="space-y-1.5">
                          {meta.adAccounts!.map((ad: any) => (
                            <div key={ad.id} className="flex items-center gap-3 p-2.5 bg-muted/50 rounded-xl">
                              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                                <span className="text-amber-700 font-bold text-[11px]">Ads</span>
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium">{ad.name}</p>
                                <p className="text-[11px] text-muted-foreground font-mono">{ad.id} · {ad.currency}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Token expired notice */}
                  {meta.tokenExpired && (
                    <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl">
                      <p className="text-sm font-medium text-rose-700 mb-2">Token scaduto — inserisci un nuovo token per continuare</p>
                      <textarea
                        className="w-full text-xs font-mono border border-border rounded-xl p-3 bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                        rows={3}
                        placeholder="Incolla qui il nuovo token (inizia con EAA...)"
                        value={metaToken}
                        onChange={(e) => setMetaToken(e.target.value)}
                        disabled={metaConnecting}
                      />
                      {metaConnectError && (
                        <div className="flex items-center gap-2 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-2 mt-2">
                          <XCircle size={13} /> {metaConnectError}
                        </div>
                      )}
                      <button
                        onClick={handleMetaConnect}
                        disabled={metaConnecting || !metaToken.trim()}
                        className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1877F2] text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                      >
                        {metaConnecting ? <><RefreshCw size={14} className="animate-spin" /> Aggiornamento in corso...</> : "Aggiorna Token"}
                      </button>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-card-border">
                    <button
                      onClick={handleMetaRefresh}
                      disabled={metaRefreshing}
                      className="flex items-center gap-1.5 px-3 py-2 bg-secondary text-secondary-foreground rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50"
                    >
                      <RefreshCw size={12} className={metaRefreshing ? "animate-spin" : ""} />
                      {metaRefreshing ? "Aggiornamento..." : "Aggiorna pagine e account"}
                    </button>
                    <button
                      onClick={() => { setShowTokenInput(!showTokenInput); setMetaConnectError(""); }}
                      className="flex items-center gap-1.5 px-3 py-2 bg-secondary text-secondary-foreground rounded-lg text-xs font-medium hover:opacity-90"
                    >
                      Cambia token
                    </button>
                    <button
                      onClick={handleMetaDisconnect}
                      className="flex items-center gap-1.5 px-3 py-2 bg-destructive/10 text-destructive rounded-lg text-xs font-medium hover:opacity-90 ml-auto"
                    >
                      Disconnetti
                    </button>
                  </div>

                  {/* Inline token change form */}
                  {showTokenInput && !meta.tokenExpired && (
                    <div className="mt-3 p-3 bg-muted/50 border border-card-border rounded-xl">
                      <textarea
                        className="w-full text-xs font-mono border border-border rounded-xl p-3 bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                        rows={3}
                        placeholder="Incolla qui il nuovo token (inizia con EAA...)"
                        value={metaToken}
                        onChange={(e) => setMetaToken(e.target.value)}
                        disabled={metaConnecting}
                      />
                      {metaConnectError && (
                        <div className="flex items-center gap-2 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-2 mt-2">
                          <XCircle size={13} /> {metaConnectError}
                        </div>
                      )}
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={handleMetaConnect}
                          disabled={metaConnecting || !metaToken.trim()}
                          className="flex items-center justify-center gap-2 px-4 py-2 bg-[#1877F2] text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                        >
                          {metaConnecting ? <><RefreshCw size={14} className="animate-spin" /> Connessione...</> : "Collega nuovo token"}
                        </button>
                        <button onClick={() => { setShowTokenInput(false); setMetaToken(""); setMetaConnectError(""); }} className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground">Annulla</button>
                      </div>
                    </div>
                  )}

                  <p className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1">
                    <Info size={11} /> Le pagine e gli account qui visibili possono essere assegnati ai singoli clienti dalla loro scheda.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="text-center py-4 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
                      <WifiOff size={20} className="text-blue-400" />
                    </div>
                    <p className="text-sm font-semibold mb-1">Account Meta non collegato</p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Collega il tuo account Meta per gestire centralmente le pagine Facebook, gli account Instagram Business e gli account pubblicitari di tutti i tuoi clienti.
                    </p>
                  </div>

                  <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800 space-y-1.5">
                    <p className="font-semibold">Come ottenere il token:</p>
                    <ol className="list-decimal list-inside space-y-1 text-blue-700">
                      <li>Vai su <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer" className="underline font-medium">Meta Graph Explorer</a></li>
                      <li>Seleziona la tua App Meta (o usa "Meta App")</li>
                      <li>Clicca <strong>Generate Access Token</strong> e accedi con il tuo account</li>
                      <li>Aggiungi i permessi: <code className="bg-blue-100 px-1 rounded">pages_read_engagement</code>, <code className="bg-blue-100 px-1 rounded">instagram_basic</code>, <code className="bg-blue-100 px-1 rounded">instagram_manage_insights</code>, <code className="bg-blue-100 px-1 rounded">ads_read</code></li>
                      <li>Copia il token generato e incollalo qui sotto</li>
                    </ol>
                  </div>

                  <textarea
                    className="w-full text-xs font-mono border border-border rounded-xl p-3 bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                    rows={3}
                    placeholder="Incolla qui il token di accesso Meta (inizia con EAA...)"
                    value={metaToken}
                    onChange={(e) => setMetaToken(e.target.value)}
                    disabled={metaConnecting}
                  />
                  {metaConnectError && (
                    <div className="flex items-center gap-2 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-2 mt-2">
                      <XCircle size={13} /> {metaConnectError}
                    </div>
                  )}
                  <button
                    onClick={handleMetaConnect}
                    disabled={metaConnecting || !metaToken.trim()}
                    className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1877F2] text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {metaConnecting ? <><RefreshCw size={14} className="animate-spin" /> Connessione in corso...</> : <><Share2 size={14} /> Collega account Meta</>}
                  </button>
                </div>
              )}
            </IntegrationCard>

            {/* Email SMTP */}
            <IntegrationCard title="Email (invio report)" icon={Mail} status="disconnected">
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Configura il server SMTP per inviare i report mensili direttamente ai clienti via email.
                  Aggiungi le variabili d'ambiente <code className="bg-muted px-1 rounded text-xs">SMTP_HOST</code>, <code className="bg-muted px-1 rounded text-xs">SMTP_USER</code>, <code className="bg-muted px-1 rounded text-xs">SMTP_PASS</code>.
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs bg-muted/50 rounded-xl p-3">
                  <div><p className="text-muted-foreground font-medium">SMTP_HOST</p><p className="font-mono">smtp.gmail.com</p></div>
                  <div><p className="text-muted-foreground font-medium">SMTP_PORT</p><p className="font-mono">587</p></div>
                  <div><p className="text-muted-foreground font-medium">SMTP_USER</p><p className="font-mono">tua@email.com</p></div>
                  <div><p className="text-muted-foreground font-medium">SMTP_PASS</p><p className="font-mono">password app</p></div>
                </div>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Info size={11} /> Senza SMTP configurato, il portale mostrerà un'anteprima dell'email invece di inviarla.
                </p>
              </div>
            </IntegrationCard>

            {/* Google Ads */}
            <IntegrationCard title="Google Ads" icon={SettingsIcon} status={googleConnected ? "connected" : "disconnected"}>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Collega Google Ads per importare automaticamente campagne attive e KPI.
                </p>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Customer ID Google Ads</label>
                  <input type="text" value={googleAdsId} onChange={(e) => setGoogleAdsId(e.target.value)} placeholder="123-456-7890" className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring font-mono" />
                  <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                    <Info size={11} /> Trovi il Customer ID nell'angolo in alto a destra su Google Ads
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={saveGoogleAdsId} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
                    {googleSaved ? <span className="flex items-center gap-1.5"><CheckCircle2 size={14} /> Salvato</span> : "Salva Customer ID"}
                  </button>
                  {googleConnected && (
                    <button onClick={() => { localStorage.removeItem("bekind_google_ads_id"); setGoogleAdsId(""); setGoogleConnected(false); }} className="text-xs text-muted-foreground hover:text-destructive">Disconnetti</button>
                  )}
                  <a href="https://ads.google.com/" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-primary hover:underline ml-auto">Apri Google Ads <ExternalLink size={12} /></a>
                </div>
              </div>
            </IntegrationCard>
          </div>
        </div>

        {isAdmin && <RoleManagement />}

        <SmtpStatusSection />

        <GoogleAdsServerSection />
      </div>
    </Layout>
  );
}

function RoleManagement() {
  const [roles, setRoles] = useState<any[]>([]);
  const [roleDefinitions, setRoleDefinitions] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [newUserId, setNewUserId] = useState("");
  const [newRole, setNewRole] = useState("viewer");
  const [addError, setAddError] = useState("");

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch("/api/roles");
      if (res.ok) {
        const data = await res.json();
        setRoles(data.roles ?? []);
        setRoleDefinitions(data.roleDefinitions ?? {});
      }
    } catch {}
  }, []);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const handleRoleChange = async (clerkUserId: string, role: string) => {
    setSaving(clerkUserId);
    try {
      await fetch(`/api/roles/${clerkUserId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      await fetchRoles();
    } catch {} finally {
      setSaving(null);
    }
  };

  const handleAdd = async () => {
    if (!newUserId.trim()) { setAddError("Inserisci un Clerk User ID"); return; }
    setAddError("");
    setSaving("new");
    try {
      const res = await fetch(`/api/roles/${newUserId.trim()}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const d = await res.json();
        setAddError(d.error ?? "Errore");
        return;
      }
      setNewUserId("");
      setNewRole("viewer");
      await fetchRoles();
    } catch { setAddError("Errore di rete"); } finally { setSaving(null); }
  };

  const handleRemove = async (clerkUserId: string) => {
    if (!confirm("Rimuovere questo ruolo? L'utente tornerà al ruolo Osservatore.")) return;
    await fetch(`/api/roles/${clerkUserId}`, { method: "DELETE" });
    await fetchRoles();
  };

  const roleBadgeClass = (role: string) => {
    switch (role) {
      case "admin": return "bg-amber-100 text-amber-700";
      case "account_manager": return "bg-blue-100 text-blue-700";
      case "creative": return "bg-purple-100 text-purple-700";
      default: return "bg-gray-100 text-gray-600";
    }
  };

  return (
    <div className="mb-8">
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-4 flex items-center gap-2">
          <Shield size={14} /> Permessi Team
          {expanded ? <ChevronUp size={14} className="ml-auto" /> : <ChevronDown size={14} className="ml-auto" />}
        </h2>
      </button>
      {expanded && (
        <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
          <p className="text-xs text-muted-foreground mb-4">
            Assegna ruoli agli utenti tramite il loro Clerk User ID. Ogni utente puo' copiare il proprio ID dalla sezione Profilo sopra.
          </p>

          {roles.length > 0 && (
            <div className="mb-4">
              <div className="grid grid-cols-3 gap-2 mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground border-b border-border pb-2">
                <span>Clerk User ID</span>
                <span>Ruolo</span>
                <span>Azioni</span>
              </div>
              {roles.map((r: any) => (
                <div key={r.id} className="grid grid-cols-3 gap-2 items-center py-2.5 border-b border-border/50 last:border-0">
                  <code className="text-xs font-mono text-muted-foreground truncate">{r.clerkUserId}</code>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", roleBadgeClass(r.role))}>
                      {roleDefinitions[r.role] ?? r.role}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={r.role}
                      onChange={(e) => handleRoleChange(r.clerkUserId, e.target.value)}
                      disabled={saving === r.clerkUserId}
                      className="text-xs border border-input rounded-lg px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                    >
                      {Object.entries(roleDefinitions).map(([key, label]) => (
                        <option key={key} value={key}>{label as string}</option>
                      ))}
                    </select>
                    <button onClick={() => handleRemove(r.clerkUserId)} className="text-xs text-destructive hover:underline">
                      Rimuovi
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="p-3 bg-muted/50 rounded-xl">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Aggiungi ruolo utente</p>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-[11px] text-muted-foreground">Clerk User ID</label>
                <input
                  type="text"
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                  placeholder="user_2x..."
                  className="w-full mt-1 px-3 py-2 text-xs font-mono border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Ruolo</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-xs border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {Object.entries(roleDefinitions).length > 0
                    ? Object.entries(roleDefinitions).map(([key, label]) => (
                        <option key={key} value={key}>{label as string}</option>
                      ))
                    : <>
                        <option value="admin">Amministratore</option>
                        <option value="account_manager">Account Manager</option>
                        <option value="creative">Creativo</option>
                        <option value="viewer">Osservatore</option>
                      </>
                  }
                </select>
              </div>
              <button
                onClick={handleAdd}
                disabled={saving === "new"}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50"
              >
                Aggiungi
              </button>
            </div>
            {addError && <p className="text-xs text-destructive mt-2">{addError}</p>}
          </div>

          <div className="mt-4 p-3 bg-muted/50 rounded-xl">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Legenda ruoli</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="font-medium">Amministratore</span> — Accesso completo, gestione ruoli</div>
              <div><span className="font-medium">Account Manager</span> — Clienti, progetti, preventivi, contratti, report</div>
              <div><span className="font-medium">Creativo</span> — Progetti, task, chat, file</div>
              <div><span className="font-medium">Osservatore</span> — Solo visualizzazione progetti, task, chat</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SmtpStatusSection() {
  const [status, setStatus] = useState<{ configured: boolean; verified: boolean } | null>(null);
  const [testing, setTesting] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/email-notifications/smtp-status");
      if (res.ok) setStatus(await res.json());
    } catch {}
  }, []);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  return (
    <div className="mb-8">
      <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-4 flex items-center gap-2">
        <Send size={14} /> Email automatiche
      </h2>
      <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold">Stato SMTP</p>
          <div className={cn(
            "flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full",
            status?.verified ? "bg-emerald-100 text-emerald-700" :
            status?.configured ? "bg-amber-100 text-amber-700" :
            "bg-gray-100 text-gray-500"
          )}>
            <div className={cn(
              "w-1.5 h-1.5 rounded-full",
              status?.verified ? "bg-emerald-500" :
              status?.configured ? "bg-amber-500" :
              "bg-gray-400"
            )} />
            {status?.verified ? "Attivo e verificato" : status?.configured ? "Configurato (non verificato)" : "Non configurato"}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Quando SMTP è configurato, il portale invia email automatiche per: assegnazione task, aggiornamenti report, promemoria scadenza contratti.
        </p>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <Mail size={12} className="text-muted-foreground" />
            <span>Assegnazione task — notifica il membro del team via email</span>
          </div>
          <div className="flex items-center gap-2">
            <Mail size={12} className="text-muted-foreground" />
            <span>Cambio stato report — notifica l'autore e i revisori</span>
          </div>
          <div className="flex items-center gap-2">
            <Mail size={12} className="text-muted-foreground" />
            <span>Scadenza contratti — promemoria automatico prima della scadenza</span>
          </div>
        </div>
        {!status?.configured && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
            Per attivare le email automatiche, configura le variabili d'ambiente SMTP nella sezione Integrazioni sopra.
          </div>
        )}
        <button
          onClick={async () => { setTesting(true); await checkStatus(); setTesting(false); }}
          disabled={testing}
          className="mt-3 flex items-center gap-1.5 px-3 py-2 bg-secondary text-secondary-foreground rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50"
        >
          <RefreshCw size={12} className={testing ? "animate-spin" : ""} />
          {testing ? "Verifica in corso..." : "Verifica connessione SMTP"}
        </button>
      </div>
    </div>
  );
}

function GoogleAdsServerSection() {
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    fetch("/api/google-ads/status")
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setStatus(d))
      .catch(() => {});
  }, []);

  return (
    <div className="mb-8">
      <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-4 flex items-center gap-2">
        <Megaphone size={14} /> Google Ads (Server)
      </h2>
      <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold">Stato integrazione server</p>
          <div className={cn(
            "flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full",
            status?.configured ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
          )}>
            <div className={cn("w-1.5 h-1.5 rounded-full", status?.configured ? "bg-emerald-500" : "bg-gray-400")} />
            {status?.configured ? "Configurato" : "Non configurato"}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          L'integrazione server-side con Google Ads permette di importare campagne e KPI direttamente nel portale.
          Richiede le seguenti variabili d'ambiente:
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs bg-muted/50 rounded-xl p-3 mb-4">
          <div>
            <p className="text-muted-foreground font-medium">GOOGLE_ADS_DEVELOPER_TOKEN</p>
            <p className={cn("font-mono", status?.hasDeveloperToken ? "text-emerald-600" : "text-gray-400")}>
              {status?.hasDeveloperToken ? "Configurato" : "Non impostato"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground font-medium">GOOGLE_ADS_REFRESH_TOKEN</p>
            <p className={cn("font-mono", status?.hasRefreshToken ? "text-emerald-600" : "text-gray-400")}>
              {status?.hasRefreshToken ? "Configurato" : "Non impostato"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground font-medium">GOOGLE_ADS_CLIENT_ID</p>
            <p className={cn("font-mono", status?.hasClientCredentials ? "text-emerald-600" : "text-gray-400")}>
              {status?.hasClientCredentials ? "Configurato" : "Non impostato"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground font-medium">GOOGLE_ADS_CLIENT_SECRET</p>
            <p className={cn("font-mono", status?.hasClientCredentials ? "text-emerald-600" : "text-gray-400")}>
              {status?.hasClientCredentials ? "Configurato" : "Non impostato"}
            </p>
          </div>
        </div>
        {!status?.configured && (
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800 space-y-1.5">
            <p className="font-semibold">Come configurare:</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-700">
              <li>Crea un progetto su <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" className="underline font-medium">Google Cloud Console</a></li>
              <li>Abilita l'API Google Ads e crea le credenziali OAuth 2.0</li>
              <li>Ottieni un Developer Token dal <a href="https://ads.google.com/aw/apicenter" target="_blank" rel="noreferrer" className="underline font-medium">Centro API Google Ads</a></li>
              <li>Genera un Refresh Token con lo scope <code className="bg-blue-100 px-1 rounded">https://www.googleapis.com/auth/adwords</code></li>
              <li>Aggiungi le 4 variabili d'ambiente nel pannello Secrets di Replit</li>
            </ol>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1">
          <Info size={11} /> Una volta configurato, assegna il Customer ID Google Ads a ciascun cliente dalla scheda cliente.
        </p>
      </div>
    </div>
  );
}
