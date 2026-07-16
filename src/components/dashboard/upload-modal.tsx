"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, UploadCloud, FileText, Sparkles, Lock, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type UploadUsage = {
  plan: "free" | "pro";
  documents: {
    current: number;
    limit: number | null;
  };
};

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
  const [limitError, setLimitError] = React.useState(false);
  const [usage, setUsage] = React.useState<UploadUsage | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const atDocumentLimit = Boolean(
    usage?.plan === "free" &&
    usage.documents.limit !== null &&
    usage.documents.current >= usage.documents.limit
  );

  React.useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      abortRef.current = null;
      setFile(null);
      setPhase("idle");
      setDocumentId(null);
      setError(null);
      setLimitError(false);
      setUsage(null);
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function loadUsage() {
      const response = await fetch("/api/profile");
      if (cancelled || !response.ok) return;
      const payload = (await response.json()) as {
        plan?: "free" | "pro";
        usage?: { documents?: { current?: number; limit?: number | null } };
      };
      if (!payload.plan || !payload.usage?.documents) return;
      setUsage({
        plan: payload.plan,
        documents: {
          current: payload.usage.documents.current ?? 0,
          limit: payload.usage.documents.limit ?? null,
        },
      });
    }
    void loadUsage();
    return () => {
      cancelled = true;
    };
  }, [open]);

  React.useEffect(() => {
    if (!file) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const uploadFile = file;
    async function upload() {
      setPhase("uploading");
      setError(null);
      setDocumentId(null);
      const body = new FormData();
      body.set("file", uploadFile);
      try {
        const response = await fetch("/api/upload", {
          method: "POST",
          body,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (!response.ok) {
          const payload = await response.json().catch(() => ({ error: "Upload failed." }));
          const limit = response.status === 402 || payload.code === "PLAN_LIMIT_DOCUMENTS";
          // Validation failures carry the specific reason (wrong file type,
          // over the size limit, not a real PDF) in issues[] — surface that
          // instead of the generic top-level "Invalid upload." error.
          const issueMessage = Array.isArray(payload.issues) ? payload.issues[0]?.message : undefined;
          const message = issueMessage ?? payload.error ?? "Upload failed.";
          setLimitError(limit);
          setError(message);
          setPhase("error");
          if (!limit) toast.error(message);
          return;
        }
        const payload = (await response.json()) as { id: string };
        setDocumentId(payload.id);
        setPhase("analyzing");
        toast.success("Document uploaded. Clausly is reading it now.");
      } catch (uploadError) {
        if (controller.signal.aborted) return;
        const message = uploadError instanceof Error ? uploadError.message : "Upload failed.";
        setError(message);
        setPhase("error");
        toast.error(message);
      }
    }
    void upload();
    return () => {
      controller.abort();
      if (abortRef.current === controller) abortRef.current = null;
    };
  }, [file]);

  const resetUpload = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setFile(null);
    setDocumentId(null);
    setError(null);
    setLimitError(false);
    setPhase("idle");
  };

  const onDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDrag(false);
    if (atDocumentLimit) return;
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
            <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-[var(--border)]">
              <div className="min-w-0">
                <h2 className="font-serif text-[20px] sm:text-[22px] leading-none tracking-[-0.01em]">
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

            <div className="p-5 sm:p-6">
              {phase === "idle" && (
                <>
                  {usage?.plan === "free" && (
                    <PlanUsageLine usage={usage} atLimit={atDocumentLimit} />
                  )}
                  <label
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (!atDocumentLimit) setDrag(true);
                    }}
                    onDragLeave={() => setDrag(false)}
                    onDrop={onDrop}
                    className={cn(
                      "block rounded-[var(--radius-lg)] border-2 border-dashed cursor-pointer transition-colors p-7 sm:p-10 text-center",
                      usage?.plan === "free" && "mt-3",
                      atDocumentLimit && "cursor-not-allowed opacity-65",
                      drag
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                        : "border-[var(--border-strong)] hover:border-[var(--accent)] hover:bg-[var(--surface-2)]"
                    )}
                  >
                    <input
                      type="file"
                      accept="application/pdf"
                      className="sr-only"
                      disabled={atDocumentLimit}
                      onChange={(e) => {
                        if (atDocumentLimit) return;
                        if (e.target.files?.[0]) setFile(e.target.files[0]);
                      }}
                    />
                    <div className="mx-auto inline-flex size-12 items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-card)]">
                      <UploadCloud className="size-5 text-[var(--accent)]" />
                    </div>
                    <p className="mt-4 font-medium text-[15px]">
                      Drop a PDF here, or click to browse
                    </p>
                    <p className="mt-1.5 text-[12.5px] text-[var(--muted)]">
                      {atDocumentLimit
                        ? "Upgrade to Pro for unlimited uploads."
                        : "Lease, insurance, employment, or any contract."}
                    </p>
                  </label>
                </>
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
                  <p
                    className={cn(
                      "mt-3 inline-flex items-center gap-1.5 text-[12px]",
                      phase === "error" ? "text-[var(--color-coral-ink)]" : "text-[var(--accent-ink)]"
                    )}
                  >
                    {phase === "error" ? (
                      <TriangleAlert className="size-3 shrink-0" />
                    ) : (
                      <Sparkles className="size-3 shrink-0" />
                    )}
                    {phase === "uploading" && "Uploading securely…"}
                    {phase === "analyzing" && "Queued for clause, date and risk analysis…"}
                    {phase === "error" && (error ?? "Upload failed.")}
                  </p>
                  {phase === "error" && limitError && (
                    <p className="mt-3 text-[12.5px] text-[var(--muted)]">
                      <Link href="/upgrade" className="text-[var(--accent-ink)] hover:underline">
                        Upgrade to Pro
                      </Link>{" "}
                      for unlimited uploads.
                    </p>
                  )}
                  {phase === "error" && (
                    <Button variant="secondary" size="sm" onClick={resetUpload} className="mt-4">
                      Try again
                    </Button>
                  )}
                </div>
              )}

              <div className="mt-5 flex items-center gap-2 text-[11.5px] text-[var(--faint)]">
                <Lock className="size-3" />
                Encrypted at rest · never used to train AI models
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 sm:px-6 py-4 border-t border-[var(--border)] bg-[var(--surface-2)]">
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

function PlanUsageLine({ usage, atLimit }: { usage: UploadUsage; atLimit: boolean }) {
  const limit = usage.documents.limit ?? "Unlimited";
  return (
    <div
      className={cn(
        "rounded-[var(--radius-sm)] border px-3 py-2 text-[12.5px]",
        atLimit
          ? "border-[color-mix(in_oklch,var(--color-coral)_28%,var(--border))] bg-[var(--color-coral-soft)] text-[var(--color-coral-ink)]"
          : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]"
      )}
    >
      {usage.documents.current} / {limit} documents used
      {atLimit && (
        <>
          {" "}
          ·{" "}
          <Link href="/upgrade" className="font-medium underline underline-offset-2">
            Upgrade to Pro for unlimited uploads
          </Link>
        </>
      )}
    </div>
  );
}
