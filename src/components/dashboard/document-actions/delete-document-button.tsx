"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function DeleteDocumentButton({
  documentId,
  documentTitle,
}: {
  documentId: string;
  documentTitle: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  async function deleteDocument() {
    setDeleting(true);
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        toast.error(payload.error ?? "Could not delete document.");
        return;
      }

      toast.success("Document deleted.");
      setOpen(false);
      router.push("/dashboard/documents");
      router.refresh();
    } catch {
      toast.error("Could not delete document.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        aria-label="Delete document"
        className="text-[var(--color-coral-ink)]"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-3.5" /> Delete
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[oklch(15%_0.02_260/0.45)] p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deleting) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-document-title"
            className="w-full max-w-[420px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-float)]"
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-coral-soft)] text-[var(--color-coral-ink)]">
                <AlertTriangle className="size-4" />
              </span>
              <div className="min-w-0">
                <h2 id="delete-document-title" className="text-[15px] font-semibold">
                  Delete this document?
                </h2>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--muted)]">
                  This permanently removes <span className="text-[var(--foreground)]">{documentTitle}</span>,
                  including its clauses, reminders, chats, exports, and stored PDF.
                </p>
              </div>
              <button
                type="button"
                aria-label="Cancel delete"
                disabled={deleting}
                onClick={() => setOpen(false)}
                className="ml-auto inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--faint)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] disabled:opacity-50"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                size="md"
                className="min-h-11 w-full sm:w-auto"
                disabled={deleting}
                onClick={() => setOpen(false)}
              >
                Keep document
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                className="min-h-11 w-full bg-[var(--color-coral)] text-white hover:bg-[color-mix(in_oklch,var(--color-coral)_88%,black)] sm:w-auto"
                disabled={deleting}
                onClick={() => void deleteDocument()}
              >
                {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                Delete permanently
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
