import { Home, LayoutGrid, Lightbulb, BarChart3, Menu } from "lucide-react";
import { T } from "../theme";

export type TabKey = "home" | "content" | "ideas" | "reports" | "more";

const ITEMS: { key: TabKey; label: string; icon: typeof Home }[] = [
  { key: "home", label: "Home", icon: Home },
  { key: "content", label: "Contenuti", icon: LayoutGrid },
  { key: "ideas", label: "Idee", icon: Lightbulb },
  { key: "reports", label: "Report", icon: BarChart3 },
  { key: "more", label: "Altro", icon: Menu },
];

/**
 * Barra di navigazione fissa in basso, stile app. Voce attiva in salvia Be Kind.
 * Rispetta la safe-area (notch/home-indicator). `dot` accende un pallino sulle
 * voci con azioni da fare (es. brief da completare).
 */
export function BottomNav({ active, onChange, dots }: {
  active: TabKey;
  onChange: (k: TabKey) => void;
  dots?: Partial<Record<TabKey, boolean>>;
}) {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 border-t"
      style={{
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(10px)",
        borderColor: T.cardBorder,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="max-w-xl mx-auto grid grid-cols-5">
        {ITEMS.map(({ key, label, icon: Icon }) => {
          const on = active === key;
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className="relative flex flex-col items-center gap-1 py-2.5 active:scale-[.97] transition-transform"
              aria-label={label}
            >
              <span className="relative">
                <Icon size={22} strokeWidth={on ? 2.4 : 1.9} style={{ color: on ? T.sage : T.softMuted }} />
                {dots?.[key] && <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full" style={{ background: "#e0824f" }} />}
              </span>
              <span className="text-[10px] font-semibold" style={{ color: on ? T.sageDark : T.softMuted }}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
