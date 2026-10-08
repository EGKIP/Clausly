import { AuthCard } from "@/components/auth/auth-card";
import { AuthShell } from "@/components/auth/auth-shell";
import { safeNextPath } from "@/lib/auth/safe-next-path";

type PageProps = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  oauth_callback_failed: "Sign-in could not be completed. Please try again.",
};

export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const initialError = params.error ? OAUTH_ERROR_MESSAGES[params.error] ?? "Sign-in could not be completed. Please try again." : undefined;

  return (
    <AuthShell
      eyebrow="Clausly workspace"
      title="Welcome back."
      quote="The calm way to keep contracts, clauses, and reminders in one place."
    >
      <AuthCard mode="login" next={next} initialError={initialError} />
    </AuthShell>
  );
}
