import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { AuthTrustPanel } from "@/components/auth/auth-trust-panel";

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
          <div
            aria-hidden
            className="absolute left-10 right-10 top-28 h-px bg-gradient-to-r from-transparent via-[var(--border-strong)] to-transparent"
          />
          <div
            aria-hidden
            className="absolute bottom-0 left-0 right-0 h-56 bg-gradient-to-t from-[color-mix(in_oklch,var(--accent-soft)_28%,transparent)] to-transparent"
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
            <AuthTrustPanel quote={quote} />
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
