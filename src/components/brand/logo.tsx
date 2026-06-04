import Link from "next/link";
import { cn } from "@/lib/utils";

/* The Clausly logomark: a paragraph mark folded into an arc — suggesting
 * a clause being lifted out of a document into clarity. */
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
      <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#clauslyMark)" />
      <path
        d="M11 10.5h11M11 16h8M11 21.5h6"
        stroke="var(--background)"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="24" cy="21.5" r="2.25" fill="var(--accent)" stroke="var(--background)" strokeWidth="1.25" />
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
        <span className="font-serif text-[22px] tracking-[-0.02em] leading-none">
          Clausly
          <span className="text-[var(--muted)] text-[16px] align-baseline ml-[1px]">.app</span>
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
