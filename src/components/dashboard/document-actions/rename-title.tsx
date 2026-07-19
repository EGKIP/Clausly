"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MAX_TITLE_LENGTH = 200;

export function RenameableTitle({
  documentId,
  title,
  className,
}: {
  documentId: string;
  title: string;
  className?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(title);
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setValue(title);
  }, [title]);

  React.useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  async function save() {
    const nextTitle = value.trim();
    if (!nextTitle) {
      toast.error("Document name can't be empty.");
      return;
    }
    if (nextTitle === title) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: nextTitle }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        toast.error(payload.error ?? "Could not rename document.");
        return;
      }
      toast.success("Document renamed.");
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <form
        className={cn("flex flex-wrap items-center gap-2", className)}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <input
          ref={inputRef}
          value={value}
          maxLength={MAX_TITLE_LENGTH}
          disabled={saving}
          aria-label="Document name"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setValue(title);
              setEditing(false);
            }
          }}
          className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 font-serif text-[clamp(1.4rem,2.2vw,1.9rem)] leading-tight tracking-[-0.015em] outline-none focus:border-[var(--accent)]"
        />
        <button
          type="submit"
          disabled={saving}
          aria-label="Save document name"
          className="inline-flex size-9 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-2)] disabled:opacity-50"
        >
          <Check className="size-4" />
        </button>
        <button
          type="button"
          disabled={saving}
          aria-label="Cancel rename"
          onClick={() => {
            setValue(title);
            setEditing(false);
          }}
          className="inline-flex size-9 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-2)] disabled:opacity-50"
        >
          <X className="size-4" />
        </button>
      </form>
    );
  }

  return (
    <div className={cn("group flex items-start gap-2", className)}>
      <h1 className="min-w-0 font-serif text-[clamp(2rem,3.2vw,2.8rem)] leading-[1.05] tracking-[-0.015em] text-balance">
        {title}
      </h1>
      <button
        type="button"
        aria-label="Rename document"
        title="Rename document"
        onClick={() => setEditing(true)}
        className="mt-2 inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--faint)] opacity-70 transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] group-hover:opacity-100"
      >
        <Pencil className="size-3.5" />
      </button>
    </div>
  );
}
