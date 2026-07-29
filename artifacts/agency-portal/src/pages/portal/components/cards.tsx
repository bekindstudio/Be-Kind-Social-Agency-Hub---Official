import { ImageIcon, Download, X } from "lucide-react";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import type { SocialPlatform } from "@/types/client";
import { T, SERIF, heroGradient } from "../theme";
import { fmtDay } from "./kit";
import { CategoryChip } from "./kit";
import type { Slot } from "../types";

/** Hero in cima alla Home: foto di copertina (o gradiente) con saluto e logo. */
export function Hero({ name, logo, cover, greeting }: { name: string; logo: string | null; cover: string | null; greeting: string }) {
  return (
    <div className="relative rounded-3xl overflow-hidden aspect-[5/4] flex flex-col justify-end"
      style={cover ? { backgroundImage: `url(${cover})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: heroGradient }}>
      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0.05) 55%)" }} />
      <div className="relative p-5 text-white">
        <div className="flex items-center gap-2 mb-2">
          {logo && <span className="w-8 h-8 rounded-lg bg-white/95 overflow-hidden flex items-center justify-center shrink-0"><img src={logo} alt="" className="w-full h-full object-contain p-0.5" /></span>}
          <span className="text-[11px] font-semibold uppercase tracking-widest text-white/80">La tua area · Be Kind</span>
        </div>
        <p className="text-white/85 text-sm">{greeting}</p>
        <h1 className="text-3xl font-bold leading-tight" style={{ fontFamily: SERIF }}>{name}</h1>
      </div>
    </div>
  );
}

const PLATFORM_FALLBACK = new Set(["instagram", "facebook", "tiktok", "youtube", "linkedin", "twitter", "threads"]);

/** Card di un contenuto del piano editoriale. `compact` = versione carosello Home. */
export function SlotCard({ slot, onClick, compact }: { slot: Slot; onClick?: () => void; compact?: boolean }) {
  const { d, m } = fmtDay(slot.publishDate);
  const plat = PLATFORM_FALLBACK.has(slot.platform) ? (slot.platform as SocialPlatform) : null;
  const imgH = compact ? "h-28" : "h-44";
  return (
    <button onClick={onClick} className={`text-left rounded-2xl overflow-hidden active:scale-[.98] transition-transform ${compact ? "w-40 shrink-0" : "w-full"}`}
      style={{ background: T.card, border: `1px solid ${T.cardBorder}` }}>
      <div className={`relative ${imgH} w-full`} style={slot.visualUrl ? { backgroundImage: `url(${slot.visualUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: heroGradient }}>
        {!slot.visualUrl && <div className="absolute inset-0 flex items-center justify-center"><ImageIcon size={compact ? 22 : 30} className="text-white/70" /></div>}
        <div className="absolute top-2 left-2 flex gap-1.5">
          <CategoryChip category={slot.contentType} />
        </div>
        {plat && <span className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center"><PlatformIcon platform={plat} size="sm" /></span>}
        {(d !== "—") && (
          <span className="absolute bottom-2 left-2 bg-white/90 rounded-lg px-2 py-1 text-center leading-none">
            <span className="block text-sm font-extrabold" style={{ color: T.ink }}>{d}</span>
            <span className="block text-[9px] uppercase font-semibold" style={{ color: T.muted }}>{m}</span>
          </span>
        )}
      </div>
      <div className="p-3">
        <p className={`font-semibold ${compact ? "text-sm truncate" : "line-clamp-2"}`} style={{ color: T.ink }}>{slot.title || slot.contentType || "Contenuto"}</p>
        {!compact && slot.caption && <p className="text-sm mt-1 line-clamp-2" style={{ color: T.muted }}>{slot.caption}</p>}
      </div>
    </button>
  );
}

export function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: T.card, border: `1px solid ${T.cardBorder}` }}>
      <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: T.muted }}>{label}</div>
      <div className="text-2xl font-extrabold tabular-nums mt-1" style={{ color: T.ink }}>{value}</div>
      {sub && <div className="text-[11px] mt-0.5" style={{ color: T.softMuted }}>{sub}</div>}
    </div>
  );
}

export function InstallCard({ onDismiss }: { onDismiss: () => void }) {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return (
    <div className="relative rounded-2xl p-4 text-white overflow-hidden" style={{ background: heroGradient }}>
      <button onClick={onDismiss} className="absolute top-2 right-2 text-white/70 hover:text-white p-1"><X size={16} /></button>
      <div className="flex items-start gap-3">
        <Download size={22} className="shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Tieni la tua area sul telefono</p>
          <p className="text-white/85 text-sm mt-0.5">
            {isIOS ? "Tocca Condividi, poi “Aggiungi a Home”: la ritrovi come un’app." : "Menu del browser → “Aggiungi a schermata Home”."}
          </p>
        </div>
      </div>
    </div>
  );
}
