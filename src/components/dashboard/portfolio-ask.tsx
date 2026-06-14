"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Send, Sparkles } from "lucide-react";
import { Badge, Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";

type PortfolioAskResult = {
  answer: string;
  citations: Array<{
    documentId: string;
    documentTitle: string;
    chunkId: string;
    pageNumber: number | null;
    snippet: string;
  }>;
};

const suggestions = [
  "Which contracts expire in the next 90 days?",
  "Which of my leases have auto-renewal clauses?",
  "Where is my highest monthly cost?",
  "Do any of my contracts have indemnity?",
];

export function PortfolioAsk() {
  const [question, setQuestion] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<PortfolioAskResult | null>(null);

  async function askPortfolio(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmed = question.trim();
    if (trimmed.length < 3 || loading) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ask/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body?.code === "PORTFOLIO_EMPTY"
          ? "Upload your first document to use Portfolio Ask."
          : body?.error ?? "Portfolio Ask could not answer that yet.");
        return;
      }

      setResult(body);
    } catch {
      setError("Portfolio Ask could not answer that yet.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mt-10 overflow-hidden p-6 md:p-7">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <Badge tone="iris">
            <Sparkles className="size-2.5" /> Pro · Portfolio Ask
          </Badge>
          <h2 className="mt-4 font-serif text-[clamp(1.65rem,3vw,2.35rem)] leading-[1.05] tracking-[-0.01em]">
            Ask across every contract.
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed text-[var(--muted)]">
            Ask a grounded question across your uploaded portfolio. Clausly answers
            from indexed excerpts and links each citation back to its document.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => setQuestion(suggestion)}
            className="text-left text-[13px] rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 hover:border-[var(--border-strong)] hover:bg-[var(--surface)]"
          >
            {suggestion}
          </button>
        ))}
      </div>

      <form
        onSubmit={askPortfolio}
        className="mt-5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] p-2"
      >
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask a portfolio-wide question..."
          rows={3}
          className="min-h-24 w-full resize-none bg-transparent px-2 py-2 text-[14px] leading-relaxed focus:outline-none placeholder:text-[var(--faint)]"
        />
        <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-2 pt-2">
          <p className="text-[11.5px] leading-relaxed text-[var(--faint)]">
            Informational only. Not legal advice.
          </p>
          <Button variant="primary" size="sm" disabled={loading || question.trim().length < 3}>
            {loading ? (
              <span className="size-3.5 rounded-full border border-current border-t-transparent motion-safe:animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
            Ask
          </Button>
        </div>
      </form>

      {loading && (
        <div className="mt-5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-4">
          <div className="h-3 w-28 rounded-full bg-[var(--border)]" />
          <div className="mt-4 space-y-2">
            <div className="h-3 w-full rounded-full bg-[var(--border)]" />
            <div className="h-3 w-5/6 rounded-full bg-[var(--border)]" />
            <div className="h-3 w-2/3 rounded-full bg-[var(--border)]" />
          </div>
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-[var(--radius-md)] border border-[color-mix(in_oklch,var(--color-coral)_28%,var(--border))] bg-[var(--color-coral-soft)] p-4">
          <p className="text-[13px] leading-relaxed text-[var(--color-coral-ink)]">{error}</p>
          {error.includes("Upload your first document") ? (
            <Button href="/dashboard/documents" variant="outline" size="sm" className="mt-3">
              Go to documents
            </Button>
          ) : (
            <button
              type="button"
              onClick={() => void askPortfolio()}
              className="mt-3 text-[12px] font-medium text-[var(--color-coral-ink)] underline underline-offset-4"
            >
              Try again
            </button>
          )}
        </div>
      )}

      {!loading && result && (
        <div className="mt-6 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-4">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)]">
            Answer
          </p>
          <p className="mt-2 text-[14px] leading-relaxed">{result.answer}</p>

          {result.citations.length > 0 && (
            <div className="mt-5 grid gap-2 md:grid-cols-2">
              {result.citations.map((citation) => (
                <Link
                  key={citation.chunkId}
                  href={`/dashboard/documents/${citation.documentId}`}
                  className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-3 hover:border-[var(--border-strong)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[13px] font-medium line-clamp-1">{citation.documentTitle}</p>
                    <ArrowUpRight className="size-3.5 shrink-0 text-[var(--muted)]" />
                  </div>
                  <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--accent-ink)]">
                    {citation.pageNumber ? `Page ${citation.pageNumber}` : "Indexed excerpt"}
                  </p>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--muted)] line-clamp-3">
                    {citation.snippet}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export function PortfolioAskUpgradeTeaser() {
  return (
    <Card className="mt-10 overflow-hidden p-7 md:p-9">
      <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <Badge tone="iris">
            <Sparkles className="size-2.5" /> Pro · Portfolio Ask
          </Badge>
          <h2 className="mt-5 font-serif text-[clamp(2rem,4vw,3.1rem)] leading-[1.02] tracking-[-0.01em]">
            Upgrade to unlock Portfolio Ask.
          </h2>
          <p className="mt-4 max-w-xl text-[14.5px] leading-relaxed text-[var(--muted)]">
            Ask one question across every uploaded contract and get a grounded answer
            with citations back to the source documents.
          </p>
        </div>
        <Button href="/upgrade" variant="primary" size="md">
          Upgrade to Pro
        </Button>
      </div>
    </Card>
  );
}
