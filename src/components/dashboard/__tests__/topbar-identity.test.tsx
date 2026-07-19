import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Topbar } from "../topbar";

vi.mock("@/lib/auth/actions", () => ({ signOut: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: { email: "ada.lovelace@clausly.app" } } }),
    },
  }),
}));

const fetchMock = vi.fn();

describe("Topbar user identity", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows the display name in the topbar and the email only inside the dropdown", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ plan: "free", displayName: "Ada Lovelace" }),
    });

    render(<Topbar />);

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.queryByText("ada.lovelace@clausly.app")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { expanded: false }));

    expect(screen.getByText("ada.lovelace@clausly.app")).toBeInTheDocument();
    expect(screen.getByText("Free plan")).toBeInTheDocument();
  });

  it("falls back to the email prefix when no display name exists", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ plan: "free" }),
    });

    render(<Topbar />);

    await waitFor(() => {
      expect(screen.getByText("ada lovelace")).toBeInTheDocument();
    });
    expect(screen.queryByText("ada.lovelace@clausly.app")).not.toBeInTheDocument();
  });
});
