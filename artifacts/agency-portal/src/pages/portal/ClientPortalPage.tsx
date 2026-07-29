import { useCallback, useEffect, useState } from "react";
import { Loader2, CloudOff } from "lucide-react";
import { PortalProvider, type PortalBrand, type PortalCounts } from "./PortalContext";
import { PortalShell } from "./PortalShell";
import { portalUrl } from "./portalApi";
import { T, heroGradient, SERIF } from "./theme";

/**
 * Guscio del portale cliente pubblico (/portal/:token). Nessun login: il token è
 * la chiave. Gestisce loading / link non valido / gate PIN / app. Inietta il
 * manifest PWA per-cliente (nome cliente, icona Be Kind). L'app vera è PortalShell.
 */
type Info = {
  client: { name: string; logo: string | null; color: string | null; cover: string | null; driveUrl?: string | null };
  pinRequired?: boolean;
  counts?: PortalCounts;
};

export default function ClientPortalPage({ token }: { token: string }) {
  const [status, setStatus] = useState<"loading" | "ok" | "pin" | "invalid">("loading");
  const [brand, setBrand] = useState<PortalBrand | null>(null);
  const [counts, setCounts] = useState<PortalCounts>({ upcomingContent: 0, ideas: 0, reports: 0 });
  const [pin, setPin] = useState("");
  const [pinErr, setPinErr] = useState<string | null>(null);
  const [pinBusy, setPinBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const r = await fetch(portalUrl(token));
      if (!r.ok) { setStatus("invalid"); return; }
      const d = (await r.json()) as Info;
      setBrand({
        name: d.client.name,
        logo: d.client.logo ?? null,
        color: d.client.color ?? T.sage,
        cover: d.client.cover ?? null,
        driveUrl: d.client.driveUrl ?? null,
      });
      if (d.pinRequired) { setStatus("pin"); return; }
      if (d.counts) setCounts(d.counts);
      setStatus("ok");
    } catch { setStatus("invalid"); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const submitPin = useCallback(async () => {
    if (!/^\d{4,6}$/.test(pin)) { setPinErr("Inserisci il PIN"); return; }
    setPinBusy(true); setPinErr(null);
    try {
      const r = await fetch(portalUrl(token, "/verify-pin"), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }),
      });
      if (r.ok) { setPin(""); await load(); } else setPinErr("PIN errato");
    } catch { setPinErr("Errore, riprova"); }
    finally { setPinBusy(false); }
  }, [pin, token, load]);

  // PWA per-cliente: nome del cliente nel titolo, colore Be Kind salvia, icona
  // Be Kind (dal manifest/apple-touch-icon globali). Ripristino all'uscita.
  useEffect(() => {
    const head = document.head;
    const manifest = head.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    const themeMeta = head.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    const titleMeta = head.querySelector('meta[name="apple-mobile-web-app-title"]') as HTMLMetaElement | null;
    const prev = { manifest: manifest?.getAttribute("href"), theme: themeMeta?.getAttribute("content"), title: titleMeta?.getAttribute("content"), doc: document.title };
    manifest?.setAttribute("href", portalUrl(token, "/manifest.webmanifest"));
    themeMeta?.setAttribute("content", T.sage);
    if (brand?.name) { titleMeta?.setAttribute("content", brand.name); document.title = brand.name; }
    return () => {
      if (prev.manifest) manifest?.setAttribute("href", prev.manifest);
      if (prev.theme) themeMeta?.setAttribute("content", prev.theme);
      if (prev.title) titleMeta?.setAttribute("content", prev.title);
      document.title = prev.doc;
    };
  }, [token, brand?.name]);

  if (status === "loading") {
    return <div className="min-h-[100dvh] flex items-center justify-center" style={{ background: T.cream }}><Loader2 className="animate-spin" style={{ color: T.sage }} /></div>;
  }
  if (status === "invalid" || !brand) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-6" style={{ background: T.cream }}>
        <div className="text-center max-w-sm">
          <CloudOff className="mx-auto mb-3" style={{ color: T.softMuted }} />
          <h1 className="text-lg font-semibold" style={{ color: T.ink }}>Link non valido</h1>
          <p className="text-sm mt-1" style={{ color: T.muted }}>Questo link non è più attivo o è stato revocato. Contatta la tua agenzia per un nuovo link.</p>
        </div>
      </div>
    );
  }
  if (status === "pin") {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-6 relative"
        style={brand.cover ? { backgroundImage: `url(${brand.cover})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: heroGradient }}>
        <div className="absolute inset-0" style={{ background: "rgba(20,26,14,0.55)" }} />
        <div className="relative w-full max-w-xs text-center animate-in fade-in zoom-in-95 duration-300">
          <div className="w-20 h-20 rounded-2xl bg-white mx-auto flex items-center justify-center overflow-hidden mb-5 shadow-lg">
            {brand.logo ? <img src={brand.logo} alt={brand.name} className="w-full h-full object-contain p-2" /> : <span className="text-2xl font-bold" style={{ color: T.sage }}>{brand.name.slice(0, 2).toUpperCase()}</span>}
          </div>
          <h1 className="text-white text-2xl font-bold leading-tight" style={{ fontFamily: SERIF }}>{brand.name}</h1>
          <p className="text-white/75 text-sm mt-1 mb-6">Inserisci il PIN per entrare</p>
          <input value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, "").slice(0, 6)); setPinErr(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") void submitPin(); }} inputMode="numeric" autoFocus placeholder="••••"
            className="w-full text-center text-3xl tracking-[0.5em] font-bold py-4 rounded-2xl bg-white/95 focus:outline-none focus:ring-4 focus:ring-white/30" />
          {pinErr && <p className="text-red-100 text-sm mt-2 font-medium">{pinErr}</p>}
          <button onClick={() => void submitPin()} disabled={pinBusy}
            className="mt-4 w-full py-3.5 rounded-2xl bg-white font-bold text-lg active:scale-[.99] transition-transform disabled:opacity-60" style={{ color: T.forest }}>
            {pinBusy ? "…" : "Entra"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <PortalProvider token={token} brand={brand} counts={counts} onAuthExpired={() => setStatus("pin")}>
      <PortalShell />
    </PortalProvider>
  );
}
