import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { Container } from "@/components/ui/primitives";

type LegalSlug = "terms" | "privacy" | "cookies" | "disclaimer";

type LegalPage = {
  title: string;
  updated: string;
  intro: string;
  sections: Array<{
    title: string;
    body: string;
  }>;
};

const legalPages: Record<LegalSlug, LegalPage> = {
  terms: {
    title: "Terms of Service",
    updated: "July 14, 2026",
    intro:
      "These terms describe the basic rules for using Clausly while the product is in early access.",
    sections: [
      {
        title: "Use of Clausly",
        body:
          "Clausly helps you organize contract documents, review AI-assisted summaries, and manage reminders. You are responsible for the documents you upload and for deciding how to use the information Clausly provides.",
      },
      {
        title: "No legal advice",
        body:
          "Clausly is not a law firm and does not provide legal advice. Summaries, clause explanations, risk labels, Q&A answers, reminders, exports, and shared digests are informational only.",
      },
      {
        title: "Account responsibility",
        body:
          "Keep your account credentials secure and use Clausly only for documents you have the right to upload, analyze, export, or share.",
      },
      {
        title: "Early access changes",
        body:
          "Features, limits, pricing, and availability may change as Clausly moves toward production readiness. We will aim to communicate meaningful changes clearly.",
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    updated: "July 14, 2026",
    intro:
      "This policy summarizes how Clausly handles account data and uploaded contract information.",
    sections: [
      {
        title: "Information we process",
        body:
          "Clausly processes account details, uploaded documents, extracted text, generated summaries, clauses, dates, reminders, questions, exports, shares, and operational audit events.",
      },
      {
        title: "How information is used",
        body:
          "We use this information to provide contract organization, AI analysis, reminders, portfolio search, billing, security, support, and product reliability.",
      },
      {
        title: "Document privacy",
        body:
          "Your documents are scoped to your account. Share links are read-only, token-protected, and can be revoked by the account owner.",
      },
      {
        title: "Service providers",
        body:
          "Clausly may rely on trusted providers for hosting, authentication, storage, AI processing, billing, and email delivery. These providers are used only to operate the product.",
      },
    ],
  },
  cookies: {
    title: "Cookie Notice",
    updated: "July 14, 2026",
    intro:
      "Clausly uses a small set of cookies and browser storage entries to keep the app secure and usable.",
    sections: [
      {
        title: "Essential cookies",
        body:
          "Authentication and session cookies are required so you can sign in, stay signed in, and access your dashboard securely.",
      },
      {
        title: "Preference storage",
        body:
          "We may store interface preferences such as theme choices or dismissed product guidance so the app feels consistent when you return.",
      },
      {
        title: "Analytics",
        body:
          "If product analytics are enabled, they should be used to understand reliability and product usage at an aggregate level, not to sell personal information.",
      },
    ],
  },
  disclaimer: {
    title: "Legal Disclaimer",
    updated: "July 14, 2026",
    intro:
      "Clausly provides contract intelligence, organization, and reminders. It does not replace professional legal advice.",
    sections: [
      {
        title: "Informational only",
        body:
          "AI-generated summaries, clause explanations, risk indicators, document Q&A, exports, insights, and reminders are informational aids. They may be incomplete or incorrect.",
      },
      {
        title: "Review source documents",
        body:
          "Always review the original contract before making decisions. Pay particular attention to highlighted clauses, dates, payment obligations, renewal terms, and termination language.",
      },
      {
        title: "Consult a professional",
        body:
          "For interpretation of rights, obligations, risk, enforceability, or legal strategy, consult a licensed attorney in the relevant jurisdiction.",
      },
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(legalPages).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getLegalPage(slug);
  if (!page) return {};

  return {
    title: `${page.title} | Clausly`,
    description: page.intro,
  };
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getLegalPage(slug);
  if (!page) notFound();

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <Container className="py-8 sm:py-10">
        <div className="flex items-center justify-between gap-4">
          <Logo href="/" />
          <Link
            href="/"
            className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
          >
            Back home
          </Link>
        </div>

        <article className="mx-auto mt-14 max-w-3xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">
            Clausly legal
          </p>
          <h1 className="mt-4 font-serif text-[44px] leading-[0.95] tracking-[-0.01em] sm:text-[58px]">
            {page.title}
          </h1>
          <p className="mt-4 text-sm text-[var(--faint)]">Last updated {page.updated}</p>
          <p className="mt-8 text-[17px] leading-relaxed text-[var(--muted)]">
            {page.intro}
          </p>

          <div className="mt-10 divide-y divide-[var(--border)] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]">
            {page.sections.map((section) => (
              <section key={section.title} className="p-5 sm:p-7">
                <h2 className="font-serif text-[25px] leading-tight">{section.title}</h2>
                <p className="mt-3 text-[14px] leading-relaxed text-[var(--muted)]">
                  {section.body}
                </p>
              </section>
            ))}
          </div>

          <p className="mt-8 text-[12px] leading-relaxed text-[var(--faint)]">
            Questions about these notices can be sent to support@clausly.app.
          </p>
        </article>
      </Container>
    </main>
  );
}

function getLegalPage(slug: string): LegalPage | null {
  if (slug === "terms" || slug === "privacy" || slug === "cookies" || slug === "disclaimer") {
    return legalPages[slug];
  }

  return null;
}
