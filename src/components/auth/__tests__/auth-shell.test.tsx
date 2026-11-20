import React from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthShell } from "../auth-shell";

describe("AuthShell", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
  });

  it("never nests a link inside another link", () => {
    const { container } = render(
      <AuthShell eyebrow="Sign in" title="Welcome back" quote="q">
        <a href="/signup">Create an account</a>
      </AuthShell>,
    );
    expect(container.querySelectorAll("a a")).toHaveLength(0);
    expect(container.querySelectorAll('a[aria-label="Clausly home"]').length).toBeGreaterThan(0);
  });
});
