import { useMemo, useState } from "react";
import { CalendarRange, Lightbulb, BarChart3, FileText, CalendarDays, FolderOpen, ChevronRight, Globe, FileSignature } from "lucide-react";
import { usePortal, usePortalData } from "../PortalContext";
import { usePortalNav } from "../nav";
import { T } from "../theme";
import { StatCard, Skeleton } from "../components/kit";
import { Hero, SlotCard, InstallCard } from "../components/cards";
import type { EditorialData } from "../types";

const DISMISS = "bk-portal-install-dismissed";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buongiorno";
  if (h < 18) return "Buon pomeriggio";
  return "Buonasera";
}

export function HomeScreen() {
  const { brand, counts, contractStatus } = usePortal();
  const wantsWebsite = brand.wantsWebsite;
  const { setTab, push } = usePortalNav();
  const { data, loading } = usePortalData<EditorialData>("/editorial");
  const [installed] = useState(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    return standalone || localStorage.getItem(DISMISS) === "1";
  });
  const [hideInstall, setHideInstall] = useState(false);
  const isMobile = /iphone|ipad|ipod|android/i.test(navigator.userAgent);

  const upcoming = useMemo(() => {
    const slots = data?.slots ?? [];
    const today = new Date().toISOString().slice(0, 10);
    const future = slots.filter((s) => (s.publishDate ?? "") >= today).sort((a, b) => (a.publishDate ?? "").localeCompare(b.publishDate ?? ""));
    return (future.length ? future : [...slots].reverse()).slice(0, 6);
  }, [data]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <Hero name={brand.name} logo={brand.logo} cover={brand.cover} greeting={`${greeting()} 👋`} />

      <div className="flex gap-2.5">
        <button className="flex-1 text-left" onClick={() => setTab("content")}>
          <StatCard label="Prossimi contenuti" value={counts.upcomingContent} icon={<CalendarRange size={16} />} />
        </button>
        <button className="flex-1 text-left" onClick={() => setTab("ideas")}>
          <StatCard label="Idee raccolte" value={counts.ideas} icon={<Lightbulb size={16} />} />
        </button>
        <button className="flex-1 text-left" onClick={() => setTab("reports")}>
          <StatCard label="Report" value={counts.reports} icon={<BarChart3 size={16} />} />
        </button>
      </div>

      {!installed && !hideInstall && isMobile && (
        <InstallCard onDismiss={() => { localStorage.setItem(DISMISS, "1"); setHideInstall(true); }} />
      )}

      {/* Prossimi contenuti */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold" style={{ color: T.ink }}>Prossimi contenuti</h2>
          <button onClick={() => setTab("content")} className="text-sm font-semibold inline-flex items-center gap-0.5" style={{ color: T.sage }}>
            Vedi tutti <ChevronRight size={15} />
          </button>
        </div>
        {loading ? (
          <div className="flex gap-3"><Skeleton className="w-40 h-56" /><Skeleton className="w-40 h-56" /></div>
        ) : upcoming.length === 0 ? (
          <div className="rounded-2xl p-5 text-center text-sm" style={{ background: T.card, border: `1px solid ${T.cardBorder}`, color: T.muted }}>
            Nessun contenuto pianificato al momento. Appena prepariamo il piano, lo vedi qui.
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto -mx-5 px-5 pb-1" style={{ scrollbarWidth: "none" }}>
            {upcoming.map((s) => <SlotCard key={s.id} slot={s} compact onClick={() => setTab("content")} />)}
          </div>
        )}
      </section>

      {/* Azioni rapide */}
      <section className="space-y-2.5">
        {contractStatus && (
          <QuickRow
            icon={<FileSignature size={18} />}
            title="Il tuo contratto"
            sub={contractStatus === "inviato" ? "Da leggere e firmare ✍️" : "Firmato — consultalo quando vuoi"}
            onClick={() => push("contract")}
          />
        )}
        <QuickRow icon={<FileText size={18} />} title="Il tuo brief" sub="Raccontaci di te, si salva da solo" onClick={() => push("brief")} />
        {wantsWebsite && (
          <QuickRow icon={<Globe size={18} />} title="Brief Sito Web" sub="Aiutaci a disegnare il tuo sito, si salva da solo" onClick={() => push("website-brief")} />
        )}
        <QuickRow icon={<CalendarDays size={18} />} title="Eventi & collaborazioni" sub="Aggiungi i tuoi prossimi appuntamenti" onClick={() => push("events")} />
        <QuickRow icon={<FolderOpen size={18} />} title="Consegne & file" sub="Materiali, report e cartella Drive" onClick={() => push("files")} />
      </section>
    </div>
  );
}

function QuickRow({ icon, title, sub, onClick }: { icon: React.ReactNode; title: string; sub: string; onClick: () => void }) {
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
