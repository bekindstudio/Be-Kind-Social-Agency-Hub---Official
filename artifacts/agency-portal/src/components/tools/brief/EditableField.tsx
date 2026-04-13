import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface EditableFieldProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  ariaLabel: string;
  className?: string;
}

export function EditableField({
  value,
  onChange,
  placeholder,
  multiline = false,
  maxLength,
  ariaLabel,
  className,
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (!editing) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target as Node)) return;
      onChange(draft.trim());
      setEditing(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [editing, draft, onChange]);

  useEffect(() => {
    if (!editing || !textareaRef.current) return;
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(draft.length, draft.length);
    if (multiline) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(200, textareaRef.current.scrollHeight)}px`;
    }
  }, [editing, draft, multiline]);

  if (!editing) {
    return (
      <div ref={rootRef} className={className}>
        <button
          type="button"
          aria-label={ariaLabel}
          onClick={() => setEditing(true)}
          className={cn(
            "w-full rounded px-1 py-1 text-left text-sm hover:bg-muted/40 hover:underline decoration-dashed underline-offset-4",
            !value.trim() && "text-muted-foreground",
          )}
        >
          {value.trim() || placeholder || "Clicca per modificare"}
        </button>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={className}>
      <textarea
        ref={textareaRef}
        aria-label={ariaLabel}
        value={draft}
        maxLength={maxLength}
        rows={multiline ? 3 : 1}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          if (multiline) {
            event.currentTarget.style.height = "auto";
            event.currentTarget.style.height = `${Math.min(200, event.currentTarget.scrollHeight)}px`;
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setDraft(value);
            setEditing(false);
            return;
          }
          if (!multiline && event.key === "Enter") {
            event.preventDefault();
            onChange(draft.trim());
            setEditing(false);
          }
        }}
        onBlur={() => {
          onChange(draft.trim());
          setEditing(false);
        }}
        className="w-full resize-none rounded-lg border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </div>
  );
}
