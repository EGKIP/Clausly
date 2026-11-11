import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Logo, Logomark } from "../logo";
import { MarkSvg } from "../mark";
import { MARK, MARK_SMALL } from "../mark-geometry";

const publicSvg = (name: string) =>
  readFileSync(path.resolve(__dirname, "../../../../public/brand", name), "utf8");

describe("Clausly mark", () => {
  it("renders the full mark with ring, page, highlight and reminder dot", () => {
    const { container } = render(<MarkSvg />);
    expect(container.querySelector(`path[d="${MARK.ring.d}"]`)).not.toBeNull();
    expect(container.querySelector(`path[d="${MARK.page}"]`)).not.toBeNull();
    expect(container.querySelector("circle")).not.toBeNull();
  });

  it("drops the fold, text lines and dot in the small variant", () => {
    const { container } = render(<MarkSvg small tile />);
    expect(container.querySelector("circle")).toBeNull();
    expect(container.querySelector(`path[d="${MARK.fold}"]`)).toBeNull();
    expect(container.querySelector(`path[d="${MARK_SMALL.highlight.d}"]`)).not.toBeNull();
  });

  it("is hidden from assistive tech and the link carries the accessible name", () => {
    const { container, getByRole } = render(<Logo />);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(getByRole("link", { name: "Clausly home" })).toBeInTheDocument();
  });

  it.each(["draw", "loop"] as const)("renders the %s motion variant", (motion) => {
    const { container } = render(<Logomark motion={motion} />);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.querySelector(`path[d="${MARK.ring.d}"]`)).not.toBeNull();
  });

  it("gives every in-app mark its own gradient ids so a hidden copy can't blank a visible one", () => {
    const { container } = render(
      <>
        <div style={{ display: "none" }}>
          <Logo />
        </div>
        <Logo />
        <Logomark motion="loop" />
        <Logomark motion="draw" />
      </>,
    );
    const ids = [...container.querySelectorAll("linearGradient")].map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Each ring must reference a gradient defined inside its own <svg>.
    for (const svg of container.querySelectorAll("svg")) {
      const ref = svg.querySelector(`path[d="${MARK.ring.d}"]`)?.getAttribute("stroke");
      const id = ref?.match(/^url\(#(.+)\)$/)?.[1];
      expect(id).toBeTruthy();
      expect(svg.querySelector(`linearGradient[id="${id}"]`)).not.toBeNull();
    }
  });

  it("keeps the shipped SVG files in sync with the geometry module", () => {
    for (const file of ["clausly-mark.svg", "clausly-favicon.svg"]) {
      expect(publicSvg(file)).toContain(MARK.ring.d);
      expect(publicSvg(file)).toContain(MARK.page);
    }
    expect(publicSvg("clausly-mark.svg")).toContain(MARK.fold);
    expect(publicSvg("clausly-favicon.svg")).toContain(MARK_SMALL.highlight.d);
  });
});
