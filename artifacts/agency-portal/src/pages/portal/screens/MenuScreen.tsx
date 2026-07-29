import { FileText, CalendarDays, FolderOpen, ChevronRight, Heart } from "lucide-react";
import { usePortal } from "../PortalContext";
import { usePortalNav } from "../nav";
import { T } from "../theme";
import { ScreenHeader } from "../components/kit";

export function MenuScreen() {
  const { brand } = usePortal();
  const { push } = usePortalNav();
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <ScreenHeader title="Altro" subtitle="Tutto il resto della tua area" />
      <div className="space-y-2.5">
        <Row icon={<FileText size={18} />} title="Il tuo brief" sub="Raccontaci di te" onClick={() => push("brief")} />
        <Row icon={<CalendarDays size={18} />} title="Eventi & collaborazioni" sub="I tuoi prossimi appuntamenti" onClick={() => push("events")} />
        <Row icon={<FolderOpen size={18} />} title="Consegne & file" sub="Materiali, report, Drive" onClick={() => push("files")} />
      </div>

      <div className="mt-8 rounded-2xl p-5 text-center" style={{ background: T.card, border: `1px solid ${T.cardBorder}` }}>
        {brand.logo && <img src={brand.logo} alt="" className="w-12 h-12 object-contain mx-auto mb-2" />}
        <p className="font-semibold" style={{ color: T.ink }}>{brand.name}</p>
        <p className="text-xs mt-1 inline-flex items-center gap-1" style={{ color: T.muted }}>
          Curato con <Heart size={11} className="text-rose-400 fill-rose-400" /> da Be Kind Social Agency
        </p>
      </div>
    </div>
  );
}

function Row({ icon, title, sub, onClick }: { icon: React.ReactNode; title: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 p-4 rounded-2xl active:scale-[.99] transition-transform" style={{ background: T.card, border: `1px solid ${T.cardBorder}` }}>
      <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: T.sageSoft, color: T.sage }}>{icon}</span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block font-semibold" style={{ color: T.ink }}>{title}</span>
        <span className="block text-sm" style={{ color: T.muted }}>{sub}</span>
      </span>
      <ChevronRight size={18} style={{ color: T.softMuted }} />
    </button>
  );
}
