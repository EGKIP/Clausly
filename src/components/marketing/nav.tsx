"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "#features", label: "Features" },
  { href: "#preview", label: "Product" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function MarketingNav() {
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-300",
        scrolled ? "pt-3" : "pt-5"
      )}
    >
      <div className="mx-auto w-full max-w-[1240px] px-4 md:px-6">
        <nav
          className={cn(
            "flex items-center justify-between gap-6 rounded-[var(--radius-xl)] border transition-all duration-300",
            scrolled
              ? "border-[var(--border)] bg-[color-mix(in_oklch,var(--background)_72%,transparent)] backdrop-blur-xl py-2 pl-4 pr-2 shadow-[var(--shadow-card)]"
              : "border-transparent bg-transparent py-3 pl-2 pr-2"
          )}
        >
          <Logo />

          <ul className="hidden md:flex items-center gap-1 text-sm text-[var(--muted)]">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="px-3 py-2 rounded-[var(--radius-sm)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden md:flex items-center gap-2">
            <Button variant="ghost" size="sm" href="/login">
              Sign in
            </Button>
            <Button variant="primary" size="sm" href="/signup">
              Get started
            </Button>
          </div>

          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setOpen((v) => !v)}
            className="md:hidden inline-flex size-9 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)]"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </nav>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="md:hidden mx-4 mt-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-float)] p-3"
          >
            <ul className="grid gap-1">
              {links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="block px-3 py-2.5 rounded-[var(--radius-sm)] hover:bg-[var(--surface-2)] text-sm"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-[var(--border)]">
              <Button variant="secondary" size="md" href="/login">
                Sign in
              </Button>
              <Button variant="primary" size="md" href="/signup">
                Get started
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
