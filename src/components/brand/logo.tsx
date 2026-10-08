import Link from "next/link";
import { cn } from "@/lib/utils";
import { AnimatedMark, type MarkMotion } from "./animated-mark";
import { MarkSvg } from "./mark";

/* The Clausly logomark: a C-ring around a contract page, a highlighted clause and a reminder dot.
 * Geometry lives in ./mark-geometry.ts. This variant floats on the page and follows light/dark tokens;
 * use <MarkSvg tile /> where a fixed navy tile is needed (icons, OG image).
 *
 * `motion` is opt-in and reserved for moments that earn it: "draw" for first-run reveals,
 * "loop" for working states. Navigation and chrome stay static. */
export function Logomark({ className, motion }: { className?: string; motion?: MarkMotion }) {
  const cls = cn("size-8", className);
  if (motion) return <AnimatedMark mode={motion} className={cls} />;
  return <MarkSvg theme="adaptive" className={cls} />;
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
