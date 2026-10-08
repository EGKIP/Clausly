/* Single source of truth for the Clausly mark (512 × 512 design grid).
 * Consumed by <MarkSvg> (static: icons, OG image), <AnimatedMark> (motion) and mirrored by hand in
 * public/brand/*.svg — keep those in sync when this changes (tests/brand check the ring path). */

export const MARK_VIEWBOX = 512;

export const MARK_COLORS = {
  tile: "#181B20",
  gold: "#C8A65A",
  coral: "#D46B5D",
  cream: "#F8F5EE",
  pageTop: "#FFFDF8",
  pageBottom: "#EDE3D0",
  fold: "#D9CBB0",
} as const;

/* Full mark: C-ring around a contract page, a highlighted clause and a reminder dot. */
export const MARK = {
  ring: { d: "M398.5 136.4A186 186 0 1 0 398.5 375.6", width: 30 },
  page: "M178 154H288L334 200V358H178Z",
  fold: "M288 154V200H334Z",
  line1: { d: "M207 214H284", width: 22 },
  line2: { d: "M207 304H264", width: 22 },
  highlight: { d: "M207 259H305", width: 32 },
  dot: { cx: 322, cy: 338, r: 32, ring: 14 },
} as const;

/* Small mark (favicons, ≤ 24px): drops the fold, text lines and dot, thickens what remains. */
export const MARK_SMALL = {
  ring: { d: MARK.ring.d, width: 42 },
  page: MARK.page,
  highlight: { d: "M207 256H305", width: 52 },
} as const;
