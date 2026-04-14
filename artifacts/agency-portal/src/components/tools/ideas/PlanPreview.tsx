import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { jsPDF } from "jspdf";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import type { PlanResponse } from "@/types/content-ideas";
import type { SocialPlatform } from "@/types/client";

interface PlanPreviewProps {
  plan: PlanResponse;
  onImportCalendar: (status: "draft" | "approved") => number;
}

export function PlanPreview({ plan, onImportCalendar }: PlanPreviewProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [importMode, setImportMode] = useState<"draft" | "approved">("draft");

  const summaryText = useMemo(() => {
    return `${plan.summary.totalPosts} post totali · ${plan.weeks.length} settimane · copertura ${plan.summary.coveragePercent}%`;
  }, [plan]);

  return (
    <section className="space-y-3 rounded-xl border border-card-border bg-card p-4">
      <h3 className="text-base font-semibold">Preview piano editoriale</h3>
      <Accordion type="multiple" defaultValue={plan.weeks.map((week) => String(week.weekNumber))}>
        {plan.weeks.map((week) => {
          const firstDate = week.posts[0]?.scheduledDate ? new Date(week.posts[0].scheduledDate) : new Date(week.startDate);
          const lastDate = week.posts[week.posts.length - 1]?.scheduledDate ? new Date(week.posts[week.posts.length - 1].scheduledDate) : new Date(week.startDate);
          return (
            <AccordionItem key={week.weekNumber} value={String(week.weekNumber)}>
              <AccordionTrigger>
                Settimana {week.weekNumber} · {firstDate.toLocaleDateString("it-IT")} - {lastDate.toLocaleDateString("it-IT")} · Tema: {week.theme}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {week.posts
                    .slice()
                    .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
                    .map((post) => (
                      <div key={post.id} className="rounded-lg border border-border bg-background p-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span>{new Date(post.scheduledDate).toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "2-digit" })}</span>
                          <span>{post.scheduledTime}</span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                            <PlatformIcon platform={(post.platform || "instagram") as SocialPlatform} size="sm" />
                            {post.platform}
                          </span>
                          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-violet-700">{post.format}</span>
                        </div>
                        <p className="mt-1 text-sm font-medium">{post.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{post.caption}</p>
                        <p className="text-xs italic text-muted-foreground line-clamp-1">{post.visualSuggestion}</p>
                      </div>
                    ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      <footer className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
        <p className="text-sm">{summaryText}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground" onClick={() => setShowImportConfirm(true)}>
            Importa nel calendario
          </button>
          <button
            type="button"
            className="rounded-lg bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground"
            onClick={() => {
              const pdf = new jsPDF();
              pdf.setFontSize(12);
              let y = 16;
              pdf.text("Piano editoriale AI", 14, y);
              y += 8;
              plan.weeks.forEach((week) => {
                pdf.text(`Settimana ${week.weekNumber} - ${week.theme}`, 14, y);
                y += 6;
                week.posts.forEach((post) => {
                  const line = `${new Date(post.scheduledDate).toLocaleDateString("it-IT")} ${post.scheduledTime} | ${post.platform} | ${post.title}`;
                  pdf.text(line.slice(0, 170), 16, y);
                  y += 6;
                  if (y > 280) {
                    pdf.addPage();
                    y = 16;
                  }
                });
              });
              // TODO: export piano in formato Google Sheets.
              pdf.save(`piano-editoriale-${new Date().toISOString().slice(0, 10)}.pdf`);
            }}
          >
            Esporta come PDF
          </button>
          <button type="button" className="rounded-lg bg-muted px-3 py-2 text-sm font-semibold" onClick={() => toast({ title: "Modalità modifica", description: "Funzione di editing inline in arrivo." })}>
            Modifica prima di importare
          </button>
        </div>
      </footer>

      {showImportConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-card-border bg-card p-4">
            <h4 className="text-base font-semibold">Conferma importazione piano</h4>
            <p className="mt-1 text-sm text-muted-foreground">{summaryText}</p>
            <div className="mt-3 space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" checked={importMode === "draft"} onChange={() => setImportMode("draft")} />
                Importa come bozze
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={importMode === "approved"} onChange={() => setImportMode("approved")} />
                Importa come approvati
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-lg px-3 py-2 text-sm" onClick={() => setShowImportConfirm(false)}>
                Annulla
              </button>
              <button
                type="button"
                className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                onClick={() => {
                  const count = onImportCalendar(importMode);
                  setShowImportConfirm(false);
                  toast({
                    title: `Piano importato - ${count} post aggiunti al calendario`,
                    description: "Vai al calendario per rivedere i post importati.",
                  });
                  setLocation("/tools/calendar");
                }}
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
