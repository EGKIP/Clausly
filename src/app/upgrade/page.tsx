import { BarChart3, CalendarClock, FileText, Sparkles, Zap } from "lucide-react";
import { Badge, Container, Eyebrow, Headline } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";

const benefits = [
  {
    icon: FileText,
    title: "Unlimited documents",
    description: "Grow past the free five-document portfolio without trimming older contracts.",
  },
  {
    icon: BarChart3,
    title: "Weekly insights",
    description: "See spend, flagged contracts, notice windows, and renewals in one digest.",
  },
  {
    icon: Zap,
    title: "Priority processing",
    description: "Move uploaded PDFs through analysis faster as your portfolio gets busier.",
  },
  {
    icon: CalendarClock,
    title: "Reminder intelligence",
    description: "Keep approved renewal, notice, payment, and review reminders organized.",
  },
];

export default function UpgradePage() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <Container className="py-20 md:py-28">
        <div className="mx-auto max-w-[880px] text-center">
          <Eyebrow>
            <Sparkles className="size-3" /> Clausly Pro
          </Eyebrow>
          <Headline level={1} className="mt-6">
            Upgrade to Pro
          </Headline>
          <p className="mx-auto mt-5 max-w-2xl text-[15.5px] leading-relaxed text-[var(--muted)]">
            Pro is for portfolios that have outgrown the free plan: unlimited
            documents, weekly contract intelligence, and priority processing.
          </p>
          <div className="mt-8 flex justify-center">
            <Button type="button" variant="primary" size="lg" disabled>
              Coming soon — Stripe checkout opens in Track BB
            </Button>
          </div>
        </div>

        <div className="mx-auto mt-14 grid max-w-[1040px] gap-4 md:grid-cols-2">
          {benefits.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6"
            >
              <Badge tone="iris">
                <Icon className="size-2.5" /> Pro
              </Badge>
              <h2 className="mt-5 font-serif text-[24px] leading-tight tracking-[-0.01em]">
                {title}
              </h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--muted)]">
                {description}
              </p>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-12 max-w-2xl text-center text-[11.5px] leading-relaxed text-[var(--faint)]">
          Clausly provides contract intelligence, organization, and reminders.
          It is informational only and is not legal advice.
        </p>
      </Container>
    </main>
  );
}
