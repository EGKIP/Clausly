"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, LogOut, Mail, Save, ShieldAlert, Sparkles, User } from "lucide-react";
import { PageBody, PageHeader, SectionHeader } from "@/components/dashboard/page-header";
import {
  NotificationPreferencesCard,
  type NotificationPreferences,
} from "@/components/dashboard/settings/notification-preferences-card";
import { Badge, Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import type { PlanName } from "@/lib/billing/limits";

type Profile = {
  displayName: string;
  email: string;
  mockMode: boolean;
  notificationPreferences: NotificationPreferences;
  plan: PlanName;
  usage: {
    documents: {
      current: number;
      limit: number | null;
    };
  };
};

const fallbackProfile: Profile = {
  displayName: "Demo User",
  email: "demo@clausly.app",
  mockMode: true,
  notificationPreferences: { email: true },
  plan: "free",
  usage: { documents: { current: 0, limit: 5 } },
};

export default function SettingsPage() {
  const [profile, setProfile] = React.useState<Profile>(fallbackProfile);
  const [displayName, setDisplayName] = React.useState(fallbackProfile.displayName);
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = React.useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmEmail, setConfirmEmail] = React.useState("");
  const [deleteStatus, setDeleteStatus] = React.useState<"idle" | "deleting" | "error">("idle");
  const [deleteMessage, setDeleteMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      const response = await fetch("/api/profile");
      if (cancelled || !response.ok) return;
      const payload = (await response.json()) as Profile;
      setProfile(payload);
      setDisplayName(payload.displayName);
    }
    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (profile.mockMode) return;

    setStatus("saving");
    setMessage(null);
    const previous = profile;
    const optimistic = { ...profile, displayName };
    setProfile(optimistic);

    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Profile could not be saved." }));
      setProfile(previous);
      setDisplayName(previous.displayName);
      setStatus("error");
      setMessage(payload.error ?? "Profile could not be saved.");
      return;
    }

    const payload = (await response.json()) as Profile;
    setProfile(payload);
    setDisplayName(payload.displayName);
    setStatus("saved");
    setMessage("Profile saved.");
  }

  async function deleteAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (profile.mockMode || confirmEmail !== profile.email) return;

    setDeleteStatus("deleting");
    setDeleteMessage(null);

    const response = await fetch("/api/profile", { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Account could not be deleted." }));
      setDeleteStatus("error");
      setDeleteMessage(payload.error ?? "Account could not be deleted.");
      return;
    }

    window.location.assign("/?account=deleted");
  }

  return (
    <PageBody className="max-w-[1080px]">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="A quiet place for profile details, reminder preferences, and account controls."
      />

      <div className="mt-10 grid gap-8">
        <section>
          <SectionHeader
            title="Profile"
            description="Your display name appears in workspace greetings. Email is managed by your sign-in provider."
          />
          <Card className="p-6">
            <form onSubmit={saveProfile} className="grid gap-5">
              <label className="grid gap-2">
                <span className="inline-flex items-center gap-2 text-[12.5px] font-medium">
                  <User className="size-3.5 text-[var(--muted)]" />
                  Display name
                </span>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  disabled={profile.mockMode}
                  className="h-11 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--background)] px-3 text-[14px] outline-none transition-colors focus:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>

              <div className="grid gap-2">
                <span className="inline-flex items-center gap-2 text-[12.5px] font-medium">
                  <Mail className="size-3.5 text-[var(--muted)]" />
                  Email
                </span>
                <div className="flex h-11 items-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] px-3 text-[14px] text-[var(--muted)]">
                  {profile.email}
                </div>
              </div>

              {message && (
                <p
                  className={
                    status === "error"
                      ? "rounded-[var(--radius-sm)] border border-[color-mix(in_oklch,var(--color-coral)_28%,var(--border))] bg-[var(--color-coral-soft)] px-3 py-2 text-[12.5px] text-[var(--color-coral-ink)]"
                      : "inline-flex items-center gap-1.5 text-[12.5px] text-[var(--accent-ink)]"
                  }
                >
                  {status === "saved" && <CheckCircle2 className="size-3.5" />}
                  {message}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={profile.mockMode || status === "saving" || displayName.trim().length === 0}
                >
                  <Save className="size-3.5" />
                  {status === "saving" ? "Saving..." : "Save profile"}
                </Button>
                {profile.mockMode && (
                  <span className="text-[12px] text-[var(--faint)]">
                    Mock mode: connect Supabase to edit your profile.
                  </span>
                )}
              </div>
            </form>
          </Card>
        </section>

        <section>
          <SectionHeader
            title="Plan"
            description="Your plan sets portfolio limits and unlocks portfolio-level intelligence."
          />
          <Card className="p-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={profile.plan === "pro" ? "iris" : "outline"}>
                    {profile.plan === "pro" && <Sparkles className="size-2.5" />}
                    {profile.plan === "pro" ? "Pro" : "Free"}
                  </Badge>
                  <span className="text-[12.5px] text-[var(--muted)]">
                    Current subscription
                  </span>
                </div>
                <p className="mt-4 text-[14px] font-medium">
                  Documents:{" "}
                  <span className="tabular-nums">
                    {profile.usage.documents.current} / {formatDocumentLimit(profile.usage.documents.limit)}
                  </span>
                </p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--muted)]">
                  Pro unlocks unlimited documents, portfolio insights, and priority processing.
                </p>
              </div>
              {profile.plan === "free" && (
                <Button href="/upgrade" variant="primary" size="md">
                  <Sparkles className="size-3.5" />
                  Upgrade to Pro
                </Button>
              )}
            </div>
          </Card>
        </section>

        <section>
          <SectionHeader
            title="Preferences"
            description="Control notification delivery and default reminder timing."
          />
          <NotificationPreferencesCard
            profile={profile}
            onProfileSaved={(savedProfile) => {
              setProfile((current) => ({ ...current, ...savedProfile }));
            }}
          />
        </section>

        <section>
          <SectionHeader title="Account" description="Session controls for this workspace." />
          <Card className="p-6">
            <form action={signOut}>
              <Button type="submit" variant="secondary" size="md">
                <LogOut className="size-3.5" />
                Sign out
              </Button>
            </form>
          </Card>
        </section>

        <section>
          <SectionHeader
            title="Danger zone"
            description="Sensitive account actions need a deliberate confirmation step."
          />
          <Card className="p-6">
            <Button
              variant="outline"
              size="md"
              className="border-[color-mix(in_oklch,var(--color-coral)_30%,var(--border))] text-[var(--color-coral-ink)]"
              onClick={() => setConfirmOpen(true)}
            >
              <ShieldAlert className="size-3.5" />
              Delete account
            </Button>
          </Card>
        </section>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[oklch(15%_0.02_260/0.45)] p-4 backdrop-blur-sm">
          <form
            onSubmit={deleteAccount}
            className="w-full max-w-[460px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-float)]"
          >
            <div className="inline-flex size-10 items-center justify-center rounded-[var(--radius-sm)] border border-[color-mix(in_oklch,var(--color-coral)_28%,var(--border))] bg-[var(--color-coral-soft)] text-[var(--color-coral-ink)]">
              <AlertTriangle className="size-4" />
            </div>
            <h2 className="mt-4 font-serif text-[24px] leading-tight tracking-[-0.01em]">
              Delete account
            </h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--muted)]">
              This permanently removes your account, saved contracts, clauses, dates,
              reminders, and uploaded files. Type your email to confirm.
            </p>
            <label className="mt-5 grid gap-2">
              <span className="text-[12.5px] font-medium text-[var(--foreground)]">
                Confirm email
              </span>
              <input
                value={confirmEmail}
                onChange={(event) => setConfirmEmail(event.target.value)}
                placeholder={profile.email}
                disabled={profile.mockMode || deleteStatus === "deleting"}
                className="h-11 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--background)] px-3 text-[14px] outline-none transition-colors focus:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
            {deleteMessage && (
              <p className="mt-4 rounded-[var(--radius-sm)] border border-[color-mix(in_oklch,var(--color-coral)_28%,var(--border))] bg-[var(--color-coral-soft)] px-3 py-2 text-[12.5px] text-[var(--color-coral-ink)]">
                {deleteMessage}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmEmail("");
                  setDeleteMessage(null);
                  setDeleteStatus("idle");
                }}
                disabled={deleteStatus === "deleting"}
              >
                Close
              </Button>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="border-[color-mix(in_oklch,var(--color-coral)_42%,var(--border))] text-[var(--color-coral-ink)] hover:bg-[var(--color-coral-soft)]"
                disabled={profile.mockMode || confirmEmail !== profile.email || deleteStatus === "deleting"}
              >
                {deleteStatus === "deleting" ? "Deleting..." : "Delete permanently"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </PageBody>
  );
}

function formatDocumentLimit(limit: number | null) {
  return limit === null ? "Unlimited" : limit;
}
