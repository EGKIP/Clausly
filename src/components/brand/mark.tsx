import { MARK, MARK_COLORS as C, MARK_SMALL, MARK_VIEWBOX } from "./mark-geometry";

type MarkSvgProps = {
  /** Navy rounded-square background (favicons, app icons, OG). Without it the mark floats on the page. */
  tile?: boolean;
  /** Simplified geometry for ≤ 24px. */
  small?: boolean;
  /** "fixed" uses brand colors (safe in ImageResponse); "adaptive" follows the page's light/dark tokens. */
  theme?: "fixed" | "adaptive";
  size?: number | string;
  className?: string;
  /** Gradient id prefix; only change if two different marks share a page. */
  idPrefix?: string;
};

/* Static, server-safe mark. No hooks or CSS-only features, so ImageResponse (satori) can render it. */
export function MarkSvg({
  tile = false,
  small = false,
  theme = "fixed",
  size,
  className,
  idPrefix = "clm",
}: MarkSvgProps) {
  const adaptive = theme === "adaptive" && !tile;
  const ring = small ? MARK_SMALL.ring : MARK.ring;
  const hl = small ? MARK_SMALL.highlight : MARK.highlight;
  const pageFill = adaptive ? "var(--foreground)" : `url(#${idPrefix}-page)`;
  const inkColor = adaptive ? "var(--background)" : C.tile;

  return (
    <svg
      viewBox={`0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}`}
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id={`${idPrefix}-ring`} x1="110" y1="96" x2="404" y2="420" gradientUnits="userSpaceOnUse">
          <stop stopColor={C.gold} />
          <stop offset="1" stopColor={C.coral} />
        </linearGradient>
        <linearGradient id={`${idPrefix}-page`} x1="178" y1="154" x2="334" y2="358" gradientUnits="userSpaceOnUse">
          <stop stopColor={C.pageTop} />
          <stop offset="1" stopColor={C.pageBottom} />
        </linearGradient>
      </defs>
      {tile && <rect width={MARK_VIEWBOX} height={MARK_VIEWBOX} rx="112" fill={C.tile} />}
      <path d={ring.d} stroke={`url(#${idPrefix}-ring)`} strokeWidth={ring.width} strokeLinecap="round" />
      <path d={MARK.page} fill={pageFill} />
      {!small && <path d={MARK.fold} fill={adaptive ? inkColor : C.fold} fillOpacity={adaptive ? 0.28 : 1} />}
      {/* No fragments in here: ImageResponse (satori) cannot serialize them inside an <svg>. */}
      {!small && <path d={MARK.line1.d} stroke={inkColor} strokeWidth={MARK.line1.width} strokeLinecap="round" />}
      {!small && <path d={MARK.line2.d} stroke={inkColor} strokeWidth={MARK.line2.width} strokeLinecap="round" />}
      <path d={hl.d} stroke={C.gold} strokeWidth={hl.width} strokeLinecap="round" />
      {!small && (
        <circle
          cx={MARK.dot.cx}
          cy={MARK.dot.cy}
          r={MARK.dot.r}
          fill={C.coral}
          stroke={adaptive ? "var(--background)" : C.cream}
          strokeWidth={MARK.dot.ring}
        />
      )}
    </svg>
  );
}
