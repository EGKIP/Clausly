/**
 * Sanitizes a user-supplied "next" redirect target so it can only ever point
 * back into this app. `next.startsWith("/")` alone is not enough — paths like
 * `//evil.com` or `/\evil.com` are still same-origin-relative by that check,
 * but browsers (and `new URL`) resolve them to a different host.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next) return fallback;

  let resolved: URL;
  try {
    resolved = new URL(next, "http://internal.invalid");
  } catch {
    return fallback;
  }

  if (resolved.origin !== "http://internal.invalid") return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}
