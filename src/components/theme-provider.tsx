"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/* ── ThemeProvider ──────────────────────────────────────────────────────
   Wraps the app with next-themes. The `.dark` class on <html> activates
   the dark token overrides defined in globals.css. Persists choice to
   localStorage and follows system preference by default.
   ─────────────────────────────────────────────────────────────────── */

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="clausly-theme"
    >
      {children}
    </NextThemesProvider>
  );
}
