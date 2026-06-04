import {
  Sparkles,
  TrendingUp,
  CalendarClock,
  ShieldAlert,
  ArrowUpRight,
  PiggyBank,
  Hourglass,
} from "lucide-react";
import Link from "next/link";
import { PageBody, PageHeader, SectionHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { RiskPill } from "@/components/ui/risk-pill";
import { documents } from "@/lib/mock-data";
import { reminders } from "@/lib/mock-reminders";

export default function InsightsPage() {
  const monthlySpend = 2054;
  const renewalsSoon = documents.filter((d) => d.tags.includes("Auto-renew")).length;
  const flagged = documents.filter((d) => d.risk === "High" || d.risk === "Needs Review");
  const noticeWindows = reminders.filter((r) => r.type === "Notice" && r.status !== "sent");

  return (
    <PageBody>
      <PageHeader
        eyebrow={
          <>
            <Sparkles className="size-3 inline -mt-0.5 mr-1" /> Pro · weekly digest
          </>
        }
        title={
          <>
            Your{" "}
            <span className="italic text-[var(--accent-ink)]">
              contract health
            </span>
            , this week.
          </>
        }
        description="A calm, weekly read on what you're spending, what's coming due, and where Clausly thinks you should look. Generated Mondays at 9am."
        actions={
          <Button variant="secondary" size="md">
            <ArrowUpRight className="size-3.5" /> Email me this
          </Button>
        }
      />

      {/* Hero insight */}
      <div className="mt-10 relative overflow-hidden rounded-[var(--radius-2xl)] border border-[color-mix(in_oklch,var(--accent)_28%,var(--border))] bg-gradient-to-br from-[var(--accent-soft)] via-[var(--surface)] to-[var(--surface)] p-7 md:p-10">
        <div
          aria-hidden
          className="absolute -top-24 -right-24 size-72 rounded-full opacity-40"
          style={{ background: "radial-gradient(circle, color-mix(in oklch, var(--accent) 40%, transparent), transparent 70%)" }}
        />
        <div className="relative grid md:grid-cols-2 gap-10 items-end">
          <div>
            <Badge tone="clause">
              <TrendingUp className="size-2.5" /> Headline
            </Badge>
            <p className="mt-4 font-serif text-[clamp(1.75rem,3.2vw,2.8rem)] leading-[1.05] tracking-[-0.015em] text-balance">
              You&apos;re paying{" "}
              <span className="italic text-[var(--accent-ink)]">${monthlySpend.toLocaleString()}/mo</span>{" "}
              across {documents.length} active contracts.
            </p>
            <p className="mt-4 text-[14.5px] leading-relaxed text-[var(--muted)] max-w-xl">
              {renewalsSoon} of them auto-renew within 90 days. {noticeWindows.length} have
              notice windows you&apos;ll need to hit, and {flagged.length} have clauses that deserve a closer look.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { i: PiggyBank, v: `$${monthlySpend.toLocaleString()}`, l: "Monthly spend" },
              { i: Hourglass, v: noticeWindows.length, l: "Notice windows" },
              { i: ShieldAlert, v: flagged.length, l: "Need attention" },
            ].map(({ i: I, v, l }) => (
              <div
                key={l}
                className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4"
              >
                <I className="size-4 text-[var(--accent)]" />
                <p className="mt-3 font-serif text-[26px] leading-none tracking-[-0.01em] tabular-nums">
                  {v}
                </p>
                <p className="text-[11.5px] text-[var(--muted)] mt-1">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section 1: Spend breakdown */}
      <div className="mt-14">
        <SectionHeader
          title="Where your money is going"
          description="Recurring spend by document, biggest first."
        />
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          {documents
            .filter((d) => d.monthly)
            .sort((a, b) => Number(b.monthly?.replace(/[^0-9.]/g, "")) - Number(a.monthly?.replace(/[^0-9.]/g, "")))
            .map((d, _i, arr) => {
              const amount = Number(d.monthly?.replace(/[^0-9.]/g, "")) || 0;
              const max = Math.max(...arr.map((x) => Number(x.monthly?.replace(/[^0-9.]/g, "")) || 0));
              const pct = (amount / max) * 100;
              return (
                <div key={d.id} className="px-5 py-4 border-b border-[var(--border)] last:border-0">
                  <div className="flex items-center gap-4 justify-between">
                    <Link href={`/dashboard/documents/${d.id}`} className="text-[13.5px] font-medium hover:underline truncate">
                      {d.title}
                    </Link>
                    <span className="font-serif text-[18px] tabular-nums tracking-[-0.005em] shrink-0">
                      {d.monthly}
                    </span>
                  </div>
                  <div className="mt-2.5 h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent)] rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Section 2: Upcoming notice windows */}
      <div className="mt-14">
        <SectionHeader
          title="Notice windows you need to hit"
          description="Deadlines for opting out of auto-renewals."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {noticeWindows.map((r) => (
            <Link
              key={r.id}
              href={`/dashboard/documents/${r.docId}`}
              className="group rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 hover:border-[var(--border-strong)] transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <Badge tone="ember">
                  <CalendarClock className="size-2.5" /> {r.type}
                </Badge>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)]">
                  in {r.daysAway} days
                </span>
              </div>
              <p className="font-serif text-[18px] leading-tight tracking-[-0.005em] line-clamp-2">
                {r.title}
              </p>
              <p className="mt-2 text-[12.5px] text-[var(--muted)] truncate">{r.docTitle}</p>
              <p className="mt-3 font-mono text-[12px] text-[var(--foreground)] tabular-nums">
                Fires {r.fireOn}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* Section 3: Things worth a closer look */}
      <div className="mt-14">
        <SectionHeader
          title="Worth a closer look"
          description="Documents Clausly flagged this week."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {flagged.map((d) => (
            <Link
              key={d.id}
              href={`/dashboard/documents/${d.id}`}
              className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 hover:border-[var(--border-strong)]"
            >
              <div className="flex items-center justify-between">
                <RiskPill level={d.risk} size="sm" />
                <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)]">
                  {d.type}
                </span>
              </div>
              <p className="mt-4 font-serif text-[17px] leading-tight tracking-[-0.005em] line-clamp-2">
                {d.title}
              </p>
              <p className="mt-3 text-[12.5px] text-[var(--muted)] line-clamp-2 leading-relaxed">
                {d.summary}
              </p>
            </Link>
          ))}
        </div>
      </div>

      <p className="mt-16 text-[11.5px] leading-relaxed text-[var(--faint)] max-w-2xl">
        Insights are generated from your portfolio. They are not legal advice. Clausly
        does not interpret state-specific legal nuances or recommend actions a
        licensed attorney would.
      </p>
    </PageBody>
  );
}
