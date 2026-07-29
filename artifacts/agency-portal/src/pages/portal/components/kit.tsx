import type { ReactNode } from "react";
import { Loader2, AlertCircle, Inbox } from "lucide-react";
import { CATEGORY_META } from "@/lib/ideasSchema";
import { T } from "../theme";

export function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}
export function fmtDay(iso?: string | null): { d: string; m: string } {
  if (!iso) return { d: "—", m: "" };
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return { d: "—", m: "" };
  return { d: String(dt.getDate()), m: dt.toLocaleDateString("it-IT", { month: "short" }) };
}

export function Spinner() {
  return <div className="py-16 flex justify-center"><Loader2 className="animate-spin" style={{ color: T.sage }} /></div>;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl ${className}`} style={{ background: T.creamDeep }} />;
}

export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: T.ink }}>{title}</h1>
        {subtitle && <p className="text-sm mt-0.5" style={{ color: T.muted }}>{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="py-14 text-center flex flex-col items-center">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: T.sageSoft, color: T.sage }}>
        {icon ?? <Inbox size={26} />}
      </div>
      <p className="font-semibold" style={{ color: T.ink }}>{title}</p>
      {hint && <p className="text-sm mt-1 max-w-xs" style={{ color: T.muted }}>{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="py-14 text-center flex flex-col items-center">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 bg-amber-100 text-amber-600">
        <AlertCircle size={26} />
      </div>
      <p className="font-semibold" style={{ color: T.ink }}>Qualcosa è andato storto</p>
      <p className="text-sm mt-1" style={{ color: T.muted }}>Controlla la connessione e riprova.</p>
      <button onClick={onRetry} className="mt-4 px-5 py-2.5 rounded-xl text-white font-semibold text-sm active:scale-[.98] transition-transform" style={{ background: T.sage }}>
        Riprova
      </button>
    </div>
  );
}

export function Chip({ children, tone = "sage" }: { children: ReactNode; tone?: "sage" | "neutral" }) {
  const style = tone === "sage"
    ? { background: T.sageSoft, color: T.sageDark }
    : { background: T.creamDeep, color: T.muted };
  return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={style}>{children}</span>;
}

export function CategoryChip({ category }: { category?: string | null }) {
  const meta = CATEGORY_META.find((c) => c.value === category);
  if (!meta || meta.value === "da_classificare") return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/85 text-zinc-700">
      <span className={`w-2 h-2 rounded-full ${meta.color}`} /> {meta.label}
    </span>
  );
}

export function StatCard({ label, value, icon }: { label: string; value: ReactNode; icon: ReactNode }) {
  return (
    <div className="flex-1 rounded-2xl p-3.5" style={{ background: T.card, border: `1px solid ${T.cardBorder}` }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ background: T.sageSoft, color: T.sage }}>{icon}</div>
      <div className="text-2xl font-extrabold tabular-nums leading-none" style={{ color: T.ink }}>{value}</div>
      <div className="text-[11px] mt-1" style={{ color: T.muted }}>{label}</div>
    </div>
  );
}
