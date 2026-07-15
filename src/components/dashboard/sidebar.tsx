"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  FileText,
  BookOpen,
  BellRing,
  Sparkles,
  Settings,
  ChevronRight,
  HelpCircle,
  History,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const primary = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/documents", label: "Documents", icon: FileText },
  { href: "/dashboard/clauses", label: "Clauses", icon: BookOpen },
  { href: "/dashboard/reminders", label: "Reminders", icon: BellRing },
  { href: "/dashboard/insights", label: "Insights", icon: Sparkles, pro: true },
];

const secondary = [
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/settings/activity", label: "Activity log", icon: History, pro: true },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <aside className="flex h-full w-full flex-col bg-[var(--surface)] border-r border-[var(--border)]">
      {/* Brand */}
      <div className="h-16 shrink-0 flex items-center px-5 border-b border-[var(--border)]">
        <Logo />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-5">
        <p className="px-3 mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">
          Workspace
        </p>
        <ul className="flex flex-col gap-0.5">
          {primary.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "group relative flex items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2 text-[13.5px] transition-colors",
                    active
                      ? "text-[var(--foreground)]"
                      : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="sidebar-active"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      className="absolute inset-0 rounded-[var(--radius-sm)] bg-[var(--surface-2)] border border-[var(--border)]"
                    />
                  )}
                  <item.icon
                    className={cn(
                      "relative size-4 shrink-0",
                      active ? "text-[var(--accent)]" : "text-[var(--faint)] group-hover:text-[var(--muted)]"
                    )}
                  />
                  <span className="relative font-medium">{item.label}</span>
                  {item.pro && (
                    <Badge tone="clause" className="relative ml-auto px-1.5 py-px text-[9.5px] font-mono">
                      PRO
                    </Badge>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="mt-7 px-3 mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">
          Account
        </p>
        <ul className="flex flex-col gap-0.5">
          {secondary.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "group relative flex items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2 text-[13.5px] transition-colors",
                    active
                      ? "text-[var(--foreground)] bg-[var(--surface-2)] border border-[var(--border)]"
                      : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]"
                  )}
                >
                  <item.icon className="size-4 shrink-0 text-[var(--faint)] group-hover:text-[var(--muted)]" />
                  <span className="font-medium">{item.label}</span>
                  {item.pro && (
                    <Badge tone="clause" className="ml-auto px-1.5 py-px text-[9.5px] font-mono">
                      PRO
                    </Badge>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Pro upsell */}
        <div className="mt-7 rounded-[var(--radius-md)] border border-[color-mix(in_oklch,var(--accent)_28%,var(--border))] bg-[var(--accent-soft)] p-4 relative overflow-hidden">
          <div
            aria-hidden
            className="absolute -top-8 -right-8 size-24 rounded-full opacity-30"
            style={{
              background:
                "radial-gradient(circle, color-mix(in oklch, var(--accent) 40%, transparent), transparent 70%)",
            }}
          />
          <div className="relative">
            <div className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--accent-ink)]">
              <Sparkles className="size-2.5" /> Pro
            </div>
            <p className="mt-2 text-[13px] leading-snug text-[var(--accent-ink)]">
              Unlock unlimited documents, full risk analysis & weekly insights.
            </p>
            <Link
              href="/dashboard/settings/billing"
              onClick={onNavigate}
              className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--accent-ink)] hover:gap-1.5 transition-[gap]"
            >
              Upgrade <ChevronRight className="size-3" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Footer / Help */}
      <div className="shrink-0 border-t border-[var(--border)] p-3">
        <Link
          href="/dashboard/help"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2 text-[13px] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]"
        >
          <HelpCircle className="size-4 text-[var(--faint)]" />
          Help & shortcuts
          <span className="ml-auto font-mono text-[10.5px] text-[var(--faint)]">⌘ ?</span>
        </Link>
      </div>
    </aside>
  );
}
