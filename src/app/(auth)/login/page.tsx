import { AuthCard } from "@/components/auth/auth-card";
import { AuthShell } from "@/components/auth/auth-shell";
import { safeNextPath } from "@/lib/auth/safe-next-path";

type PageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const next = safeNextPath(params.next);

  return (
    <AuthShell
      eyebrow="Clausly workspace"
      title="Welcome back."
      quote="The calm way to keep contracts, clauses, and reminders in one place."
    >
      <AuthCard mode="login" next={next} />
    </AuthShell>
  );
}
