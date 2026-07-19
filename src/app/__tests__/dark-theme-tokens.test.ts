import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard against the dark-mode regression where risk cards and pills rendered
 * near-white "soft" backgrounds under near-white foreground text: every
 * status color family used on colored surfaces must be re-mapped inside the
 * `.dark` block, not just the accent family.
 */
describe("dark theme status tokens", () => {
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
  const darkBlock = css.slice(css.indexOf(".dark {"), css.indexOf("@theme inline"));

  it.each([
    "--color-clause-soft",
    "--color-clause-ink",
    "--color-ember-soft",
    "--color-ember-ink",
    "--color-coral-soft",
    "--color-coral-ink",
    "--color-iris-soft",
  ])("re-maps %s for dark mode", (token) => {
    expect(darkBlock).toContain(`${token}:`);
  });
});
