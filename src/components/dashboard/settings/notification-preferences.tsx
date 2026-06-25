"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, Loader2, Mail, Newspaper, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge, Card } from "@/components/ui/primitives";
import type { PlanName } from "@/lib/billing/limits";
import { cn } from "@/lib/utils";

type Preferences = {
  email: boolean;
  reminders: boolean;
  weeklyDigest: boolean;
};

type PreferencesResponse = {
  preferences: Preferences;
  plan?: PlanName;
  mockMode?: boolean;
};

const defaults: Preferences = {
  email: true,
  reminders: true,
  weeklyDigest: true,
};

export function NotificationPreferences({
  initialPlan,
}: {
  initialPlan: PlanName;
}) {
  const [preferences, setPreferences] = React.useState<Preferences>(defaults);
  const [plan, setPlan] = React.useState<PlanName>(initialPlan);
  const [loading, setLoading] = React.useState(true);
  const [savingKey, setSavingKey] = React.useState<keyof Preferences | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function loadPreferences() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/settings/notifications");
        if (!response.ok) {
          const payload = await response.json().catch(() => ({ error: "Notification preferences could not be loaded." }));
          throw new Error(payload.error ?? "Notification preferences could not be loaded.");
        }
        const payload = (await response.json()) as PreferencesResponse;
        if (!cancelled) {
          setPreferences(payload.preferences);
          if (payload.plan) setPlan(payload.plan);
        }
      } catch (loadError) {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : "Notification preferences could not be loaded.";
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPreferences();
    return () => {
      cancelled = true;
    };
  }, []);

  async function updatePreference(key: keyof Preferences, value: boolean) {
    const previous = preferences;
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    setSavingKey(key);
    setError(null);

    try {
      const response = await fetch("/api/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      const payload = await response.json().catch(() => ({ error: "Notification preference could not be saved." }));
      if (!response.ok) throw new Error(payload.error ?? "Notification preference could not be saved.");
      const saved = payload as PreferencesResponse;
      setPreferences(saved.preferences);
      if (saved.plan) setPlan(saved.plan);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Notification preference could not be saved.";
      setPreferences(previous);
      setError(message);
      toast.error(message);
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) {
    return (
      <Card className="p-4 sm:p-6">
        <div className="flex items-center gap-3 text-[13px] text-[var(--muted)]">
          <Loader2 className="size-4 animate-spin" />
          Loading notification preferences...
        </div>
      </Card>
    );
  }

  const mutedDependents = !preferences.email;
  const weeklyDisabled = plan === "free" || mutedDependents;

  return (
    <Card className="p-4 sm:p-6">
      <div className="grid gap-4">
        <PreferenceRow
          icon={Mail}
          title="All emails"
          description="Master switch for all Clausly email notifications."
          checked={preferences.email}
          saving={savingKey === "email"}
          onToggle={(checked) => void updatePreference("email", checked)}
        />
        <PreferenceRow
          icon={Bell}
          title="Reminder emails"
          description="Send email when approved deadlines and notice windows approach."
          checked={preferences.reminders}
          saving={savingKey === "reminders"}
          muted={mutedDependents}
          disabled={mutedDependents}
          onToggle={(checked) => void updatePreference("reminders", checked)}
        />
        <PreferenceRow
          icon={Newspaper}
          title="Weekly digest"
          description="Monday portfolio summary for upcoming dates, new uploads, and risks."
          checked={plan === "free" ? false : preferences.weeklyDigest}
          saving={savingKey === "weeklyDigest"}
          muted={weeklyDisabled}
          disabled={weeklyDisabled}
          badge={(
            <Badge tone={plan === "pro" ? "iris" : "outline"}>
              {plan === "pro" ? "Pro" : "Pro only"}
            </Badge>
          )}
          helper={plan === "free" ? (
            <Link href="/dashboard/settings#billing" className="text-[12px] text-[var(--accent-ink)] underline underline-offset-2">
              Upgrade to Pro to enable weekly digest emails.
            </Link>
          ) : null}
          onToggle={(checked) => void updatePreference("weeklyDigest", checked)}
        />

        {error && (
          <p className="rounded-[var(--radius-sm)] border border-[color-mix(in_oklch,var(--color-coral)_28%,var(--border))] bg-[var(--color-coral-soft)] px-3 py-2 text-[12.5px] text-[var(--color-coral-ink)]">
            {error}
          </p>
        )}
      </div>
    </Card>
  );
}

function PreferenceRow({
  icon: Icon,
  title,
  description,
  checked,
  saving,
  disabled,
  muted,
  badge,
  helper,
  onToggle,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  checked: boolean;
  saving: boolean;
  disabled?: boolean;
  muted?: boolean;
  badge?: React.ReactNode;
  helper?: React.ReactNode;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <div className={cn(
      "flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between",
      muted && "bg-[var(--surface-2)] opacity-65"
    )}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex size-8 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--accent-soft)] text-[var(--accent-ink)]">
            <Icon className="size-3.5" />
          </span>
          <p className="text-[13px] font-medium">{title}</p>
          {badge}
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--muted)]">{description}</p>
        {helper && <div className="mt-2">{helper}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-label={title}
        aria-checked={checked}
        disabled={disabled || saving}
        onClick={() => onToggle(!checked)}
        className={cn(
          "inline-flex h-8 w-14 shrink-0 items-center rounded-full border p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:cursor-not-allowed disabled:opacity-60",
          checked
            ? "border-[color-mix(in_oklch,var(--accent)_35%,var(--border))] bg-[var(--accent)]"
            : "border-[var(--border)] bg-[var(--surface-2)]"
        )}
      >
        <span
          className={cn(
            "size-6 rounded-full bg-white shadow-[0_1px_3px_oklch(0%_0_0/0.16)] transition-transform",
            checked ? "translate-x-6" : "translate-x-0"
          )}
        />
        {saving && <Sparkles className="sr-only" />}
      </button>
    </div>
  );
}
