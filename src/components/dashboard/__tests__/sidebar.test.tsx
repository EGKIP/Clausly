import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "../sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

describe("Sidebar", () => {
  afterEach(() => cleanup());

  it("shows the upgrade card for free users", () => {
    render(<Sidebar plan="free" />);

    expect(screen.getByText(/unlock unlimited documents/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /upgrade/i })).toHaveAttribute("href", "/dashboard/settings/billing");
  });

  it("hides the upgrade card for Pro users", () => {
    render(<Sidebar plan="pro" />);

    expect(screen.queryByText(/unlock unlimited documents/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /upgrade/i })).not.toBeInTheDocument();
  });
});
