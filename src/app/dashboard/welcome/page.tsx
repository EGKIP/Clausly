import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  FileText,
  Sparkles,
  Upload,
  Quote,
  ShieldCheck,
} from "lucide-react";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/primitives";
import { MarkOnboardedLink } from "./mark-onboarded-link";

export const metadata = {
  title: "Welcome to Clausly",
  description: "A short tour of how Clausly reads, surfaces, and reminds.",
};

const steps = [
  {
    icon: Upload,
    eyebrow: "01 · Upload",
    title: "Drop a PDF you've signed.",
    body: "Leases, insurance, employment offers, NDAs. PDFs up to 25 MB. Native or scanned — Clausly handles both.",
  },
  {
    icon: Sparkles,
    eyebrow: "02 · Review",
    title: "We read it carefully.",
    body: "Plain-English summaries, the clauses worth knowing, and a precise risk read on the ones that aren't.",
  },
  {
    icon: BellRing,
    eyebrow: "03 · Get reminded",
    title: "Nothing fires without your nod.",
    body: "Clausly suggests reminders for renewals, notice windows, and deadlines. You approve, edit, or ignore.",
  },
];

const promises = [
  "Encrypted at rest. Decrypted only when you open the document.",
  "Your documents are never used to train AI models.",
  "Clausly is an aid — not legal advice. Always read what we flag as High risk.",
];

export default function WelcomePage() {
  return (
    <PageBody className="max-w-[980px]">
      <PageHeader
        eyebrow={
          <>
            <Sparkles className="size-3 inline -mt-0.5 mr-1" /> First time here
          </>
        }
        title={
          <>
            Welcome to{" "}
            <span className="italic text-[var(--accent-ink)]">Clausly</span>.
          </>
        }
        description="A calm reader for the contracts in your life. Here's the rhythm: upload, review, get reminded. Three steps."
      />

      {/* Steps */}
      <ol className="mt-10 grid gap-3">
        {steps.map((s) => (
          <li
            key={s.eyebrow}
            className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] px-6 py-6 md:px-8 md:py-7 grid gap-5 md:grid-cols-[auto_1fr] md:items-start"
          >
            <span className="inline-flex size-12 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--accent-ink)] shrink-0">
              <s.icon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--faint)]">
                {s.eyebrow}
              </p>
              <h2 className="mt-2 font-serif text-[clamp(1.3rem,2vw,1.6rem)] leading-tight tracking-[-0.01em]">
                {s.title}
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--muted)] max-w-2xl">
                {s.body}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {/* What you can expect */}
      <section className="mt-14 rounded-[var(--radius-xl)] border border-[var(--border)] bg-gradient-to-b from-[var(--accent-soft)] to-[var(--surface)] p-7 md:p-9">
        <Badge tone="clause">
          <Quote className="size-2.5" /> What you can expect
        </Badge>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div>
            <h3 className="font-serif text-[20px] leading-tight tracking-[-0.005em]">
              A reader, not an oracle.
            </h3>
            <p className="mt-3 text-[14px] leading-relaxed text-[var(--accent-ink)]">
              Clausly explains the document you uploaded — what it says, where the
              dates land, which clauses tilt against you. It does not interpret
              state-specific law or recommend what an attorney would.
            </p>
          </div>
          <ul className="space-y-3">
            {promises.map((p) => (
              <li key={p} className="flex items-start gap-2 text-[13px] leading-relaxed text-[var(--accent-ink)]">
                <ShieldCheck className="size-3.5 mt-0.5 shrink-0" /> {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <div className="mt-12 flex flex-wrap items-center gap-3">
        <MarkOnboardedLink href="/dashboard/documents?upload=1">
          <Upload className="size-4" />
          Upload your first document
        </MarkOnboardedLink>
        <MarkOnboardedLink href="/dashboard" variant="secondary">
          <ArrowRight className="size-4" />
          Take me to the dashboard
        </MarkOnboardedLink>
        <Link
          href="/dashboard/documents"
          className="ml-auto inline-flex items-center gap-1.5 text-[12.5px] text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <FileText className="size-3.5" /> Skip the tour
        </Link>
      </div>

      {/* What happens after upload */}
      <div className="mt-12 rounded-[var(--radius-md)] border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)] px-5 py-4 flex items-center gap-3">
        <CheckCircle2 className="size-4 text-[var(--accent)] shrink-0" />
        <p className="text-[12.5px] text-[var(--muted)] leading-relaxed">
          After you upload, Clausly takes a minute or two to read. We&apos;ll surface a
          summary, the key clauses, and suggested reminders — you stay in control of
          what gets sent.
        </p>
      </div>

      <p className="mt-12 text-[11.5px] leading-relaxed text-[var(--faint)] max-w-2xl">
        Clausly is not a law firm and does not provide legal advice. For specific
        legal questions, please consult a licensed attorney in the document&apos;s
        jurisdiction.
      </p>
    </PageBody>
  );
}
