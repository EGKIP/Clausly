"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, Link2, Loader2, Share2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import type { PlanName } from "@/lib/billing/limits";
import { cn } from "@/lib/utils";

type Share = {
  id: string;
  token: string;
  expiresAt: string | null;
  revokedAt: string | null;
  viewCount: number;
  createdAt: string;
};

type CreatedShare = {
  id: string;
  token: string;
  url: string;
  expiresAt: string | null;
};

const expiryOptions = [
  { label: "Never", value: "never" },
  { label: "7 days", value: "7" },
  { label: "30 days", value: "30" },
  { label: "90 days", value: "90" },
] as const;

export function ShareDialog({
  documentId,
  plan,
}: {
  documentId: string;
  plan: PlanName;
}) {
  const [open, setOpen] = React.useState(false);
  const [shares, setShares] = React.useState<Share[]>([]);
  const [created, setCreated] = React.useState<CreatedShare | null>(null);
  const [expiresInDays, setExpiresInDays] = React.useState<(typeof expiryOptions)[number]["value"]>("7");
  const [loading, setLoading] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [revokingId, setRevokingId] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || plan !== "pro") return;
    let cancelled = false;

    async function loadShares() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}/shares`);
        if (!response.ok) {
          const payload = await response.json().catch(() => ({ error: "Could not load share links." }));
          throw new Error(payload.error ?? "Could not load share links.");
        }
        const payload = (await response.json()) as { shares?: Share[] };
        if (!cancelled) setShares(payload.shares ?? []);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load share links.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadShares();
    return () => {
      cancelled = true;
    };
  }, [documentId, open, plan]);

  async function createLink() {
    setCreating(true);
    setError(null);
    setCopied(false);
    try {
      const body = expiresInDays === "never" ? {} : { expiresInDays: Number(expiresInDays) };
      const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({ error: "Could not create share link." }));
      if (!response.ok) throw new Error(payload.error ?? "Could not create share link.");
      const next = payload as CreatedShare;
      setCreated(next);
      setShares((current) => [{
        id: next.id,
        token: next.token,
        expiresAt: next.expiresAt,
        revokedAt: null,
        viewCount: 0,
        createdAt: new Date().toISOString(),
      }, ...current]);
      toast.success("Share link created.");
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Could not create share link.";
      setError(message);
      toast.error(message);
    } finally {
      setCreating(false);
    }
  }

  async function copyLink() {
    if (!created?.url) return;
    await navigator.clipboard?.writeText(created.url);
    setCopied(true);
    toast.success("Share link copied.");
  }

  async function revokeShare(shareId: string) {
    setRevokingId(shareId);
    setError(null);
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}/shares/${encodeURIComponent(shareId)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Could not revoke share link." }));
        throw new Error(payload.error ?? "Could not revoke share link.");
      }
      const revokedAt = new Date().toISOString();
      setShares((current) => current.map((share) => share.id === shareId ? { ...share, revokedAt } : share));
      toast.success("Share link revoked.");
    } catch (revokeError) {
      const message = revokeError instanceof Error ? revokeError.message : "Could not revoke share link.";
      setError(message);
      toast.error(message);
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        aria-label="Share document"
        onClick={() => setOpen((value) => !value)}
      >
        <Share2 className="size-3.5" /> Share
      </Button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-40 w-[min(92vw,380px)] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-float)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">Read-only digest</p>
              <h2 className="mt-1 font-serif text-[22px] leading-none">Share contract</h2>
            </div>
            <button
              type="button"
              aria-label="Close share dialog"
              onClick={() => setOpen(false)}
              className="inline-flex size-8 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] hover:bg-[var(--surface-2)]"
            >
              <X className="size-4" />
            </button>
          </div>

          {plan !== "pro" ? (
            <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-4">
              <span className="inline-flex size-9 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--accent-soft)] text-[var(--accent-ink)]">
                <Sparkles className="size-4" />
              </span>
              <h3 className="mt-3 font-medium">Share links are a Pro feature.</h3>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                Upgrade to share a read-only digest without exposing the original contract text.
              </p>
              <Button href="/upgrade" variant="accent" size="sm" className="mt-4">
                Upgrade to Pro
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="rounded-[var(--radius-md)] border border-[var(--border)] p-3">
                <label className="block text-[12px] font-medium text-[var(--muted)]" htmlFor="share-expiry">
                  Link expiry
                </label>
                <div className="mt-2 flex gap-2">
                  <select
                    id="share-expiry"
                    value={expiresInDays}
                    onChange={(event) => setExpiresInDays(event.target.value as typeof expiresInDays)}
                    className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                  >
                    {expiryOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <Button variant="primary" size="sm" onClick={() => void createLink()} disabled={creating}>
                    {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />}
                    Create
                  </Button>
                </div>
              </div>

              {created && (
                <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-3">
                  <p className="text-[12px] font-medium text-[var(--muted)]">New share link</p>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      readOnly
                      value={created.url}
                      className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs"
                    />
                    <Button variant="outline" size="sm" onClick={() => void copyLink()} aria-label="Copy share link">
                      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    </Button>
                  </div>
                </div>
              )}

              {error && (
                <p className="rounded-[var(--radius-sm)] bg-[var(--color-coral-soft)] px-3 py-2 text-sm text-[var(--color-coral-ink)]">
                  {error}
                </p>
              )}

              <div className="space-y-2">
                <h3 className="text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">Existing links</h3>
                {loading ? (
                  <div className="rounded-[var(--radius-sm)] border border-[var(--border)] p-3 text-sm text-[var(--muted)]">
                    Loading share links...
                  </div>
                ) : shares.length === 0 ? (
                  <div className="rounded-[var(--radius-sm)] border border-[var(--border)] p-3 text-sm text-[var(--muted)]">
                    No share links yet.
                  </div>
                ) : (
                  <div className="max-h-64 space-y-2 overflow-auto pr-1">
                    {shares.map((share) => (
                      <ShareRow
                        key={share.id}
                        share={share}
                        busy={revokingId === share.id}
                        onRevoke={() => void revokeShare(share.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ShareRow({
  share,
  busy,
  onRevoke,
}: {
  share: Share;
  busy: boolean;
  onRevoke: () => void;
}) {
  const status = shareStatus(share);
  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--border)] p-3">
      <div className="flex items-center justify-between gap-2">
        <Badge tone={status === "active" ? "iris" : status === "expired" ? "ember" : "outline"}>
          {status}
        </Badge>
        <span className="text-[11.5px] text-[var(--muted)]">{share.viewCount} views</span>
      </div>
      <p className="mt-2 truncate font-mono text-[11px] text-[var(--muted)]">{share.token}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-[11px] text-[var(--muted)]">
          {share.expiresAt ? `Expires ${formatDate(share.expiresAt)}` : "Never expires"}
        </span>
        {status === "active" ? (
          <button
            type="button"
            onClick={onRevoke}
            disabled={busy}
            className={cn(
              "text-[12px] font-medium text-[var(--color-coral-ink)] hover:underline",
              busy && "cursor-wait opacity-60"
            )}
          >
            {busy ? "Revoking..." : "Revoke"}
          </button>
        ) : (
          <Link href="/dashboard/settings/activity" className="inline-flex items-center gap-1 text-[12px] text-[var(--muted)]">
            <ExternalLink className="size-3" /> View activity
          </Link>
        )}
      </div>
    </div>
  );
}

function shareStatus(share: Share) {
  if (share.revokedAt) return "revoked";
  if (share.expiresAt && new Date(share.expiresAt).getTime() <= Date.now()) return "expired";
  return "active";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}
