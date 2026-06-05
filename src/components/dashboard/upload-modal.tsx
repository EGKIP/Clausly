"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, UploadCloud, FileText, Sparkles, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function UploadModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [drag, setDrag] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [phase, setPhase] = React.useState<"idle" | "uploading" | "analyzing" | "error">("idle");
  const [documentId, setDocumentId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setFile(null);
      setPhase("idle");
      setDocumentId(null);
      setError(null);
    }
  }, [open]);

  React.useEffect(() => {
    if (!file) return;
    let cancelled = false;
    const uploadFile = file;
    async function upload() {
      setPhase("uploading");
      setError(null);
      const body = new FormData();
      body.set("file", uploadFile);
      const response = await fetch("/api/upload", {
        method: "POST",
        body,
      });
      if (cancelled) return;
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Upload failed." }));
        setError(payload.error ?? "Upload failed.");
        setPhase("error");
        return;
      }
      const payload = (await response.json()) as { id: string };
      setDocumentId(payload.id);
      setPhase("analyzing");
    }
    void upload();
    return () => {
      cancelled = true;
    };
  }, [file]);

  const onDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[oklch(15%_0.02_260/0.45)] backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[560px] rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-float)] overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <div>
                <h2 className="font-serif text-[22px] leading-none tracking-[-0.01em]">
                  Upload a document
                </h2>
                <p className="mt-1.5 text-[12.5px] text-[var(--muted)]">
                  PDF up to 25 MB. Native or scanned.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="inline-flex size-8 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] hover:bg-[var(--surface-2)]"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-6">
              {phase === "idle" && (
                <label
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDrag(true);
                  }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={onDrop}
                  className={cn(
                    "block rounded-[var(--radius-lg)] border-2 border-dashed cursor-pointer transition-colors p-10 text-center",
                    drag
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                      : "border-[var(--border-strong)] hover:border-[var(--accent)] hover:bg-[var(--surface-2)]"
                  )}
                >
                  <input
                    type="file"
                    accept="application/pdf"
                    className="sr-only"
                    onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
                  />
                  <div className="mx-auto inline-flex size-12 items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-card)]">
                    <UploadCloud className="size-5 text-[var(--accent)]" />
                  </div>
                  <p className="mt-4 font-medium text-[15px]">
                    Drop a PDF here, or click to browse
                  </p>
                  <p className="mt-1.5 text-[12.5px] text-[var(--muted)]">
                    Lease, insurance, employment, or any contract.
                  </p>
                </label>
              )}

              {phase !== "idle" && file && (
                <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)] p-4">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex size-10 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface)] border border-[var(--border)]">
                      <FileText className="size-4 text-[var(--muted)]" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-[14px] font-medium">{file.name}</p>
                      <p className="text-[11.5px] text-[var(--muted)]">
                        {(file.size / 1024 / 1024).toFixed(2)} MB · PDF
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 h-1 rounded-full bg-[var(--border)] overflow-hidden">
                    <motion.div
                      key={phase}
                      initial={{ width: phase === "uploading" ? "0%" : "72%" }}
                      animate={{ width: phase === "uploading" ? "72%" : phase === "error" ? "72%" : "100%" }}
                      transition={{ duration: phase === "uploading" ? 0.9 : 1.2, ease: "easeInOut" }}
                      className={cn("h-full", phase === "error" ? "bg-[var(--color-coral)]" : "bg-[var(--accent)]")}
                    />
                  </div>
                  <p className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-[var(--accent-ink)]">
                    <Sparkles className="size-3" />
                    {phase === "uploading" && "Uploading securely…"}
                    {phase === "analyzing" && "Queued for clause, date and risk analysis…"}
                    {phase === "error" && (error ?? "Upload failed.")}
                  </p>
                </div>
              )}

              <div className="mt-5 flex items-center gap-2 text-[11.5px] text-[var(--faint)]">
                <Lock className="size-3" />
                Encrypted at rest · never used to train AI models
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--border)] bg-[var(--surface-2)]">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!documentId}
                onClick={() => {
                  if (!documentId) return;
                  router.push(`/dashboard/documents/${documentId}`);
                  router.refresh();
                  onClose();
                }}
              >
                {phase === "analyzing" ? "Open document" : "Analyze"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
