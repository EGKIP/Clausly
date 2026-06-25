import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge, Card, Divider } from "@/components/ui/primitives";
import { Logo } from "@/components/brand/logo";
import { getPublicShareDigest } from "@/lib/db/share-digest";
import {
  createServiceSupabaseClient,
  hasServiceSupabaseEnv,
} from "@/lib/notifications/supabase-service";

type SharePageProps = {
  params: Promise<{ token: string }>;
};

export const metadata: Metadata = {
  title: "Shared Contract Digest | Clausly",
  description: "A read-only Clausly contract digest.",
  openGraph: {
    title: "Shared Contract Digest | Clausly",
    description: "A read-only Clausly contract digest.",
  },
};

export default async function SharePage({ params }: SharePageProps) {
  if (!hasServiceSupabaseEnv()) notFound();

  const { token } = await params;
  const supabase = createServiceSupabaseClient();
  const digest = await getPublicShareDigest(supabase as unknown as Parameters<typeof getPublicShareDigest>[0], token);

  if (!digest) notFound();

  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-5 border-b border-[var(--border)] pb-6 sm:flex-row sm:items-center sm:justify-between">
          <Logo />
          <Badge tone="iris">Read-only digest</Badge>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">Shared contract</p>
            <h1 className="font-serif text-4xl leading-tight text-[var(--ink)] sm:text-5xl">
              {digest.document.title}
            </h1>
            <p className="text-base text-[var(--muted)]">
              {digest.document.party ?? "Counterparty not listed"} · {formatType(digest.document.type)}
            </p>
          </div>

          <Card className="space-y-4 p-5">
            <h2 className="font-serif text-2xl">Summary</h2>
            <p className="leading-7 text-[var(--muted)]">
              {digest.summary ?? "No summary is available for this shared digest."}
            </p>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
          <div className="space-y-4">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">Clauses</p>
              <h2 className="font-serif text-3xl">Plain-English highlights</h2>
            </div>
            <div className="space-y-3">
              {digest.clauses.length === 0 ? (
                <Card className="p-5 text-sm text-[var(--muted)]">No clauses were included in this digest.</Card>
              ) : digest.clauses.map((clause) => (
                <Card key={clause.id} className="space-y-3 p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="font-medium">{clause.title}</h3>
                    <Badge tone={clause.riskLevel === "high" ? "coral" : clause.riskLevel === "medium" ? "ember" : "neutral"}>
                      Page {clause.pageNumber}
                    </Badge>
                  </div>
                  <p className="text-sm leading-6 text-[var(--muted)]">{clause.plainEnglish}</p>
                  {clause.whyItMatters ? (
                    <p className="text-sm leading-6 text-[var(--muted)]">
                      <span className="font-medium text-[var(--ink)]">Why it matters:</span> {clause.whyItMatters}
                    </p>
                  ) : null}
                </Card>
              ))}
            </div>
          </div>

          <aside className="space-y-4">
            <Card className="space-y-4 p-5">
              <h2 className="font-serif text-2xl">Key dates</h2>
              {digest.document.dates.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No key dates were included.</p>
              ) : (
                <div className="space-y-3">
                  {digest.document.dates.map((date) => (
                    <div key={date.id} className="rounded-[var(--radius-sm)] border border-[var(--border)] p-3">
                      <p className="text-sm font-medium">{date.label}</p>
                      <p className="text-sm text-[var(--muted)]">{date.date}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="space-y-4 p-5">
              <h2 className="font-serif text-2xl">Recommended actions</h2>
              {digest.recommendedActions.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No reminder actions were included.</p>
              ) : (
                <div className="space-y-3">
                  {digest.recommendedActions.map((action) => (
                    <div key={action.id} className="rounded-[var(--radius-sm)] border border-[var(--border)] p-3">
                      <p className="text-sm font-medium">{action.title}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{action.description}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">{action.fireOn}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </aside>
        </section>

        <Divider />
        <footer className="pb-6 text-sm leading-6 text-[var(--muted)]">
          This is a shared digest. The full contract is held by the sender. Informational only — not legal advice.
        </footer>
      </div>
    </main>
  );
}

function formatType(type: string) {
  return type.replace(/_/g, " ");
}
