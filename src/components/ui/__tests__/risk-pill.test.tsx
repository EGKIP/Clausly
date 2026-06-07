import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RiskPill, type RiskLevel } from "../risk-pill";

const levels: RiskLevel[] = ["Low", "Medium", "High", "Needs Review"];

describe("RiskPill", () => {
  it.each(levels)("renders an accessible label for %s", (level) => {
    render(<RiskPill level={level} />);
    expect(screen.getByText(level + " risk")).toBeInTheDocument();
  });
});
