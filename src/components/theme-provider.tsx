"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { Toaster } from "sonner";

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
      <ThemedToaster />
    </NextThemesProvider>
  );
}

/* Mounted inside the theme provider so the toaster receives the resolved
   theme and matches the rest of the surface. */
function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      position="bottom-right"
      theme={(resolvedTheme as "light" | "dark") ?? "light"}
      closeButton
      richColors={false}
      toastOptions={{
        style: {
          background: "var(--surface)",
          color: "var(--foreground)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-float)",
        },
      }}
    />
  );
}
