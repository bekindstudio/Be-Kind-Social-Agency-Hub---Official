import { useState } from "react";
import { Link } from "wouter";
import type { SocialPlatform } from "@/types/client";

interface AddToPlanModalProps {
  open: boolean;
  onClose: () => void;
  initialTitle: string;
  platform: SocialPlatform;
  caption: string;
  clientId: string;
  onAdd: (payload: { title: string; scheduledDate: string; platform: SocialPlatform; caption: string; clientId: string }) => void;
}

export function AddToPlanModal({ open, onClose, initialTitle, platform, caption, clientId, onAdd }: AddToPlanModalProps) {
  const [title, setTitle] = useState(initialTitle);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("09:00");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-xl border border-card-border bg-card p-4 space-y-3">
        <h3 className="text-lg font-semibold">Aggiungi al piano editoriale</h3>
        <label className="block text-sm">
          Titolo post
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2" />
        </label>
        <label className="block text-sm">
          Piattaforma
          <input value={platform} readOnly className="mt-1 w-full rounded-lg border border-input bg-muted px-3 py-2 text-muted-foreground" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-sm">
            Data pianificata
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2" />
          </label>
          <label className="block text-sm">
            Ora
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2" />
          </label>
        </div>
        <label className="block text-sm">
          Caption (readonly)
          <textarea value={caption} readOnly rows={5} className="mt-1 w-full rounded-lg border border-input bg-muted px-3 py-2 text-muted-foreground resize-none" />
        </label>
        <div className="flex items-center justify-between">
          <Link href="/tools/calendar" className="text-xs text-violet-700 underline">Vai al calendario →</Link>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-2 text-sm text-muted-foreground">Annulla</button>
            <button
              onClick={() => {
                if (!title.trim() || !date) return;
                const scheduledDate = new Date(`${date}T${time}:00`).toISOString();
                onAdd({ title: title.trim(), scheduledDate, platform, caption, clientId });
                onClose();
              }}
              className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
            >
              Aggiungi al piano
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
