import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, Share2, Trash2 } from "lucide-react";
import { PageBody } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { RiskPill } from "@/components/ui/risk-pill";
import { getDocumentDetail, listDocuments } from "@/lib/db/documents";
import { DocumentView } from "@/components/dashboard/document-view";
import { AnalysisGate } from "@/components/dashboard/analysis-gate";
import { CompareWithButton } from "@/components/dashboard/compare/compare-with-button";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) return [];
  const documents = await listDocuments();
  return documents.map((d) => ({ id: d.id }));
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DocumentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [detail, documents] = await Promise.all([getDocumentDetail(id), listDocuments()]);
  if (!detail) notFound();
  const {
    document: doc,
    status,
    errorMessage,
    clauses: docClauses,
    reminders: docReminders,
    signedUrl,
  } = detail;
  const isReady = status === "ready";

  return (
    <PageBody className="max-w-[1480px]">
      {/* Breadcrumb */}
      <Link
        href="/dashboard/documents"
        className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--muted)] hover:text-[var(--foreground)] mb-5"
      >
        <ArrowLeft className="size-3.5" /> All documents
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {isReady ? (
              <RiskPill level={doc.risk} />
            ) : (
              <Badge tone="outline">{statusLabel(status)}</Badge>
            )}
            <Badge tone="outline">{doc.type}</Badge>
            {doc.jurisdiction !== "—" && <Badge tone="outline">{doc.jurisdiction}</Badge>}
            <Badge tone="outline">{doc.pages} pages</Badge>
            <span className="font-mono text-[10.5px] text-[var(--faint)] uppercase tracking-[0.14em]">
              Uploaded {doc.uploadedDaysAgo}d ago
            </span>
          </div>
          <h1 className="mt-4 font-serif text-[clamp(2rem,3.2vw,2.8rem)] leading-[1.05] tracking-[-0.015em] text-balance">
            {doc.title}
          </h1>
          <p className="mt-2 text-[14px] text-[var(--muted)]">
            {doc.party}
            {doc.monthly && (
              <>
                <span className="mx-2 text-[var(--faint)]">·</span>
                <span className="font-mono">{doc.monthly}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button variant="ghost" size="sm" aria-label="Download">
            <Download className="size-3.5" /> Download
          </Button>
          <Button variant="ghost" size="sm" aria-label="Share">
            <Share2 className="size-3.5" /> Share
          </Button>
          <CompareWithButton currentDocument={doc} documents={documents} />
          <Button variant="ghost" size="sm" aria-label="Delete" className="text-[var(--color-coral-ink)]">
            <Trash2 className="size-3.5" /> Delete
          </Button>
        </div>
      </div>

      <AnalysisGate
        documentId={doc.id}
        initialStatus={status}
        initialErrorMessage={errorMessage}
      >
        <DocumentView doc={doc} clauses={docClauses} reminders={docReminders} signedUrl={signedUrl} />
      </AnalysisGate>

      <p className="mt-10 text-[11.5px] leading-relaxed text-[var(--faint)] max-w-2xl">
        Clausly&apos;s analysis is an aid, not legal advice. Always read clauses we flag as
        High risk in full. For specific legal questions, consult a licensed attorney in
        the document&apos;s jurisdiction.
      </p>
    </PageBody>
  );
}

function statusLabel(status: "pending" | "analyzing" | "ready" | "failed") {
  switch (status) {
    case "analyzing":
      return "Analyzing";
    case "pending":
      return "Queued";
    case "failed":
      return "Failed";
    default:
      return "Ready";
  }
}
