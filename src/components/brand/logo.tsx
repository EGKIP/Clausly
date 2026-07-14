import Link from "next/link";
import { cn } from "@/lib/utils";

/* The Clausly logomark: a contract page, a highlighted clause, and a reminder
 * dot compressed into a small mark that stays legible in light and dark mode. */
export function Logomark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn("size-7", className)}
    >
      <defs>
        <linearGradient id="clauslyMark" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--foreground)" />
          <stop offset="1" stopColor="color-mix(in oklch, var(--foreground) 70%, var(--accent) 30%)" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="8" fill="url(#clauslyMark)" />
      <path
        d="M20.25 7.75v5.25h5.25"
        stroke="var(--background)"
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.72"
      />
      <path
        d="M9.5 10.25h8.25M9.5 16h13M9.5 21.75h7.25"
        stroke="var(--background)"
        strokeWidth="1.65"
        strokeLinecap="round"
      />
      <path
        d="M9.5 16h9.75"
        stroke="var(--accent)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="23.5" cy="22" r="2.45" fill="var(--accent)" stroke="var(--background)" strokeWidth="1.2" />
    </svg>
  );
}

export function Logo({
  className,
  showWordmark = true,
  href = "/",
}: {
  className?: string;
  showWordmark?: boolean;
  href?: string | null;
}) {
  const inner = (
    <>
      <Logomark />
      {showWordmark && (
        <span className="font-serif text-[22px] leading-none">
          Clausly
          <span className="ml-[2px] align-baseline font-sans text-[13px] font-medium text-[var(--muted)]">
            .app
          </span>
        </span>
      )}
    </>
  );
  const cls = cn("inline-flex items-center gap-2 text-[var(--foreground)]", className);
  if (href === null) return <span className={cls}>{inner}</span>;
  return (
    <Link href={href} className={cls} aria-label="Clausly home">
      {inner}
    </Link>
  );
}
