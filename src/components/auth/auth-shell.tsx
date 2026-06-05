import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function AuthShell({
  eyebrow,
  title,
  quote,
  children,
}: {
  eyebrow: string;
  title: string;
  quote: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-svh bg-[var(--background)]">
      <div className="grid min-h-svh lg:grid-cols-[minmax(360px,0.92fr)_1.08fr]">
        <section className="relative hidden overflow-hidden border-r border-[var(--border)] bg-[var(--surface)] px-10 py-9 lg:flex lg:flex-col">
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.28]"
            style={{
              backgroundImage:
                "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
              maskImage: "linear-gradient(to bottom, black, transparent 72%)",
            }}
          />
          <div className="relative">
            <Logo />
          </div>
          <div className="relative mt-auto max-w-[520px] pb-10">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">
              {eyebrow}
            </p>
            <h1 className="mt-4 font-serif text-[clamp(3rem,5.4vw,5.4rem)] leading-[0.96] tracking-[-0.02em] text-balance">
              {title}
            </h1>
            <blockquote className="mt-7 border-l-2 border-[var(--accent)] pl-5 font-serif text-[22px] leading-[1.35] text-[var(--accent-ink)]">
              &ldquo;{quote}&rdquo;
            </blockquote>
          </div>
        </section>

        <section className="flex min-h-svh items-center justify-center px-4 py-10 sm:px-6">
          <div className="w-full max-w-[440px]">
            <div className="mb-10 lg:hidden">
              <Link href="/" aria-label="Clausly home">
                <Logo />
              </Link>
            </div>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
