"use client";

import * as React from "react";
import Link from "next/link";
import { Mail, Lock, UserRound, Chrome, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Mode = "login" | "signup" | "forgot";

export function AuthCard({ mode, next = "/dashboard" }: { mode: Mode; next?: string }) {
  const [status, setStatus] = React.useState<"idle" | "loading" | "sent">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [magicLink, setMagicLink] = React.useState(false);

  const isLogin = mode === "login";
  const isSignup = mode === "signup";
  const isForgot = mode === "forgot";

  async function handlePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus("loading");

    try {
      const supabase = createClient();
      const form = new FormData(event.currentTarget);
      const email = String(form.get("email") ?? "");
      const password = String(form.get("password") ?? "");
      const fullName = String(form.get("fullName") ?? "");

      if (isLogin && magicLink) {
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (otpError) throw otpError;
        setStatus("sent");
        return;
      }

      if (isForgot) {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login`,
        });
        if (resetError) throw resetError;
        setStatus("sent");
        return;
      }

      if (isSignup) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard/welcome`,
          },
        });
        if (signUpError) throw signUpError;
        window.location.href = "/dashboard/welcome";
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;
      window.location.href = next;
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Something went wrong.");
      setStatus("idle");
    }
  }

  async function handleGoogle() {
    setError(null);
    setStatus("loading");
    try {
      const supabase = createClient();
      const target = isSignup ? "/dashboard/welcome" : next;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(target)}`,
        },
      });
      if (oauthError) throw oauthError;
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Unable to start Google sign-in.");
      setStatus("idle");
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-7 shadow-[var(--shadow-card)]">
        <div className="inline-flex size-10 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)]">
          <Mail className="size-4 text-[var(--accent)]" />
        </div>
        <h2 className="mt-5 font-serif text-[32px] leading-none tracking-[-0.015em]">
          Check your inbox.
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--muted)]">
          We sent a secure link to the email address you entered. Keep this tab open
          or return when you&apos;re ready.
        </p>
        <Button variant="secondary" size="md" href="/login" className="mt-6">
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)] sm:p-7">
      <div>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--faint)]">
          {isLogin ? "Sign in" : isSignup ? "Create workspace" : "Password reset"}
        </p>
        <h2 className="mt-3 font-serif text-[34px] leading-none tracking-[-0.015em]">
          {isLogin ? "Welcome back." : isSignup ? "Start with one contract." : "Reset your password."}
        </h2>
        <p className="mt-3 text-[13.5px] leading-relaxed text-[var(--muted)]">
          {isLogin && "Use your email, Google account, or a one-time magic link."}
          {isSignup && "Create a secure Clausly account for your document workspace."}
          {isForgot && "Enter your email and we will send a secure reset link."}
        </p>
      </div>

      {!isForgot && (
        <>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="mt-6 w-full"
            onClick={handleGoogle}
            disabled={status === "loading"}
          >
            <Chrome className="size-4" /> Continue with Google
          </Button>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-[var(--border)]" />
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--faint)]">
              or
            </span>
            <span className="h-px flex-1 bg-[var(--border)]" />
          </div>
        </>
      )}

      <form onSubmit={handlePassword} className="space-y-3.5">
        {isSignup && (
          <Field
            icon={UserRound}
            label="Full name"
            name="fullName"
            autoComplete="name"
            required
          />
        )}
        <Field
          icon={Mail}
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
        {!isForgot && !magicLink && (
          <>
            <Field
              icon={Lock}
              label="Password"
              name="password"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              minLength={8}
              required
            />
            {isSignup && (
              <p className="text-[11.5px] text-[var(--faint)]">
                Use at least 8 characters. A longer passphrase is better.
              </p>
            )}
          </>
        )}

        {error && (
          <p className="rounded-[var(--radius-sm)] border border-[color-mix(in_oklch,var(--color-coral)_28%,var(--border))] bg-[var(--color-coral-soft)] px-3 py-2 text-[12.5px] text-[var(--color-coral-ink)]">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={status === "loading"}>
          {isLogin && !magicLink && "Sign in"}
          {isLogin && magicLink && "Send magic link"}
          {isSignup && "Create account"}
          {isForgot && "Send reset email"}
        </Button>
      </form>

      {isLogin && (
        <button
          type="button"
          onClick={() => setMagicLink((value) => !value)}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-2 text-[13px] text-[var(--accent-ink)] hover:bg-[var(--surface-2)]"
        >
          <Sparkles className="size-3.5" />
          {magicLink ? "Use password instead" : "Use a magic link instead"}
        </button>
      )}

      <div className="mt-6 border-t border-[var(--border)] pt-5 text-center text-[13px] text-[var(--muted)]">
        {isLogin && (
          <>
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-medium text-[var(--accent-ink)] hover:underline">
              Sign up
            </Link>
            <span className="mx-2 text-[var(--faint)]">·</span>
            <Link href="/forgot-password" className="font-medium text-[var(--accent-ink)] hover:underline">
              Forgot password?
            </Link>
          </>
        )}
        {isSignup && (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-[var(--accent-ink)] hover:underline">
              Sign in
            </Link>
          </>
        )}
        {isForgot && (
          <>
            Remembered it?{" "}
            <Link href="/login" className="font-medium text-[var(--accent-ink)] hover:underline">
              Sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[12.5px] font-medium text-[var(--foreground)]">
        {label}
      </span>
      <span className="relative block">
        <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--faint)]" />
        <input
          {...props}
          className="h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--background)] pl-9 pr-3 text-[14px] outline-none transition-colors placeholder:text-[var(--faint)] focus:border-[var(--border-strong)]"
        />
      </span>
    </label>
  );
}
