"use client";

import * as React from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type Status = "checking" | "ready" | "no-session" | "saved";

export function ResetPasswordCard() {
  const [status, setStatus] = React.useState<Status>("checking");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setStatus(data.session ? "ready" : "no-session");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setStatus("saved");
      window.location.href = "/dashboard";
    } catch (updateErr) {
      setError(updateErr instanceof Error ? updateErr.message : "Could not update your password.");
      setSaving(false);
    }
  }

  if (status === "checking") {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-7 shadow-[var(--shadow-card)]">
        <p className="text-[14px] text-[var(--muted)]">Checking your reset link…</p>
      </div>
    );
  }

  if (status === "no-session") {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-7 shadow-[var(--shadow-card)]">
        <h2 className="font-serif text-[28px] leading-none tracking-[-0.015em]">Link expired.</h2>
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--muted)]">
          This reset link is invalid or has expired. Request a new one to continue.
        </p>
        <Button variant="primary" size="lg" href="/forgot-password" className="mt-6 w-full">
          Send a new reset link
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)] sm:p-7">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--faint)]">
        Password reset
      </p>
      <h2 className="mt-3 font-serif text-[34px] leading-none tracking-[-0.015em]">
        Choose a new password.
      </h2>
      <p className="mt-3 text-[13.5px] leading-relaxed text-[var(--muted)]">
        Use at least 8 characters. You will stay signed in on this device.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3.5">
        <PasswordField label="New password" name="password" autoComplete="new-password" />
        <PasswordField label="Confirm password" name="confirmPassword" autoComplete="new-password" />

        {error && (
          <p className="rounded-[var(--radius-sm)] border border-[color-mix(in_oklch,var(--color-coral)_28%,var(--border))] bg-[var(--color-coral-soft)] px-3 py-2 text-[12.5px] text-[var(--color-coral-ink)]">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={saving}>
          {saving ? "Saving…" : "Save new password"}
        </Button>
      </form>
    </div>
  );
}

function PasswordField({
  label,
  name,
  autoComplete,
}: {
  label: string;
  name: string;
  autoComplete: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-medium text-[var(--foreground)]">{label}</span>
      <span className="relative block">
        <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--faint)]" />
        <input
          name={name}
          type="password"
          autoComplete={autoComplete}
          minLength={8}
          required
          className="h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--background)] pl-9 pr-3 text-[14px] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--faint)] focus:border-[var(--border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface)]"
        />
      </span>
    </label>
  );
}
