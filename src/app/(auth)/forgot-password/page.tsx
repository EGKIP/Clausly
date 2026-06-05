import { AuthCard } from "@/components/auth/auth-card";
import { AuthShell } from "@/components/auth/auth-shell";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Secure recovery"
      title="Get back to your documents."
      quote="A reset link gets you back in without changing how your files are protected."
    >
      <AuthCard mode="forgot" />
    </AuthShell>
  );
}
