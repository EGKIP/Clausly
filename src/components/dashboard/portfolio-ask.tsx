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

type ConversationSummary = {
  id: string;
  title: string;
  documentId: string | null;
  createdAt: string;
  updatedAt: string;
};

type PortfolioChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: PortfolioAskResult["citations"];
};

export function PortfolioAsk() {
  const [question, setQuestion] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [usage, setUsage] = React.useState<QaUsage | null>(null);
  const [conversationId, setConversationId] = React.useState<string | null>(null);
  const [conversations, setConversations] = React.useState<ConversationSummary[]>([]);
  const [messages, setMessages] = React.useState<PortfolioChatMessage[]>([]);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [suggestionsPending, setSuggestionsPending] = React.useState(false);
  const [suggestionsLoaded, setSuggestionsLoaded] = React.useState(false);
  const [result, setResult] = React.useState<PortfolioAskResult | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const showSuggestions = !conversationId && messages.length === 0;

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

  React.useEffect(() => {
    let cancelled = false;

    async function loadConversations() {
      const response = await fetch("/api/conversations").catch(() => null);
      if (!response?.ok) return;
      const body = await response.json().catch(() => null);
      if (!cancelled && Array.isArray(body?.conversations)) {
        setConversations(body.conversations);
      }
    }

    void loadConversations();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!showSuggestions || suggestionsLoaded || question.trim().length > 0) return;
    let cancelled = false;

    async function loadSuggestions() {
      setSuggestionsLoaded(true);
      setSuggestionsPending(true);
      const response = await fetch("/api/ask/portfolio/suggested-questions").catch(() => null);
      if (!response?.ok) {
        if (!cancelled) setSuggestionsPending(false);
        return;
      }
      const body = await response.json().catch(() => null);
      if (cancelled) return;
      if (Array.isArray(body?.suggestions)) {
        setSuggestions(body.suggestions.filter((item: unknown): item is string => typeof item === "string"));
      }
      setSuggestionsPending(Boolean(body?.pending));
    }

    void loadSuggestions();
    return () => {
      cancelled = true;
    };
  }, [question, showSuggestions, suggestionsLoaded]);

  async function selectConversation(id: string) {
    setConversationId(id);
    setError(null);
    const response = await fetch(`/api/conversations/${id}/messages`).catch(() => null);
    if (!response?.ok) return;
    const body = await response.json().catch(() => null);
    if (!Array.isArray(body?.messages)) return;
    setMessages(body.messages.map((message: {
      id: string;
      role: "user" | "assistant";
      content: string;
      citations?: PortfolioAskResult["citations"];
    }) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      citations: message.citations ?? [],
    })));
    setResult(null);
  }

  function startNewChat() {
    setConversationId(null);
    setMessages([]);
    setResult(null);
    setError(null);
    setSuggestions([]);
    setSuggestionsPending(false);
    setSuggestionsLoaded(false);
    textareaRef.current?.focus();
  }

  async function askPortfolio(event?: React.FormEvent<HTMLFormElement>, suggestedQuestion?: string) {
    event?.preventDefault();
    const trimmed = (suggestedQuestion ?? question).trim();
    if (trimmed.length < 3 || loading) return;

    if (suggestedQuestion) setQuestion(trimmed);
    setLoading(true);
    setError(null);
    setResult({ answer: "", citations: [] });
    const userMessageId = `local-user-${Date.now()}`;
    const assistantMessageId = `local-assistant-${Date.now()}`;
    setMessages((current) => [
      ...current,
      { id: userMessageId, role: "user", content: trimmed },
      { id: assistantMessageId, role: "assistant", content: "", citations: [] },
    ]);
    try {
      const response = await fetch("/api/ask/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ question: trimmed, ...(conversationId ? { conversationId } : {}) }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.code === "PORTFOLIO_EMPTY"
          ? "Upload your first document to use Portfolio Ask."
          : formatAskError(body, "Portfolio Ask could not answer that yet."));
        syncUsageFromLimit(body, setUsage);
        setMessages((current) => current.filter((message) => message.id !== assistantMessageId));
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

          if (event.name === "conversation") {
            const conversation = parseConversationEvent(event.data);
            if (conversation) {
              setConversationId(conversation.id);
              setConversations((current) => [conversation, ...current.filter((item) => item.id !== conversation.id)].slice(0, 10));
            }
          } else if (event.name === "citations") {
            const citations = Array.isArray(event.data.citations) ? event.data.citations : [];
            setResult((current) => ({
              answer: current?.answer ?? "",
              citations,
            }));
            setMessages((current) => current.map((message) => message.id === assistantMessageId
              ? { ...message, citations: citations as PortfolioAskResult["citations"] }
              : message));
          } else if (event.name === "token" && typeof event.data.text === "string") {
            setResult((current) => ({
              answer: `${current?.answer ?? ""}${event.data.text}`,
              citations: current?.citations ?? [],
            }));
            setMessages((current) => current.map((message) => message.id === assistantMessageId
              ? { ...message, content: `${message.content}${event.data.text}` }
              : message));
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
    <Card className="mt-10 overflow-hidden p-4 sm:p-6 md:p-7">
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

      <div className="mt-5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)]">
            Conversations
          </p>
          <button
            type="button"
            onClick={startNewChat}
            className="min-h-11 text-[12px] font-medium text-[var(--accent-ink)] underline underline-offset-4 sm:min-h-0"
          >
            + New chat
          </button>
        </div>
        {conversations.length > 0 ? (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => void selectConversation(conversation.id)}
                className={conversation.id === conversationId
                  ? "min-h-11 shrink-0 rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-[12px] text-[var(--accent-ink)] sm:min-h-0 sm:py-1.5"
                  : "min-h-11 shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] text-[var(--muted)] hover:border-[var(--border-strong)] sm:min-h-0 sm:py-1.5"}
              >
                {conversation.title}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[12.5px] text-[var(--muted)]">No saved portfolio chats yet.</p>
        )}
      </div>

      {showSuggestions && (
        <div className="mt-5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)]">
            Suggested portfolio questions
          </p>
          {suggestions.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void askPortfolio(undefined, suggestion)}
                  disabled={loading}
                  className="min-h-11 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left text-[13px] hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-0 sm:py-1.5"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {suggestionsPending ? (
                <>
                  <div className="h-3 w-56 rounded-full bg-[var(--border)]" />
                  <div className="h-3 w-44 rounded-full bg-[var(--border)]" />
                </>
              ) : (
                <p className="text-[12.5px] text-[var(--muted)]">
                  Suggestions are being prepared for your portfolio.
                </p>
              )}
            </div>
          )}
        </div>
      )}

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
        <div className="flex flex-col gap-3 border-t border-[var(--border)] px-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11.5px] leading-relaxed text-[var(--faint)]">
            Informational only. Not legal advice.
          </p>
          <Button
            variant="primary"
            size="sm"
            className="min-h-11 w-full sm:min-h-0 sm:w-auto"
            disabled={loading || question.trim().length < 3}
          >
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
            <Button href="/dashboard/documents" variant="outline" size="sm" className="mt-3 min-h-11 w-full sm:min-h-0 sm:w-auto">
              Go to documents
            </Button>
          ) : (
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              {usage?.plan === "free" && usage.remaining === 0 && (
                <Button href="/upgrade" variant="outline" size="sm" className="min-h-11 w-full sm:min-h-0 sm:w-auto">
                  Upgrade to Pro
                </Button>
              )}
              <button
                type="button"
                onClick={() => void askPortfolio()}
                className="min-h-11 text-left text-[12px] font-medium text-[var(--color-coral-ink)] underline underline-offset-4 sm:min-h-0"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      )}

      {messages.length > 0 && (
        <div className="mt-6 space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={message.role === "user"
                ? "ml-auto max-w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] p-4 sm:max-w-[86%]"
                : "mr-auto max-w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-4 sm:max-w-[92%]"}
            >
              <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)]">
                {message.role === "user" ? "You" : "Clausly"}
              </p>
              <p className="mt-2 text-[14px] leading-relaxed">{message.content || "Thinking..."}</p>
              {message.role === "assistant" && message.citations && message.citations.length > 0 && (
                <div className="mt-5 grid gap-2 md:grid-cols-2">
                  {message.citations.map((citation) => (
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
          ))}
        </div>
      )}

      {messages.length === 0 && result && (result.answer || result.citations.length > 0) && (
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

function parseConversationEvent(data: Record<string, unknown>): ConversationSummary | null {
  const conversation = data.conversation;
  if (!conversation || typeof conversation !== "object") return null;
  const value = conversation as { id?: unknown; title?: unknown };
  if (typeof value.id !== "string" || typeof value.title !== "string") return null;
  return {
    id: value.id,
    title: value.title,
    documentId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function PortfolioAskUpgradeTeaser() {
  return (
    <Card className="mt-10 overflow-hidden p-5 sm:p-7 md:p-9">
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
        <Button href="/upgrade" variant="primary" size="md" className="min-h-11 w-full sm:w-auto">
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
