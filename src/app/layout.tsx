import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://clausly.app"),
  title: {
    default: "Clausly — Understand what you signed.",
    template: "%s · Clausly",
  },
  description:
    "Clausly turns leases, contracts and agreements into clear summaries, surfaced clauses, and approved reminders — so you never miss what you signed.",
  keywords: [
    "contract management",
    "lease tracking",
    "AI contract review",
    "clause extraction",
    "deadline reminders",
    "contract intelligence",
  ],
  authors: [{ name: "Clausly" }],
  openGraph: {
    type: "website",
    title: "Clausly — Understand what you signed.",
    description:
      "AI-powered contract intelligence. Summaries, clauses, deadlines, and approved reminders for the documents that matter.",
    url: "https://clausly.app",
    siteName: "Clausly",
  },
  twitter: {
    card: "summary_large_image",
    title: "Clausly — Understand what you signed.",
    description:
      "AI-powered contract intelligence. Summaries, clauses, deadlines, and approved reminders for the documents that matter.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f5ee" },
    { media: "(prefers-color-scheme: dark)", color: "#0e131c" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-svh antialiased">{children}</body>
    </html>
  );
}
