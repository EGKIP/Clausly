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

type QaUsage = {
  used: number;
  limit: number;
  remaining: number;
  plan: "free" | "pro";
  resetsAt: string;
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
  const [usage, setUsage] = React.useState<QaUsage | null>(null);
  const [result, setResult] = React.useState<PortfolioAskResult | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function loadUsage() {
      const response = await fetch("/api/ask/usage").catch(() => null);
      if (!response?.ok) return;
      const body = await response.json().catch(() => null);
      if (!cancelled && isQaUsage(body)) setUsage(body);
    }

    void loadUsage();
    return () => {
      cancelled = true;
    };
  }, []);

  async function askPortfolio(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmed = question.trim();
    if (trimmed.length < 3 || loading) return;

    setLoading(true);
    setError(null);
    setResult({ answer: "", citations: [] });
    try {
      const response = await fetch("/api/ask/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ question: trimmed }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.code === "PORTFOLIO_EMPTY"
          ? "Upload your first document to use Portfolio Ask."
          : formatAskError(body, "Portfolio Ask could not answer that yet."));
        syncUsageFromLimit(body, setUsage);
        return;
      }

      if (!response.body) {
        setError("Portfolio Ask could not start streaming.");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;
      let completed = false;

      while (!done) {
        const chunk = await reader.read();
        done = chunk.done;
        buffer += decoder.decode(chunk.value, { stream: !done });
        const frames = buffer.split(/\n\n/);
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const event = parseSseFrame(frame);
          if (!event) continue;

          if (event.name === "citations") {
            setResult((current) => ({
              answer: current?.answer ?? "",
              citations: Array.isArray(event.data.citations) ? event.data.citations : [],
            }));
          } else if (event.name === "token" && typeof event.data.text === "string") {
            setResult((current) => ({
              answer: `${current?.answer ?? ""}${event.data.text}`,
              citations: current?.citations ?? [],
            }));
          } else if (event.name === "error") {
            setError(typeof event.data.message === "string" ? event.data.message : "Portfolio Ask could not answer that yet.");
          } else if (event.name === "done") {
            completed = true;
          }
        }
      }

      if (completed) decrementUsage(setUsage);
    } catch {
      setError("Portfolio Ask could not answer that yet.");
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }

  function parseSseFrame(frame: string): { name: string; data: Record<string, unknown> } | null {
    const name = frame
      .split(/\n/)
      .find((line) => line.startsWith("event:"))
      ?.slice("event:".length)
      .trim();
    const rawData = frame
      .split(/\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trim())
      .join("\n");

    if (!name || !rawData) return null;
    try {
      return { name, data: JSON.parse(rawData) };
    } catch {
      return null;
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
          ref={textareaRef}
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

      {usage && (
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--muted)]">
          {usage.remaining} of {usage.limit} questions remaining today
        </p>
      )}

      {loading && !result?.answer && result?.citations.length === 0 && (
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
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {usage?.plan === "free" && usage.remaining === 0 && (
                <Button href="/upgrade" variant="outline" size="sm">
                  Upgrade to Pro
                </Button>
              )}
              <button
                type="button"
                onClick={() => void askPortfolio()}
                className="text-[12px] font-medium text-[var(--color-coral-ink)] underline underline-offset-4"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      )}

      {result && (result.answer || result.citations.length > 0) && (
        <div className="mt-6 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-4">
          <div className="flex items-center gap-2">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)]">
              Answer
            </p>
            {loading && <span className="size-1.5 rounded-full bg-[var(--accent)] motion-safe:animate-pulse" />}
          </div>
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

function isQaUsage(value: unknown): value is QaUsage {
  if (!value || typeof value !== "object") return false;
  const usage = value as Partial<QaUsage>;
  return (
    typeof usage.used === "number" &&
    typeof usage.limit === "number" &&
    typeof usage.remaining === "number" &&
    (usage.plan === "free" || usage.plan === "pro") &&
    typeof usage.resetsAt === "string"
  );
}

function syncUsageFromLimit(body: unknown, setUsage: React.Dispatch<React.SetStateAction<QaUsage | null>>) {
  if (!body || typeof body !== "object") return;
  const errorBody = body as Partial<QaUsage> & { code?: string };
  const nextUsage = { ...errorBody, remaining: 0 };
  if (errorBody.code !== "QA_RATE_LIMIT" || !isQaUsage(nextUsage)) return;
  setUsage(nextUsage);
}

function decrementUsage(setUsage: React.Dispatch<React.SetStateAction<QaUsage | null>>) {
  setUsage((current) => {
    if (!current) return current;
    return {
      ...current,
      used: current.used + 1,
      remaining: Math.max(current.remaining - 1, 0),
    };
  });
}

function formatAskError(body: unknown, fallback: string) {
  if (!body || typeof body !== "object") return fallback;
  const errorBody = body as { code?: unknown; error?: unknown; limit?: unknown; resetsAt?: unknown };
  if (errorBody.code === "QA_RATE_LIMIT" && typeof errorBody.limit === "number") {
    return `You've used all ${errorBody.limit} questions for today. Resets ${formatResetTime(errorBody.resetsAt)}.`;
  }
  return typeof errorBody.error === "string" ? errorBody.error : fallback;
}

function formatResetTime(value: unknown) {
  if (typeof value !== "string") return "soon";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "soon";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
