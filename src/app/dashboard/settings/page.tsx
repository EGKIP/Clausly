import {
  User,
  Bell,
  Lock,
  CreditCard,
  Globe,
  Sparkles,
  ChevronRight,
  Mail,
} from "lucide-react";
import Link from "next/link";
import { PageBody, PageHeader, SectionHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";

const sections = [
  { id: "profile", label: "Profile", icon: User, description: "Name, email, and default jurisdiction" },
  { id: "notifications", label: "Notifications", icon: Bell, description: "Email cadence and reminder defaults" },
  { id: "security", label: "Security", icon: Lock, description: "Password, 2FA, sessions" },
  { id: "billing", label: "Billing", icon: CreditCard, description: "Plan, invoices, payment methods" },
];

export default function SettingsPage() {
  return (
    <PageBody>
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Configure your workspace, reminder defaults, and billing."
      />

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8">
        {/* Section nav */}
        <nav>
          <ul className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)] overflow-hidden">
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="group flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-2)] transition-colors"
                >
                  <span className="inline-flex size-8 items-center justify-center rounded-[var(--radius-xs)] bg-[var(--surface-2)] border border-[var(--border)]">
                    <s.icon className="size-3.5 text-[var(--muted)]" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium">{s.label}</p>
                    <p className="text-[11px] text-[var(--muted)] truncate">{s.description}</p>
                  </div>
                  <ChevronRight className="size-3.5 text-[var(--faint)]" />
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Content */}
        <div className="space-y-12">
          {/* Profile */}
          <Card id="profile" title="Profile" description="Used for greetings and as a default for new documents.">
            <Field label="Display name" value="Emmanuel Kiprotich" />
            <Field label="Email" value="emmanuel@clausly.app" icon={Mail} />
            <Field label="Default jurisdiction" value="Minnesota, US" icon={Globe} />
            <p className="text-[11.5px] text-[var(--faint)] leading-relaxed">
              Per-document jurisdiction can still differ — for example, a Minnesota resident
              signing a California-governed contract.
            </p>
          </Card>

          {/* Notifications */}
          <Card
            id="notifications"
            title="Notifications"
            description="Email reminders only in v0.1. SMS and push are on the roadmap."
          >
            <Toggle label="Weekly insights email" sub="Mondays at 9am · Pro" defaultOn />
            <Toggle label="Reminder emails" sub="Sent on the date you approved" defaultOn />
            <Toggle label="Product updates" sub="New features, occasional and quiet" />
            <Field label="Default reminder lead time" value="14 days before the deadline" />
          </Card>

          {/* Security */}
          <Card
            id="security"
            title="Security"
            description="Documents are encrypted at rest. AI does not train on your content."
          >
            <Field label="Password" value="Last changed 28 days ago" />
            <Field label="Two-factor authentication" value="Not enabled" />
            <Field label="Active sessions" value="2 devices" />
          </Card>

          {/* Billing */}
          <Card
            id="billing"
            title="Billing"
            description="Your subscription and invoice history."
          >
            <div className="rounded-[var(--radius-md)] border border-[color-mix(in_oklch,var(--accent)_28%,var(--border))] bg-[var(--accent-soft)] p-5 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <Badge tone="clause">
                  <Sparkles className="size-2.5" /> Free
                </Badge>
                <p className="mt-2.5 font-serif text-[18px] leading-tight tracking-[-0.005em] text-[var(--accent-ink)]">
                  You&apos;re on the free plan.
                </p>
                <p className="mt-1 text-[12.5px] text-[var(--accent-ink)] opacity-80">
                  Upgrade to Pro for unlimited documents, weekly insights, and full risk analysis.
                </p>
              </div>
              <Button variant="accent" size="md">Upgrade to Pro</Button>
            </div>

            <div className="mt-4">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)] mb-2">
                Invoice history
              </p>
              <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)] px-4 py-6 text-center text-[13px] text-[var(--muted)]">
                No invoices yet.
              </div>
            </div>
          </Card>

          {/* Danger zone */}
          <Card
            id="danger"
            title="Delete account"
            description="Permanently deletes your account, documents, and all derived data."
          >
            <Button variant="outline" size="md" className="text-[var(--color-coral-ink)] border-[color-mix(in_oklch,var(--color-coral)_30%,var(--border))]">
              Delete my account
            </Button>
          </Card>

          <p className="text-[11.5px] leading-relaxed text-[var(--faint)] max-w-2xl">
            Clausly is a contract organisation tool, not a law firm. By using Clausly you agree to our{" "}
            <Link href="#" className="underline">Terms</Link> and{" "}
            <Link href="#" className="underline">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </PageBody>
  );
}

function Card({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <SectionHeader title={title} description={description} />
      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 divide-y divide-[var(--border)] [&>*]:py-4 first:[&>*]:pt-0 last:[&>*]:pb-0">
        {children}
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[11.5px] font-mono uppercase tracking-[0.14em] text-[var(--faint)]">
          {label}
        </p>
        <p className="mt-1.5 text-[14px] inline-flex items-center gap-2">
          {Icon && <Icon className="size-3.5 text-[var(--muted)]" />}
          {value}
        </p>
      </div>
      <Button variant="ghost" size="sm">Edit</Button>
    </div>
  );
}

function Toggle({
  label,
  sub,
  defaultOn,
}: {
  label: string;
  sub?: string;
  defaultOn?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[14px] font-medium">{label}</p>
        {sub && <p className="text-[12px] text-[var(--muted)] mt-0.5">{sub}</p>}
      </div>
      <span
        aria-hidden
        className={`relative inline-flex h-[22px] w-[38px] shrink-0 rounded-full border transition-colors ${
          defaultOn
            ? "bg-[var(--accent)] border-[color-mix(in_oklch,var(--accent)_45%,transparent)]"
            : "bg-[var(--surface-2)] border-[var(--border)]"
        }`}
      >
        <span
          className={`absolute top-[2px] size-[16px] rounded-full bg-white shadow-[0_1px_3px_oklch(0%_0_0/0.2)] transition-transform ${
            defaultOn ? "translate-x-[18px]" : "translate-x-[2px]"
          }`}
        />
      </span>
    </div>
  );
}
