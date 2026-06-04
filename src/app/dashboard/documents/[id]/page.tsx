import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, Share2, Trash2 } from "lucide-react";
import { PageBody } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { RiskPill } from "@/components/ui/risk-pill";
import { documents } from "@/lib/mock-data";
import { getClausesFor } from "@/lib/mock-clauses";
import { reminders } from "@/lib/mock-reminders";
import { DocumentView } from "@/components/dashboard/document-view";

export function generateStaticParams() {
  return documents.map((d) => ({ id: d.id }));
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DocumentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const doc = documents.find((d) => d.id === id);
  if (!doc) notFound();

  const docClauses = getClausesFor(doc.id);
  const docReminders = reminders.filter((r) => r.docId === doc.id);

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
            <RiskPill level={doc.risk} />
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
          <Button variant="ghost" size="sm" aria-label="Delete" className="text-[var(--color-coral-ink)]">
            <Trash2 className="size-3.5" /> Delete
          </Button>
        </div>
      </div>

      <DocumentView doc={doc} clauses={docClauses} reminders={docReminders} />

      <p className="mt-10 text-[11.5px] leading-relaxed text-[var(--faint)] max-w-2xl">
        Clausly&apos;s analysis is an aid, not legal advice. Always read clauses we flag as
        High risk in full. For specific legal questions, consult a licensed attorney in
        the document&apos;s jurisdiction.
      </p>
    </PageBody>
  );
}
