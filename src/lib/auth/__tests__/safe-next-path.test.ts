import { describe, expect, it } from "vitest";
import { safeNextPath } from "../safe-next-path";

describe("safeNextPath", () => {
  it("allows a same-origin path", () => {
    expect(safeNextPath("/dashboard/documents")).toBe("/dashboard/documents");
  });

  it("falls back to /dashboard when next is missing", () => {
    expect(safeNextPath(null)).toBe("/dashboard");
    expect(safeNextPath(undefined)).toBe("/dashboard");
    expect(safeNextPath("")).toBe("/dashboard");
  });

  it("falls back to /dashboard for an absolute external URL", () => {
    expect(safeNextPath("https://evil.test")).toBe("/dashboard");
    expect(safeNextPath("http://evil.test/phish")).toBe("/dashboard");
  });

  it("falls back to /dashboard for a protocol-relative URL", () => {
    // Browsers treat "//evil.test" as "https://evil.test" — this is the
    // classic open-redirect bypass for a naive `startsWith("/")` check.
    expect(safeNextPath("//evil.test")).toBe("/dashboard");
    expect(safeNextPath("//evil.test/phish")).toBe("/dashboard");
  });
});
