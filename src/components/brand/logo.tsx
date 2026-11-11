import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { AnimatedMark, type MarkMotion } from "./animated-mark";
import { MarkSvg } from "./mark";

/* The Clausly logomark: a C-ring around a contract page, a highlighted clause and a reminder dot.
 * Geometry lives in ./mark-geometry.ts. This variant floats on the page and follows light/dark tokens;
 * use <MarkSvg tile /> where a fixed navy tile is needed (icons, OG image).
 *
 * `motion` is opt-in and reserved for moments that earn it: "draw" for first-run reveals,
 * "loop" for working states. Navigation and chrome stay static.
 *
 * Each instance gets its own gradient ids. Pages often render two marks (e.g. a desktop panel and a
 * mobile header); with shared ids, url(#…) resolves to the first one, and when that copy is
 * display:none the browser paints the visible ring with no stroke at all. */
export function Logomark({ className, motion }: { className?: string; motion?: MarkMotion }) {
  const idPrefix = `clm${React.useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const cls = cn("size-8", className);
  if (motion) return <AnimatedMark mode={motion} className={cls} idPrefix={idPrefix} />;
  return <MarkSvg theme="adaptive" className={cls} idPrefix={idPrefix} />;
}

export function Logo({
  className,
  showWordmark = true,
  href = "/",
  ariaLabel = "Clausly home",
}: {
  className?: string;
  showWordmark?: boolean;
  href?: string | null;
  ariaLabel?: string;
}) {
  const inner = (
    <>
      <Logomark />
      {showWordmark && (
        <span className="font-serif text-[22px] leading-none tracking-[-0.015em]">
          Clausly
        </span>
      )}
    </>
  );
  const cls = cn("inline-flex items-center gap-2 text-[var(--foreground)]", className);
  if (href === null) return <span className={cls}>{inner}</span>;
  return (
    <Link href={href} className={cls} aria-label={ariaLabel}>
      {inner}
    </Link>
  );
}
