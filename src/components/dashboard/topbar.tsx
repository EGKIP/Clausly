"use client";

import * as React from "react";
import Link from "next/link";
import { Search, Upload, Bell, Menu, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  return (
    <Link
      href="/dashboard/settings"
      className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-transparent hover:border-[var(--border)] hover:bg-[var(--surface-2)] py-1 pl-1 pr-2 transition-colors"
    >
      <div
        className="size-7 rounded-full bg-gradient-to-br from-[var(--accent)] to-[color-mix(in_oklch,var(--accent)_40%,var(--foreground))] flex items-center justify-center text-white font-mono text-[11px]"
        aria-hidden
      >
        EK
      </div>
      <div className="hidden md:block leading-tight">
        <p className="text-[12.5px] font-medium">Emmanuel K.</p>
        <p className="text-[10.5px] text-[var(--faint)]">Free plan</p>
      </div>
      <ChevronDown className="size-3.5 text-[var(--faint)] hidden md:block" />
    </Link>
  );
}
