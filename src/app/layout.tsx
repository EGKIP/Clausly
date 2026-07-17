import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
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
  applicationName: "Clausly",
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
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/icon", sizes: "64x64", type: "image/png" },
      { url: "/brand/clausly-mark.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    title: "Clausly — Understand what you signed.",
    description:
      "AI-powered contract intelligence. Summaries, clauses, deadlines, and approved reminders for the documents that matter.",
    url: "https://clausly.app",
    siteName: "Clausly",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Clausly contract intelligence workspace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Clausly — Understand what you signed.",
    description:
      "AI-powered contract intelligence. Summaries, clauses, deadlines, and approved reminders for the documents that matter.",
    images: ["/opengraph-image"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f5ee" },
    { media: "(prefers-color-scheme: dark)", color: "#0e131c" },
  ],
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Clausly",
  url: "https://clausly.app",
  logo: "https://clausly.app/brand/clausly-mark.svg",
  sameAs: ["https://clausly.app"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-svh antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
