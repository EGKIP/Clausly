import { AuthCard } from "@/components/auth/auth-card";
import { AuthShell } from "@/components/auth/auth-shell";

export default function SignupPage() {
  return (
    <AuthShell
      eyebrow="Start organised"
      title="Your first contract, finally readable."
      quote="Upload once, review carefully, and approve only the reminders you trust."
    >
      <AuthCard mode="signup" next="/dashboard/welcome" />
    </AuthShell>
  );
}
