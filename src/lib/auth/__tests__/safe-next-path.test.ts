import { describe, expect, it } from "vitest";
import { safeNextPath } from "../safe-next-path";

describe("safeNextPath", () => {
  it("passes through a same-origin path", () => {
    expect(safeNextPath("/dashboard/documents/123")).toBe("/dashboard/documents/123");
    expect(safeNextPath("/valid?x=1")).toBe("/valid?x=1");
  });

  it("falls back for a missing value", () => {
    expect(safeNextPath(null)).toBe("/dashboard");
    expect(safeNextPath(undefined)).toBe("/dashboard");
    expect(safeNextPath("")).toBe("/dashboard");
  });

  it("falls back for a protocol-relative URL", () => {
    expect(safeNextPath("//evil.test")).toBe("/dashboard");
  });

  it("falls back for a backslash bypass that browsers resolve to another host", () => {
    expect(safeNextPath("/\\evil.test")).toBe("/dashboard");
    expect(safeNextPath("/\\/evil.test")).toBe("/dashboard");
  });

  it("falls back for an absolute URL to another origin", () => {
    expect(safeNextPath("https://evil.test")).toBe("/dashboard");
    expect(safeNextPath("http://evil.test/dashboard")).toBe("/dashboard");
  });

  it("falls back for a non-http scheme", () => {
    expect(safeNextPath("javascript:alert(1)")).toBe("/dashboard");
  });

  it("honors a custom fallback", () => {
    expect(safeNextPath(null, "/login")).toBe("/login");
    expect(safeNextPath("//evil.test", "/login")).toBe("/login");
  });
});
