/**
 * Validates a `?next=` redirect target so it can only point at a path on
 * this app. Rejects protocol-relative URLs (`//evil.com`) and anything
 * that isn't a local path, which browsers would otherwise treat as an
 * off-site redirect straight after a real login.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }
  return next;
}
