import { ExternalLink, Link2Off, RefreshCw, Save, Settings as SettingsIcon, Share2, Wifi, WifiOff } from "lucide-react";

export function ClientMetaSection({
  Section,
  metaStatus,
  handleMetaSync,
  metaSyncing,
  handleMetaDisconnect,
  metaAssign,
  setMetaAssign,
  handleMetaAssignSave,
  metaSaving,
}: {
  Section: React.ComponentType<{ title: string; icon: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }>;
  metaStatus: any;
  handleMetaSync: () => void;
  metaSyncing: boolean;
  handleMetaDisconnect: () => void;
  metaAssign: any;
  setMetaAssign: React.Dispatch<React.SetStateAction<any>>;
  handleMetaAssignSave: () => void;
  metaSaving: boolean;
}) {
  return (
    <Section
      title="Meta (Facebook & Instagram)"
      icon={<Share2 size={15} className="text-primary" />}
      action={
        metaStatus?.connected && (metaStatus.assignedPage || metaStatus.assignedIg || metaStatus.assignedAd) ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleMetaSync}
              disabled={metaSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50"
            >
              <RefreshCw size={11} className={metaSyncing ? "animate-spin" : ""} />
              {metaSyncing ? "Sincronizzazione..." : "Sincronizza dati"}
            </button>
            <button
              onClick={handleMetaDisconnect}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 text-destructive rounded-lg text-xs font-medium hover:opacity-90"
            >
              <Link2Off size={11} /> Rimuovi
            </button>
          </div>
        ) : null
      }
    >
      {!metaStatus?.connected ? (
        <div className="text-center py-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
            <WifiOff size={20} className="text-blue-400" />
          </div>
          <p className="text-sm font-semibold mb-1">Account Meta dell'agenzia non collegato</p>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto mb-3">
            {metaStatus?.reason === "agency_not_connected"
              ? "Vai in Impostazioni per collegare l'account Meta dell'agenzia prima di assegnare pagine e account a questo cliente."
              : "Connessione Meta non disponibile."}
          </p>
          <a href="/settings" className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1877F2] text-white rounded-xl text-sm font-semibold hover:opacity-90">
            <SettingsIcon size={14} /> Vai a Impostazioni
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-emerald-600 font-medium">
              <Wifi size={13} /> Collegato come {metaStatus.metaUserName}
            </div>
            {metaStatus.tokenExpired && (
              <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full font-medium">Token scaduto</span>
            )}
            {metaStatus.lastSyncedAt && (
              <span className="text-muted-foreground ml-auto">
                Ultimo sync: {new Date(metaStatus.lastSyncedAt).toLocaleString("it-IT")}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">Pagina Facebook</label>
              <select
                value={metaAssign.pageId}
                onChange={(e) => setMetaAssign((prev: any) => ({ ...prev, pageId: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">-- Nessuna pagina assegnata --</option>
                {(metaStatus.allPages ?? []).map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name} (ID: {p.id})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">Account Instagram Business</label>
              <select
                value={metaAssign.igId}
                onChange={(e) => setMetaAssign((prev: any) => ({ ...prev, igId: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">-- Nessun account IG assegnato --</option>
                {(metaStatus.allIgAccounts ?? []).map((ig: any) => (
                  <option key={ig.id} value={ig.id}>@{ig.username} — {ig.followers_count?.toLocaleString("it-IT")} follower</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">Account Pubblicitario Meta Ads</label>
              <select
                value={metaAssign.adId}
                onChange={(e) => setMetaAssign((prev: any) => ({ ...prev, adId: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">-- Nessun account Ads assegnato --</option>
                {(metaStatus.allAdAccounts ?? []).map((ad: any) => (
                  <option key={ad.id} value={ad.id}>{ad.name} ({ad.id} · {ad.currency})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleMetaAssignSave}
              disabled={metaSaving}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {metaSaving ? <><RefreshCw size={13} className="animate-spin" /> Salvataggio...</> : <><Save size={13} /> Salva assegnazioni</>}
            </button>
            {(metaStatus.allPages?.length === 0 && metaStatus.allIgAccounts?.length === 0 && metaStatus.allAdAccounts?.length === 0) && (
              <p className="text-xs text-amber-600">Nessuna pagina o account trovato. Vai in Impostazioni per aggiornare.</p>
            )}
          </div>

          {(metaStatus.assignedPage || metaStatus.assignedIg || metaStatus.assignedAd) && (
            <div className="pt-3 border-t border-card-border space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Account assegnati</p>
              {metaStatus.assignedPage && (
                <div className="flex items-center gap-2 p-2.5 bg-blue-50/50 rounded-xl">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                    <Share2 size={12} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{metaStatus.assignedPage.name}</p>
                    <p className="text-[11px] text-muted-foreground font-mono">Pagina FB · {metaStatus.assignedPage.id}</p>
                  </div>
                </div>
              )}
              {metaStatus.assignedIg && (
                <div className="flex items-center gap-2 p-2.5 bg-pink-50/50 rounded-xl">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center shrink-0">
                    {metaStatus.assignedIg.profile_picture_url
                      ? <img src={metaStatus.assignedIg.profile_picture_url} alt="" className="w-full h-full rounded-full object-cover" />
                      : <span className="text-white text-[10px] font-bold">{metaStatus.assignedIg.username?.[0]?.toUpperCase()}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">@{metaStatus.assignedIg.username}</p>
                    <p className="text-[11px] text-muted-foreground">{metaStatus.assignedIg.followers_count?.toLocaleString("it-IT")} follower</p>
                  </div>
                  <a href={`https://instagram.com/${metaStatus.assignedIg.username}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary">
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}
              {metaStatus.assignedAd && (
                <div className="flex items-center gap-2 p-2.5 bg-amber-50/50 rounded-xl">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                    <span className="text-amber-700 font-bold text-[10px]">Ads</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{metaStatus.assignedAd.name}</p>
                    <p className="text-[11px] text-muted-foreground font-mono">{metaStatus.assignedAd.id} · {metaStatus.assignedAd.currency}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Section>
  );
}
