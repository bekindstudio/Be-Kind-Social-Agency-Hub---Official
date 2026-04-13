import { useEffect, useState } from "react";
import { Copy, UploadCloud, X } from "lucide-react";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import type { EditorialPost, SocialPlatform } from "@/types/client";

interface PostDrawerProps {
  open: boolean;
  post: EditorialPost | null;
  onClose: () => void;
  onSave: (id: string, updates: Partial<EditorialPost>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (post: EditorialPost) => void;
}

const statuses: EditorialPost["status"][] = ["draft", "pending_approval", "approved", "published"];
const platforms: SocialPlatform[] = ["instagram", "facebook", "linkedin", "tiktok", "x", "youtube"];

function statusLabel(status: EditorialPost["status"]): string {
  if (status === "draft") return "Bozza";
  if (status === "pending_approval") return "In approvazione";
  if (status === "approved") return "Approvato";
  if (status === "published") return "Pubblicato";
  return "Rifiutato";
}

function dateValue(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function timeValue(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function PostDrawer({ open, post, onClose, onSave, onDelete, onDuplicate }: PostDrawerProps) {
  const [draftTag, setDraftTag] = useState("");
  const [local, setLocal] = useState<EditorialPost | null>(post);

  useEffect(() => {
    setLocal(post);
  }, [post]);

  if (!open || !post || !local) return null;

  const actionLabel =
    local.status === "draft"
      ? "Invia per approvazione"
      : local.status === "pending_approval"
        ? "Approva"
        : local.status === "approved"
          ? "Segna come pubblicato"
          : local.status === "rejected"
            ? "Rimetti in bozza"
            : "";

  const applyMainAction = () => {
    if (local.status === "draft") setLocal({ ...local, status: "pending_approval" });
    else if (local.status === "pending_approval") setLocal({ ...local, status: "approved" });
    else if (local.status === "approved") setLocal({ ...local, status: "published" });
    else if (local.status === "rejected") setLocal({ ...local, status: "draft" });
  };

  return (
    <>
      <div className={`fixed inset-0 z-[80] bg-black/40 transition-opacity ${open ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
      <aside className={`fixed right-0 top-0 z-[81] h-full w-full max-w-[420px] transform border-l border-border bg-card shadow-2xl transition-transform ${open ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex h-full flex-col">
          <div className="border-b border-border p-4">
            <div className="flex items-start justify-between gap-3">
              <input
                value={local.title}
                onChange={(e) => setLocal({ ...local, title: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm font-semibold"
                aria-label="Titolo post"
              />
              <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted">
                <X size={16} />
              </button>
            </div>
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs capitalize">
              <PlatformIcon platform={local.platform} size="sm" />
              {local.platform}
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <section>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Stato</p>
              <div className="mb-2 flex items-center gap-2 overflow-x-auto">
                {statuses.map((item) => (
                  <div key={item} className={`rounded-full px-2 py-0.5 text-[11px] ${item === local.status ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {statusLabel(item)}
                  </div>
                ))}
                {local.status === "rejected" && <div className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] text-rose-700">Rifiutato</div>}
              </div>
              <div className="flex gap-2">
                {actionLabel && (
                  <button type="button" onClick={applyMainAction} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                    {actionLabel}
                  </button>
                )}
                {local.status === "pending_approval" && (
                  <button type="button" onClick={() => setLocal({ ...local, status: "rejected" })} className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs text-rose-700">
                    Rifiuta
                  </button>
                )}
              </div>
            </section>

            <section className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Contenuto</p>
              <textarea
                value={local.caption}
                onChange={(e) => setLocal({ ...local, caption: e.target.value })}
                rows={6}
                className="w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm"
              />
              <p className="text-[11px] text-muted-foreground">{local.caption.length} caratteri</p>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={local.platform}
                  onChange={(e) => setLocal({ ...local, platform: e.target.value as SocialPlatform })}
                  className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs"
                >
                  {platforms.map((platform) => (
                    <option key={platform} value={platform}>
                      {platform}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={dateValue(local.scheduledDate)}
                  onChange={(e) => setLocal({ ...local, scheduledDate: new Date(`${e.target.value}T${timeValue(local.scheduledDate)}:00`).toISOString() })}
                  className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs"
                />
                <input
                  type="time"
                  value={timeValue(local.scheduledDate)}
                  onChange={(e) => setLocal({ ...local, scheduledDate: new Date(`${dateValue(local.scheduledDate)}T${e.target.value}:00`).toISOString() })}
                  className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs"
                />
              </div>
              <div>
                <p className="mb-1 text-[11px] text-muted-foreground">Hashtag</p>
                <div className="mb-1 flex flex-wrap gap-1">
                  {local.hashtags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setLocal({ ...local, hashtags: local.hashtags.filter((item) => item !== tag) })}
                      className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary"
                    >
                      {tag} ×
                    </button>
                  ))}
                </div>
                <input
                  value={draftTag}
                  onChange={(e) => setDraftTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const value = draftTag.trim();
                      if (!value) return;
                      setLocal({ ...local, hashtags: [...local.hashtags, value] });
                      setDraftTag("");
                    }
                  }}
                  placeholder="Aggiungi hashtag"
                  className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs"
                />
              </div>
            </section>

            <section>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Media</p>
              <div className="rounded-lg border border-dashed border-input p-4 text-center">
                <UploadCloud size={20} className="mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Trascina media qui</p>
                {/* TODO: integrate real media upload + storage provider */}
              </div>
              {local.mediaUrls.length > 0 && (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {local.mediaUrls.map((url) => (
                    <div key={url} className="aspect-square overflow-hidden rounded border border-input bg-muted">
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <p className="mb-1 text-xs font-semibold text-muted-foreground">Note interne</p>
              <textarea
                value={local.internalNotes ?? ""}
                onChange={(e) => setLocal({ ...local, internalNotes: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs"
              />
            </section>
          </div>

          <div className="flex items-center gap-2 border-t border-border p-3">
            <button type="button" onClick={() => onSave(local.id, local)} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
              Salva modifiche
            </button>
            <button type="button" onClick={() => onDuplicate(local)} className="rounded-lg border border-input px-3 py-2 text-xs">
              <span className="inline-flex items-center gap-1"><Copy size={12} /> Duplica post</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const ok = confirm("Eliminare questo post?");
                if (ok) onDelete(local.id);
              }}
              className="ml-auto rounded-lg border border-rose-300 px-3 py-2 text-xs text-rose-700"
            >
              Elimina
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
