import Link from "next/link";
import {
  ShieldAlert,
  CalendarClock,
  Sparkles,
  ArrowRight,
  FileText,
  TrendingUp,
  Plus,
} from "lucide-react";
import { PageBody, PageHeader, SectionHeader } from "@/components/dashboard/page-header";
import { listDocuments } from "@/lib/db/documents";
import { listReminders } from "@/lib/db/reminders";
import { Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { DocumentCard } from "@/components/dashboard/document-card";
import { PortfolioEmptyState } from "@/components/dashboard/empty-states/portfolio-empty";
import { cn } from "@/lib/utils";

export default async function DashboardHomePage() {
  const [documents, reminders] = await Promise.all([listDocuments(), listReminders()]);

  if (documents.length === 0) {
    return (
      <PageBody>
        <PortfolioEmptyState variant="home" />
        <Disclaimer />
      </PageBody>
    );
  }

  const upcoming = [...reminders]
    .filter((r) => r.status !== "sent")
    .sort((a, b) => a.daysAway - b.daysAway)
    .slice(0, 4);
  const needsReview = documents.filter((d) => d.risk === "Needs Review");
  const highRisk = documents.filter((d) => d.risk === "High");
  const recent = [...documents]
    .sort((a, b) => a.uploadedDaysAgo - b.uploadedDaysAgo)
    .slice(0, 3);

  const stats = [
    { label: "Active documents", value: documents.length, hint: "in your portfolio" },
    { label: "High-risk items", value: highRisk.length, hint: "across all contracts" },
    { label: "Suggested reminders", value: reminders.filter((r) => r.status === "suggested").length, hint: "awaiting approval" },
    { label: "Approved", value: reminders.filter((r) => r.status === "approved").length, hint: "queued up" },
  ];

  return (
    <PageBody>
      <PageHeader
        eyebrow={`${weekday()} · welcome back`}
        title={
          <>
            <span className="italic text-[var(--accent-ink)]">{upcoming.length}</span>{" "}
            things need your attention today.
          </>
        }
        description="A calm overview of what's coming up across the documents you've signed. Nothing fires without your nod."
        actions={
          <>
            <Button variant="secondary" size="md" href="/dashboard/insights">
              <Sparkles className="size-3.5" /> Insights
            </Button>
            <Button variant="primary" size="md" href="/dashboard/documents">
              <Plus className="size-3.5" /> Upload
            </Button>
          </>
        }
      />

      {/* Stat strip */}
      <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="relative rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)]">
              {s.label}
            </p>
            <p className="mt-2 font-serif text-[32px] leading-none tracking-[-0.02em]">
              {s.value}
            </p>
            <p className="mt-1.5 text-[11.5px] text-[var(--muted)]">{s.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming */}
        <div className="lg:col-span-2">
          <SectionHeader
            title="Upcoming attention"
            description="Sorted by urgency. Click in to see the source clause."
            action={
              <Link
                href="/dashboard/reminders"
                className="inline-flex items-center gap-1 text-[12.5px] text-[var(--accent-ink)] hover:gap-1.5 transition-[gap]"
              >
                All reminders <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)] overflow-hidden">
            {upcoming.map((r) => {
              const tone = r.daysAway < 14 ? "coral" : r.daysAway < 30 ? "ember" : "iris";
              return (
                <Link
                  key={r.id}
                  href={`/dashboard/documents/${r.docId}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--surface-2)] transition-colors"
                >
                  <span
                    className={cn(
                      "inline-flex size-10 items-center justify-center rounded-[var(--radius-sm)] border",
                      tone === "coral" && "bg-[var(--color-coral-soft)] text-[var(--color-coral-ink)] border-[color-mix(in_oklch,var(--color-coral)_22%,transparent)]",
                      tone === "ember" && "bg-[var(--color-ember-soft)] text-[var(--color-ember-ink)] border-[color-mix(in_oklch,var(--color-ember)_22%,transparent)]",
                      tone === "iris" && "bg-[var(--color-iris-soft)] text-[var(--color-iris)] border-[color-mix(in_oklch,var(--color-iris)_22%,transparent)]"
                    )}
                  >
                    {r.type === "Renewal" || r.type === "Notice" ? (
                      <CalendarClock className="size-4" />
                    ) : r.type === "Review" ? (
                      <Sparkles className="size-4" />
                    ) : (
                      <ShieldAlert className="size-4" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium leading-tight">{r.title}</p>
                    <p className="mt-1 text-[12px] text-[var(--muted)]">
                      <span className="font-mono tabular-nums">{r.fireOn}</span>
                      <span className="mx-1.5 text-[var(--faint)]">·</span>
                      {r.docTitle}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-serif text-[20px] leading-none tracking-[-0.01em] tabular-nums">
                      {r.daysAway}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--faint)] mt-1">
                      days
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Side rail */}
        <div className="space-y-5">
          {/* Needs review */}
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="size-3.5 text-[var(--color-iris)]" />
              <h3 className="font-serif text-[18px] leading-none tracking-[-0.01em]">
                Fresh summaries
              </h3>
            </div>
            <p className="text-[12.5px] text-[var(--muted)]">
              Clausly just finished reading these.
            </p>
            <div className="mt-4 space-y-2">
              {needsReview.length === 0 ? (
                <p className="text-[12.5px] text-[var(--faint)] italic">
                  Nothing waiting — you&apos;re caught up.
                </p>
              ) : (
                needsReview.map((d) => (
                  <Link
                    key={d.id}
                    href={`/dashboard/documents/${d.id}`}
                    className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 hover:border-[var(--border-strong)]"
                  >
                    <FileText className="size-3.5 text-[var(--muted)] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-[12.5px] font-medium">{d.title}</p>
                      <p className="text-[11px] text-[var(--muted)]">{d.uploadedDaysAgo}d ago</p>
                    </div>
                    <ArrowRight className="size-3.5 text-[var(--faint)]" />
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Pro insight teaser */}
          <ProInsightTeaser />
        </div>
      </div>

      {/* Recently uploaded */}
      <div className="mt-14">
        <SectionHeader
          title="Recently uploaded"
          action={
            <Link
              href="/dashboard/documents"
              className="inline-flex items-center gap-1 text-[12.5px] text-[var(--accent-ink)] hover:gap-1.5 transition-[gap]"
            >
              All documents <ArrowRight className="size-3.5" />
            </Link>
          }
        />
        <div data-tour="documents" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {recent.map((d) => (
            <DocumentCard key={d.id} doc={d} />
          ))}
        </div>
      </div>

      <Disclaimer />
    </PageBody>
  );
}

/* ── Pieces ─────────────────────────────────────────────────────────── */
function ProInsightTeaser() {
  return (
    <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[color-mix(in_oklch,var(--accent)_30%,var(--border))] bg-gradient-to-b from-[var(--accent-soft)] to-[var(--surface)] p-5">
      <div
        aria-hidden
        className="absolute -top-12 -right-12 size-32 rounded-full opacity-40"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklch, var(--accent) 35%, transparent), transparent 70%)",
        }}
      />
      <div className="relative">
        <Badge tone="clause"><TrendingUp className="size-2.5" /> Weekly insight</Badge>
        <h3 className="mt-3 font-serif text-[18px] leading-tight tracking-[-0.005em]">
          You&apos;re paying $2,054 / month across recurring contracts.
        </h3>
        <p className="mt-2 text-[12.5px] text-[var(--accent-ink)] leading-relaxed">
          Two of them auto-renew within 90 days. Three have notice windows you should hit.
        </p>
        <Button variant="ghost" size="sm" href="/dashboard/insights" className="mt-4 -ml-2">
          See full breakdown <ArrowRight className="size-3" />
        </Button>
      </div>
    </div>
  );
}

function Disclaimer() {
  return (
    <p className="mt-16 text-[11.5px] leading-relaxed text-[var(--faint)] max-w-2xl">
      Clausly helps you organise and understand documents you&apos;ve signed. It is not
      a law firm and does not provide legal advice. For interpretation of specific
      legal terms, please consult a licensed attorney in your jurisdiction.
    </p>
  );
}

function weekday() {
  return new Date().toLocaleDateString("en-US", { weekday: "long" });
}
