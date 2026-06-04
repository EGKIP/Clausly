import Link from "next/link";
import { Container } from "@/components/ui/primitives";
import { Logo } from "@/components/brand/logo";

const columns = [
  {
    title: "Product",
    links: [
      { href: "#features", label: "Features" },
      { href: "#preview", label: "Product tour" },
      { href: "#pricing", label: "Pricing" },
      { href: "/dashboard", label: "Live demo" },
      { href: "#", label: "Changelog" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "#faq", label: "FAQ" },
      { href: "#", label: "Lease guide" },
      { href: "#", label: "Clause library" },
      { href: "#", label: "Security" },
      { href: "#", label: "API (soon)" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "#", label: "About" },
      { href: "#", label: "Blog" },
      { href: "#", label: "Contact" },
      { href: "#", label: "Careers" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "#", label: "Terms" },
      { href: "#", label: "Privacy" },
      { href: "#", label: "Cookies" },
      { href: "#", label: "Disclaimer" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="relative border-t border-[var(--border)] bg-[var(--surface)]">
      <Container className="py-16 md:py-20">
        <div className="grid gap-12 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="space-y-5 max-w-sm">
            <Logo />
            <p className="text-sm leading-relaxed text-[var(--muted)]">
              Clausly turns the contracts you signed into clear summaries, surfaced
              clauses, and approved reminders — so nothing important slips past you.
            </p>
            <div className="flex items-center gap-3 text-xs text-[var(--faint)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="relative flex size-2">
                  <span className="absolute inset-0 rounded-full bg-[var(--color-clause)] animate-ping opacity-60" />
                  <span className="relative inline-flex rounded-full size-2 bg-[var(--color-clause)]" />
                </span>
                All systems normal
              </span>
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--faint)] mb-4">
                {col.title}
              </h3>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)] p-5 md:p-6 text-[12.5px] leading-relaxed text-[var(--muted)]">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)] mb-2">
            Important
          </p>
          <p className="text-pretty">
            Clausly provides document organization and general contract information. Clausly is{" "}
            <span className="text-[var(--foreground)]">not a law firm</span> and does{" "}
            <span className="text-[var(--foreground)]">not provide legal advice</span>. Using Clausly does
            not create an attorney–client relationship. For decisions that depend on legal
            interpretation, please consult a licensed attorney in your jurisdiction.
          </p>
        </div>

        <div className="mt-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-6 border-t border-[var(--border)] text-xs text-[var(--faint)]">
          <p>© {new Date().getFullYear()} Clausly, Inc. All rights reserved.</p>
          <p className="font-mono tracking-wider">v0.1.0 · built for the documents you signed</p>
        </div>
      </Container>
    </footer>
  );
}
