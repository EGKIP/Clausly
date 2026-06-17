"use client";

import * as React from "react";
import Link from "next/link";
import { Search, Upload, Bell, Menu, ChevronDown, LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggleButton } from "@/components/theme-toggle";
import { signOut } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface TopbarProps {
  onOpenSidebar?: () => void;
  onOpenUpload?: () => void;
  onOpenSearch?: () => void;
}

export function Topbar({ onOpenSidebar, onOpenUpload, onOpenSearch }: TopbarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 h-16 shrink-0 flex items-center gap-3 px-4 md:px-6",
        "bg-[color-mix(in_oklch,var(--background)_82%,transparent)] backdrop-blur-xl",
        "border-b border-[var(--border)]"
      )}
    >
      {/* Mobile menu */}
      <button
        type="button"
        onClick={onOpenSidebar}
        aria-label="Open navigation"
        className="lg:hidden inline-flex size-9 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]"
      >
        <Menu className="size-4" />
      </button>

      {/* Search */}
      <button
        type="button"
        onClick={onOpenSearch}
        className={cn(
          "group flex-1 max-w-[520px] flex items-center gap-2.5 h-10 rounded-[var(--radius-md)]",
          "border border-[var(--border)] bg-[var(--surface)] px-3.5 text-left",
          "text-[13.5px] text-[var(--faint)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] transition-colors"
        )}
      >
        <Search className="size-4" />
        <span className="truncate">Search documents, clauses, dates…</span>
        <span className="ml-auto hidden sm:inline-flex items-center gap-1">
          <kbd className="font-mono text-[10.5px] px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--background)] text-[var(--muted)]">
            ⌘
          </kbd>
          <kbd className="font-mono text-[10.5px] px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--background)] text-[var(--muted)]">
            K
          </kbd>
        </span>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <div data-tour="upload" className="inline-flex">
          <Button
            variant="primary"
            size="sm"
            onClick={onOpenUpload}
            className="hidden sm:inline-flex"
          >
            <Upload className="size-3.5" />
            Upload
          </Button>
          <Button
            variant="primary"
            size="icon"
            onClick={onOpenUpload}
            aria-label="Upload document"
            className="sm:hidden"
          >
            <Upload className="size-4" />
          </Button>
        </div>

        {/* Theme */}
        <ThemeToggleButton className="hidden sm:inline-flex" />

        {/* Notifications */}
        <button
          type="button"
          aria-label="Notifications"
          className="relative inline-flex size-9 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]"
        >
          <Bell className="size-4 text-[var(--muted)]" />
          <span className="absolute top-2 right-2 size-1.5 rounded-full bg-[var(--color-coral)] ring-2 ring-[var(--surface)]" />
        </button>

        {/* User */}
        <UserMenu />
      </div>
    </header>
  );
}

function UserMenu() {
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState<string>("demo@clausly.app");
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function loadUser() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!cancelled && user?.email) setEmail(user.email);
      } catch {
        if (!cancelled) setEmail("demo@clausly.app");
      }
    }
    void loadUser();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const initial = email.charAt(0).toUpperCase();
  const label = email.split("@")[0].replace(/[._-]/g, " ");

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-transparent py-1 pl-1 pr-2 transition-colors hover:border-[var(--border)] hover:bg-[var(--surface-2)]"
      >
        <div
          className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent)] to-[color-mix(in_oklch,var(--accent)_40%,var(--foreground))] font-mono text-[11px] text-white"
          aria-hidden
        >
          {initial}
        </div>
        <div className="hidden max-w-[160px] leading-tight md:block">
          <p className="truncate text-[12.5px] font-medium capitalize">{label}</p>
          <p className="truncate text-[10.5px] text-[var(--faint)]">{email}</p>
        </div>
        <ChevronDown className="hidden size-3.5 text-[var(--faint)] md:block" />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-40 w-[240px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-1 shadow-[var(--shadow-float)]">
          <div className="px-3 py-2.5">
            <p className="truncate text-[12.5px] font-medium">{email}</p>
            <p className="mt-0.5 text-[11px] text-[var(--faint)]">Free plan</p>
          </div>
          <div className="my-1 h-px bg-[var(--border)]" />
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-[13px] hover:bg-[var(--surface-2)]"
            onClick={() => setOpen(false)}
          >
            <Settings className="size-3.5 text-[var(--muted)]" />
            Account settings
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-left text-[13px] text-[var(--color-coral-ink)] hover:bg-[var(--color-coral-soft)]"
            >
              <LogOut className="size-3.5" />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
