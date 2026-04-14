import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface BriefSectionProps {
  title: string;
  description: string;
  children: ReactNode;
  completionPercent: number;
  icon?: ReactNode;
}

function completionClass(percent: number): string {
  if (percent > 80) return "bg-emerald-500";
  if (percent > 40) return "bg-amber-500";
  return "bg-rose-500";
}

export function BriefSection({ title, description, children, completionPercent, icon }: BriefSectionProps) {
  const bounded = Math.max(0, Math.min(100, completionPercent));
  return (
    <section className="rounded-2xl border border-border/70 bg-card/95 p-4 shadow-sm">
      <div className="mb-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="inline-flex items-center gap-2 text-sm font-semibold">
            {icon ? <span className="text-primary">{icon}</span> : null}
            {title}
          </h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{bounded}%</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full transition-all", completionClass(bounded))} style={{ width: `${bounded}%` }} />
        </div>
      </div>
      {children}
    </section>
  );
}
