import type { Metadata } from "next";
import { Container, Headline } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Email preferences · Clausly",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function UnsubscribedPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const status = first(params.status);
  const list = first(params.type) === "weekly_digest" ? "weekly digest emails" : "email reminders";

  const content =
    status === "done"
      ? {
          title: "You're unsubscribed",
          body: `You will no longer receive ${list} from Clausly. You can turn them back on any time in Settings.`,
        }
      : status === "invalid"
        ? {
            title: "This link is no longer valid",
            body: "The unsubscribe link has expired or was already replaced. Sign in and change your email preferences in Settings instead.",
          }
        : {
            title: "We couldn't update your preferences",
            body: "Something went wrong on our side. Please try the link again in a few minutes, or change your email preferences in Settings.",
          };

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <Container className="py-20 md:py-28">
        <div className="mx-auto max-w-[560px] text-center">
          <Headline level={3}>{content.title}</Headline>
          <p className="mt-5 text-[15.5px] leading-relaxed text-[var(--muted)]">{content.body}</p>
          <div className="mt-8 flex justify-center">
            <Button href="/dashboard/settings" variant="primary">
              Open Settings
            </Button>
          </div>
        </div>
      </Container>
    </main>
  );
}
