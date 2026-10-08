"use client";

import { motion, useReducedMotion } from "framer-motion";
import { MARK, MARK_COLORS as C, MARK_VIEWBOX } from "./mark-geometry";
import { MarkSvg } from "./mark";

export type MarkMotion = "draw" | "loop";

/* Motion version of the mark. Same geometry as <MarkSvg>; reduced-motion users get the static mark.
 *  - "draw": one-shot reveal (ring draws, page lands, highlight sweeps, dot pops) for first-run moments.
 *  - "loop": ring orbits the page and the dot pulses; a compact progress indicator for "working" states. */
export function AnimatedMark({
  mode,
  size,
  className,
  idPrefix = "cla",
}: {
  mode: MarkMotion;
  size?: number | string;
  className?: string;
  idPrefix?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <MarkSvg theme="adaptive" size={size} className={className} idPrefix={idPrefix} />;

  const ease = [0.165, 0.84, 0.44, 1] as const;
  const draw = (delay: number, duration: number) => ({
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1 },
    transition: { pathLength: { delay, duration, ease }, opacity: { delay, duration: 0.01 } },
  });

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
      </defs>

      {mode === "draw" ? (
        <>
          <motion.path
            d={MARK.ring.d}
            stroke={`url(#${idPrefix}-ring)`}
            strokeWidth={MARK.ring.width}
            strokeLinecap="round"
            {...draw(0, 0.95)}
          />
          <motion.g
            initial={{ opacity: 0, scale: 0.86 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.45, ease }}
          >
            <path d={MARK.page} fill="var(--foreground)" />
            <path d={MARK.fold} fill="var(--background)" fillOpacity={0.28} />
          </motion.g>
          <motion.path d={MARK.line1.d} stroke="var(--background)" strokeWidth={MARK.line1.width} strokeLinecap="round" {...draw(0.8, 0.25)} />
          <motion.path d={MARK.line2.d} stroke="var(--background)" strokeWidth={MARK.line2.width} strokeLinecap="round" {...draw(0.9, 0.25)} />
          <motion.path d={MARK.highlight.d} stroke={C.gold} strokeWidth={MARK.highlight.width} strokeLinecap="round" {...draw(1.0, 0.35)} />
          <motion.circle
            cx={MARK.dot.cx}
            cy={MARK.dot.cy}
            r={MARK.dot.r}
            fill={C.coral}
            stroke="var(--background)"
            strokeWidth={MARK.dot.ring}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 1.25, type: "spring", stiffness: 380, damping: 16 }}
          />
        </>
      ) : (
        <>
          <g>
            <path d={MARK.ring.d} stroke={`url(#${idPrefix}-ring)`} strokeWidth={MARK.ring.width} strokeLinecap="round" />
            <animateTransform attributeName="transform" type="rotate" from="0 256 256" to="360 256 256" dur="1.8s" repeatCount="indefinite" />
          </g>
          <path d={MARK.page} fill="var(--foreground)" />
          <path d={MARK.fold} fill="var(--background)" fillOpacity={0.28} />
          <path d={MARK.line1.d} stroke="var(--background)" strokeWidth={MARK.line1.width} strokeLinecap="round" />
          <path d={MARK.line2.d} stroke="var(--background)" strokeWidth={MARK.line2.width} strokeLinecap="round" />
          <path d={MARK.highlight.d} stroke={C.gold} strokeWidth={MARK.highlight.width} strokeLinecap="round">
            <animate attributeName="opacity" values="1;0.35;1" dur="1.2s" repeatCount="indefinite" />
          </path>
          <circle cx={MARK.dot.cx} cy={MARK.dot.cy} r={MARK.dot.r} fill={C.coral} stroke="var(--background)" strokeWidth={MARK.dot.ring}>
            <animate attributeName="r" values="32;37;32" dur="1.2s" repeatCount="indefinite" />
          </circle>
        </>
      )}
    </svg>
  );
}
