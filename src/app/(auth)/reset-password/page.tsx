import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordCard } from "@/components/auth/reset-password-card";

export default function ResetPasswordPage() {
  return (
    <AuthShell
      eyebrow="Secure recovery"
      title="One more step."
      quote="A reset link gets you back in without changing how your files are protected."
    >
      <ResetPasswordCard />
    </AuthShell>
  );
}
