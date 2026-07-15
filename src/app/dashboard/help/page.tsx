import {
  BellRing,
  BookOpen,
  FileQuestion,
  FileText,
  Keyboard,
  Mail,
  Search,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/primitives";
import { PageBody, PageHeader, SectionHeader } from "@/components/dashboard/page-header";

const shortcuts = [
  { keys: "⌘ K", label: "Open command palette" },
  { keys: "⌘ U", label: "Upload a contract" },
  { keys: "Esc", label: "Close dialogs and menus" },
];

const helpTopics = [
  {
    icon: FileText,
    title: "Documents",
    description: "Upload PDFs, review extracted summaries, and keep each contract profile organized.",
    href: "/dashboard/documents",
  },
  {
    icon: BookOpen,
    title: "Clauses",
    description: "Search renewal, payment, privacy, termination, and risk language across the portfolio.",
    href: "/dashboard/clauses",
  },
  {
    icon: BellRing,
    title: "Reminders",
    description: "Approve suggested reminders before Clausly sends anything on your behalf.",
    href: "/dashboard/reminders",
  },
  {
    icon: Sparkles,
    title: "Insights",
    description: "Use Pro insights for weekly portfolio-level summaries, deadlines, and flagged contracts.",
    href: "/dashboard/insights",
  },
];

export default function DashboardHelpPage() {
  return (
    <PageBody className="max-w-[1080px]">
      <PageHeader
        eyebrow="Support"
        title="Help & shortcuts"
        description="A quick reference for moving around Clausly and finding the right workspace surface."
        actions={
          <Button href="mailto:support@clausly.app" variant="outline" size="md" className="min-h-11 w-full sm:w-auto">
            <Mail className="size-3.5" />
            Contact support
          </Button>
        }
      />

      <div className="mt-10 grid gap-8">
        <section>
          <SectionHeader
            title="Keyboard shortcuts"
            description="The small set worth remembering while reviewing contracts."
          />
          <div className="grid gap-3 sm:grid-cols-3">
            {shortcuts.map((shortcut) => (
              <Card key={shortcut.keys} className="p-4">
                <div className="flex items-center gap-3">
                  <Keyboard className="size-4 text-[var(--muted)]" />
                  <kbd className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 font-mono text-[11px] text-[var(--foreground)]">
                    {shortcut.keys}
                  </kbd>
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-[var(--muted)]">
                  {shortcut.label}
                </p>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <SectionHeader
            title="Where to go"
            description="Each area has one job, so the workspace stays readable."
          />
          <div className="grid gap-4 md:grid-cols-2">
            {helpTopics.map(({ icon: Icon, title, description, href }) => (
              <Card key={title} className="p-5">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)]">
                    <Icon className="size-4 text-[var(--accent-ink)]" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[14px] font-medium">{title}</h2>
                      {title === "Insights" && <Badge tone="clause">Pro</Badge>}
                    </div>
                    <p className="mt-2 text-[13px] leading-relaxed text-[var(--muted)]">
                      {description}
                    </p>
                    <Button href={href} variant="ghost" size="sm" className="mt-4 -ml-2">
                      Open {title.toLowerCase()}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <SectionHeader title="Still stuck?" />
          <Card className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <FileQuestion className="size-4 text-[var(--muted)]" />
                  <p className="text-[14px] font-medium">Send us the rough edge.</p>
                </div>
                <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[var(--muted)]">
                  Include the document type, what you clicked, and any error text. Please do not email full
                  contracts unless support specifically asks for them.
                </p>
              </div>
              <Button href="mailto:support@clausly.app" variant="primary" size="md" className="min-h-11 w-full sm:w-auto">
                <Search className="size-3.5" />
                Email support
              </Button>
            </div>
          </Card>
        </section>
      </div>
    </PageBody>
  );
}
