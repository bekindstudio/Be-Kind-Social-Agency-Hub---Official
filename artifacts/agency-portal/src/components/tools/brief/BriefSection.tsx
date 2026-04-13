import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface BriefSectionProps {
  title: string;
  description: string;
  children: ReactNode;
  completionPercent: number;
}

function completionClass(percent: number): string {
  if (percent > 80) return "bg-emerald-500";
  if (percent > 40) return "bg-amber-500";
  return "bg-rose-500";
}

export function BriefSection({ title, description, children, completionPercent }: BriefSectionProps) {
  const bounded = Math.max(0, Math.min(100, completionPercent));
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          <span className="text-xs font-medium text-muted-foreground">{bounded}%</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        <div className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full transition-all", completionClass(bounded))} style={{ width: `${bounded}%` }} />
        </div>
      </div>
      {children}
    </section>
  );
}
