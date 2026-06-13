"use client";

import * as React from "react";
import { Bell, CheckCircle2, Mail, Save } from "lucide-react";
import { Badge, Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { notificationPreferencesSchema } from "@/lib/validation/schemas";
import type { z } from "zod";

export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

export type NotificationPreferencesProfile = {
  displayName: string;
  email: string;
  mockMode: boolean;
  notificationPreferences: NotificationPreferences;
};

type NotificationPreferencesCardProps = {
  profile: NotificationPreferencesProfile;
  onProfileSaved: (profile: NotificationPreferencesProfile) => void;
};

export function NotificationPreferencesCard({
  profile,
  onProfileSaved,
}: NotificationPreferencesCardProps) {
  const initialEmail = profile.notificationPreferences.email;
  const [emailEnabled, setEmailEnabled] = React.useState(initialEmail);
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    setEmailEnabled(profile.notificationPreferences.email);
    setStatus("idle");
    setMessage(null);
  }, [profile.notificationPreferences.email]);

  const changed = emailEnabled !== initialEmail;

  async function savePreferences(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (profile.mockMode || !changed) return;

    setStatus("saving");
    setMessage(null);

    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notification_preferences: { email: emailEnabled } }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Preferences could not be saved." }));
      setStatus("error");
      setMessage(payload.error ?? "Preferences could not be saved.");
      toast.error(payload.error ?? "Preferences could not be saved.");
      return;
    }

    const payload = (await response.json()) as NotificationPreferencesProfile;
    onProfileSaved(payload);
    setStatus("saved");
    setMessage("Notification preferences saved.");
    toast.success("Notification preferences saved.");
  }

  return (
    <Card className="p-6">
      <form onSubmit={savePreferences} className="grid gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 text-[12.5px] font-medium">
              <Mail className="size-3.5 text-[var(--muted)]" />
              Email notifications
            </span>
            <p className="mt-2 max-w-[620px] text-[13.5px] leading-relaxed text-[var(--muted)]">
              Receive reminder emails for approved dates and contract follow-ups.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-label="Email notifications"
            aria-checked={emailEnabled}
            disabled={profile.mockMode || status === "saving"}
            onClick={() => {
              setEmailEnabled((value) => !value);
              setStatus("idle");
              setMessage(null);
            }}
            className={cn(
              "inline-flex h-8 w-14 shrink-0 items-center rounded-full border p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:cursor-not-allowed disabled:opacity-60",
              emailEnabled
                ? "border-[color-mix(in_oklch,var(--accent)_35%,var(--border))] bg-[var(--accent)]"
                : "border-[var(--border)] bg-[var(--surface-2)]"
            )}
          >
            <span
              className={cn(
                "size-6 rounded-full bg-white shadow-[0_1px_3px_oklch(0%_0_0/0.16)] transition-transform",
                emailEnabled ? "translate-x-6" : "translate-x-0"
              )}
            />
          </button>
        </div>

        <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Bell className="size-3.5 text-[var(--muted)]" />
            <span className="text-[12.5px] font-medium">Reminder defaults</span>
            <Badge tone="iris">Coming soon</Badge>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--muted)]">
            Timing defaults for renewals, notice windows, payments, and reviews will live here.
          </p>
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
            disabled={profile.mockMode || status === "saving" || !changed}
          >
            <Save className="size-3.5" />
            {status === "saving" ? "Saving..." : "Save preferences"}
          </Button>
          <span className="text-[12px] text-[var(--faint)]">
            {profile.mockMode
              ? "Mock mode: connect Supabase to edit notification preferences."
              : `Email is currently ${profile.notificationPreferences.email ? "on" : "off"}.`}
          </span>
        </div>
      </form>
    </Card>
  );
}
