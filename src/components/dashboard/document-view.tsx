"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  FileText,
  ListTree,
  CalendarClock,
  BellRing,
  MessageSquare,
  Quote,
  ChevronRight,
  Send,
  Sparkles,
  Upload,
} from "lucide-react";
import type { ContractDoc } from "@/lib/mock-data";
import type { Clause } from "@/lib/mock-clauses";
import type { Reminder } from "@/lib/mock-reminders";
import { RiskPill } from "@/components/ui/risk-pill";
import { Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { PDFPreview } from "./pdf-preview";
import { DocumentRemindersSection } from "./reminders/document-reminders-section";
import { cn } from "@/lib/utils";

type Tab = "summary" | "clauses" | "dates" | "reminders" | "ask";
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

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Array<{ chunkId: string; pageNumber: number | null; snippet: string }>;
};

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "summary", label: "Summary", icon: FileText },
  { id: "clauses", label: "Clauses", icon: ListTree },
  { id: "dates", label: "Dates", icon: CalendarClock },
  { id: "reminders", label: "Reminders", icon: BellRing },
  { id: "ask", label: "Ask Clausly", icon: MessageSquare },
];

export function DocumentView({
  doc,
  clauses,
  reminders,
  signedUrl,
}: {
  doc: ContractDoc;
  clauses: Clause[];
  reminders: Reminder[];
  signedUrl?: string | null;
}) {
  const [tab, setTab] = React.useState<Tab>("summary");
  const [activeClauseId, setActiveClauseId] = React.useState<string | undefined>(clauses[0]?.id);
  const activeClause = clauses.find((c) => c.id === activeClauseId);
  const isDemo = doc.tags.includes("Demo");

  return (
    <>
      {isDemo && <DemoNotice />}
      <div className="mt-8 grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
      {/* Left column: tabs */}
      <div className="min-w-0">
        <DocumentRemindersSection doc={doc} />

        <div className="sticky top-16 z-20 -mx-1 px-1 py-2 bg-[color-mix(in_oklch,var(--background)_82%,transparent)] backdrop-blur-md">
          <div className="flex items-center gap-1 overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-1 shadow-[var(--shadow-card)] scrollbar-none">
            {tabs.map((t) => {
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  data-tour={t.id === "clauses" ? "clauses" : undefined}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "relative inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-2 text-[13px] font-medium whitespace-nowrap transition-colors sm:min-h-0",
                    active ? "text-[var(--foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="doc-tab"
                      className="absolute inset-0 rounded-[var(--radius-sm)] bg-[var(--surface-2)] border border-[var(--border)]"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <t.icon className="relative size-3.5" />
                  <span className="relative">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              {tab === "summary" && <SummaryPanel doc={doc} clauses={clauses} />}
              {tab === "clauses" && (
                <ClausesPanel clauses={clauses} active={activeClauseId} onSelect={setActiveClauseId} />
              )}
              {tab === "dates" && <DatesPanel doc={doc} />}
              {tab === "reminders" && <RemindersPanel reminders={reminders} />}
              {tab === "ask" && <AskPanel docId={doc.id} docTitle={doc.title} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Right column: PDF */}
      <div className="min-w-0 self-start lg:sticky lg:top-[88px]">
        <PDFPreview
          docTitle={doc.title}
          pages={doc.pages}
          activeClause={activeClause}
          signedUrl={signedUrl}
        />
      </div>
      </div>
    </>
  );
}

/* Inline banner for the three seeded demo documents. No PDF is on disk for
 * these, so the preview falls back to FauxPaper — the notice explains why
 * and points the user at the real upload path. */
function DemoNotice() {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)] px-4 py-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="inline-flex size-7 items-center justify-center rounded-[var(--radius-xs)] bg-[var(--accent-soft)] text-[var(--accent-ink)] shrink-0">
          <Sparkles className="size-3.5" />
        </span>
        <p className="text-[12.5px] text-[var(--muted)] leading-relaxed">
          <span className="font-medium text-[var(--foreground)]">Sample contract.</span>{" "}
          The clauses, dates, and reminders are illustrative — upload your own
          PDF to see real Clausly analysis.
        </p>
      </div>
      <Link
        href="/dashboard/documents?upload=1"
        className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] font-medium text-[var(--foreground)] hover:border-[var(--border-strong)] sm:w-auto"
      >
        <Upload className="size-3.5" />
        Upload your own
      </Link>
    </div>
  );
}

/* ── Summary ────────────────────────────────────────────────────────── */
function SummaryPanel({ doc, clauses }: { doc: ContractDoc; clauses: Clause[] }) {
  const counts = {
    high: clauses.filter((c) => c.risk === "High").length,
    medium: clauses.filter((c) => c.risk === "Medium").length,
    low: clauses.filter((c) => c.risk === "Low").length,
  };
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 md:p-7">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="size-3.5 text-[var(--accent)]" />
        <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--accent-ink)]">
          AI summary
        </p>
      </div>
      <p className="font-serif text-[20px] leading-[1.4] tracking-[-0.005em] text-balance">
        {doc.summary}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {(["high", "medium", "low"] as const).map((k) => (
          <div
            key={k}
            className={cn(
              "rounded-[var(--radius-md)] p-3.5 border",
              k === "high" && "border-[color-mix(in_oklch,var(--color-coral)_25%,var(--border))] bg-[var(--color-coral-soft)]",
              k === "medium" && "border-[color-mix(in_oklch,var(--color-ember)_25%,var(--border))] bg-[var(--color-ember-soft)]",
              k === "low" && "border-[color-mix(in_oklch,var(--color-clause)_22%,var(--border))] bg-[var(--color-clause-soft)]"
            )}
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-70">{k} risk</p>
            <p className="font-serif text-[28px] leading-none mt-1.5 tracking-[-0.01em]">
              {counts[k]}
            </p>
            <p className="text-[11px] mt-1 opacity-75">clause{counts[k] === 1 ? "" : "s"}</p>
          </div>
        ))}
      </div>

      <div className="mt-7">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)] mb-3">
          Tags
        </p>
        <div className="flex flex-wrap gap-1.5">
          {doc.tags.map((t) => (
            <Badge key={t} tone="neutral">{t}</Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Clauses ────────────────────────────────────────────────────────── */
function ClausesPanel({
  clauses,
  active,
  onSelect,
}: {
  clauses: Clause[];
  active?: string;
  onSelect: (id: string) => void;
}) {
  const current = clauses.find((c) => c.id === active) ?? clauses[0];
  return (
    <div data-tour="clauses" className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
      <ul className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)] max-h-[560px] overflow-y-auto">
        {clauses.map((c) => {
          const isActive = c.id === current.id;
          return (
            <li key={c.id}>
              <button
                onClick={() => onSelect(c.id)}
                className={cn(
                  "w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-[var(--surface-2)] transition-colors",
                  isActive && "bg-[var(--surface-2)]"
                )}
              >
                <span
                  className={cn(
                    "mt-1 size-1.5 rounded-full shrink-0",
                    c.risk === "High" ? "bg-[var(--color-coral)]" :
                    c.risk === "Medium" ? "bg-[var(--color-ember)]" :
                    c.risk === "Needs Review" ? "bg-[var(--color-iris)]" :
                    "bg-[var(--color-clause)]"
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium leading-tight truncate">{c.title}</p>
                  <p className="text-[11px] text-[var(--muted)] mt-0.5">
                    {c.category} · p. {c.page}
                  </p>
                </div>
                {isActive && <ChevronRight className="size-3.5 text-[var(--faint)] mt-1" />}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <Badge tone="outline">{current.category}</Badge>
          <div className="flex items-center gap-2">
            <RiskPill level={current.risk} size="sm" />
            <span className="font-mono text-[10.5px] text-[var(--faint)]">p. {current.page}</span>
          </div>
        </div>
        <h3 className="font-serif text-[22px] leading-tight tracking-[-0.01em]">{current.title}</h3>

        <div className="mt-5 rounded-[var(--radius-md)] border-l-2 border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3">
          <p className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--accent-ink)]">
            <Quote className="size-2.5" /> Source quote
          </p>
          <p className="mt-2 font-serif text-[14.5px] leading-[1.55] text-[var(--accent-ink)] italic">
            &ldquo;{current.quote}&rdquo;
          </p>
        </div>

        <div className="mt-5">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)] mb-1.5">
            In plain English
          </p>
          <p className="text-[14.5px] leading-relaxed">{current.plainEnglish}</p>
        </div>
        <div className="mt-5">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)] mb-1.5">
            Why it matters
          </p>
          <p className="text-[14px] leading-relaxed text-[var(--muted)]">{current.whyItMatters}</p>
        </div>
      </div>
    </div>
  );
}

/* ── Dates ──────────────────────────────────────────────────────────── */
function DatesPanel({ doc }: { doc: ContractDoc }) {
  const items = [
    { label: "Effective", value: doc.effective, days: -90 },
    doc.noticeBy && { label: "Notice deadline", value: doc.noticeBy, days: 27 },
    doc.ends !== "—" && { label: "Ends", value: doc.ends, days: 86 },
  ].filter(Boolean) as { label: string; value: string; days: number }[];
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="space-y-3">
        {items.map((d) => (
          <div key={d.label} className="grid grid-cols-1 gap-3 border-b border-[var(--border)] py-3 last:border-0 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-4">
            <div>
              <p className="text-[13px] font-medium">{d.label}</p>
              <p className="text-[11.5px] text-[var(--muted)]">{d.value}</p>
            </div>
            <span className="font-serif text-[20px] tabular-nums tracking-[-0.01em]">
              {d.days < 0 ? `${Math.abs(d.days)}d ago` : `${d.days}d`}
            </span>
            <Button variant="ghost" size="sm" className="min-h-11 w-full sm:min-h-0 sm:w-auto">Add reminder</Button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Reminders ──────────────────────────────────────────────────────── */
function RemindersPanel({ reminders }: { reminders: Reminder[] }) {
  if (reminders.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] p-10 text-center">
        <p className="font-serif text-[18px]">No reminders yet for this document.</p>
        <Button variant="primary" size="sm" className="mt-4 min-h-11 w-full sm:min-h-0 sm:w-auto">Suggest reminders</Button>
      </div>
    );
  }
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)] overflow-hidden">
      {reminders.map((r) => (
        <div key={r.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-ember-soft)] text-[var(--color-ember-ink)]">
            <BellRing className="size-4" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] font-medium">{r.title}</p>
            <p className="text-[12px] text-[var(--muted)] mt-0.5">{r.description}</p>
          </div>
          <div className="shrink-0 text-left sm:text-right">
            <p className="font-mono text-[12px] text-[var(--foreground)] tabular-nums">{r.fireOn}</p>
            <p className="font-mono text-[10.5px] text-[var(--faint)] uppercase tracking-[0.12em] mt-1">
              {r.status}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Ask Clausly ────────────────────────────────────────────────────── */
function AskPanel({ docId, docTitle }: { docId: string; docTitle: string }) {
  const [question, setQuestion] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [usage, setUsage] = React.useState<QaUsage | null>(null);
  const [conversationId, setConversationId] = React.useState<string | null>(null);
  const [conversations, setConversations] = React.useState<ConversationSummary[]>([]);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [suggestionsPending, setSuggestionsPending] = React.useState(false);
  const [suggestionsLoaded, setSuggestionsLoaded] = React.useState(false);
  const [result, setResult] = React.useState<{
    answer: string;
    citations: Array<{ chunkId: string; pageNumber: number | null; snippet: string }>;
  } | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
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
      const response = await fetch(`/api/conversations?documentId=${docId}`).catch(() => null);
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
  }, [docId]);

  React.useEffect(() => {
    if (!showSuggestions || suggestionsLoaded || question.trim().length > 0) return;
    let cancelled = false;

    async function loadSuggestions() {
      setSuggestionsLoaded(true);
      setSuggestionsPending(true);
      const response = await fetch(`/api/documents/${docId}/suggested-questions`).catch(() => null);
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
  }, [docId, question, showSuggestions, suggestionsLoaded]);

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
      citations?: Array<{ chunkId: string; pageNumber: number | null; snippet: string }>;
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
    inputRef.current?.focus();
  }

  async function askQuestion(event?: React.FormEvent<HTMLFormElement>, suggestedQuestion?: string) {
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
      const response = await fetch(`/api/documents/${docId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ question: trimmed, ...(conversationId ? { conversationId } : {}) }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(formatAskError(body, "Ask Clausly could not answer that yet."));
        syncUsageFromLimit(body, setUsage);
        setMessages((current) => current.filter((message) => message.id !== assistantMessageId));
        return;
      }

      if (!response.body) {
        setError("Ask Clausly could not start streaming.");
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
              ? { ...message, citations: citations as ChatMessage["citations"] }
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
            setError(typeof event.data.message === "string" ? event.data.message : "Ask Clausly could not answer that yet.");
          } else if (event.name === "done") {
            completed = true;
          }
        }
      }

      if (completed) decrementUsage(setUsage);
    } catch {
      setError("Ask Clausly could not answer that yet.");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
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
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)]">
            Ask Clausly
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--muted)]">
            Ask a grounded question about <span className="font-medium text-[var(--foreground)]">{docTitle}</span>.
            Answers cite indexed excerpts and are informational only.
          </p>
        </div>
        <Sparkles className="mt-1 size-4 shrink-0 text-[var(--accent)]" />
      </div>

      <div className="mt-5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)]">
            Conversations
          </p>
          <button
            type="button"
            onClick={startNewChat}
            className="text-[12px] font-medium text-[var(--accent-ink)] underline underline-offset-4"
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
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-[12px] transition-colors",
                  conversation.id === conversationId
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--border-strong)]"
                )}
              >
                {conversation.title}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[12.5px] text-[var(--muted)]">No saved chats yet.</p>
        )}
      </div>

      {showSuggestions && (
        <div className="mt-5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)]">
            Suggested questions
          </p>
          {suggestions.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void askQuestion(undefined, s)}
                  disabled={loading}
                  className="min-h-11 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left text-[13px] hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-0 sm:py-1.5"
                >
                  {s}
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {suggestionsPending ? (
                <>
                  <div className="h-3 w-52 rounded-full bg-[var(--border)]" />
                  <div className="h-3 w-40 rounded-full bg-[var(--border)]" />
                </>
              ) : (
                <p className="text-[12.5px] text-[var(--muted)]">
                  Suggestions are being prepared for this document.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <form
        onSubmit={askQuestion}
        className="mt-5 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] p-2"
      >
        <input
          ref={inputRef}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask anything about this document…"
          className="min-w-0 flex-1 bg-transparent px-2 py-2 text-[14px] focus:outline-none placeholder:text-[var(--faint)]"
        />
        <Button variant="primary" size="sm" aria-label="Send" disabled={loading || question.trim().length < 3} className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0">
          {loading ? (
            <span className="size-3.5 rounded-full border border-current border-t-transparent motion-safe:animate-spin" />
          ) : (
            <Send className="size-3.5" />
          )}
        </Button>
      </form>

      {usage && (
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--muted)]">
          {usage.remaining} of {usage.limit} questions remaining today
        </p>
      )}

      {loading && !result?.answer && result?.citations.length === 0 && (
        <div className="mt-6 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-4">
          <div className="h-3 w-24 rounded-full bg-[var(--border)]" />
          <div className="mt-4 space-y-2">
            <div className="h-3 w-full rounded-full bg-[var(--border)]" />
            <div className="h-3 w-5/6 rounded-full bg-[var(--border)]" />
            <div className="h-3 w-2/3 rounded-full bg-[var(--border)]" />
          </div>
        </div>
      )}

      {messages.length > 0 && (
        <div className="mt-6 space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "rounded-[var(--radius-md)] border p-4",
                message.role === "user"
                  ? "ml-auto max-w-full border-[var(--border)] bg-[var(--background)] sm:max-w-[86%]"
                  : "mr-auto max-w-full border-[var(--border)] bg-[var(--surface-2)] sm:max-w-[92%]"
              )}
            >
              <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)]">
                {message.role === "user" ? "You" : "Clausly"}
              </p>
              <p className="mt-2 text-[14px] leading-relaxed">{message.content || "Thinking..."}</p>
              {message.role === "assistant" && message.citations && message.citations.length > 0 && (
                <div className="mt-4 space-y-2">
                  {message.citations.map((citation) => (
                    <div
                      key={citation.chunkId}
                      className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-3"
                    >
                      <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--accent-ink)]">
                        {citation.pageNumber ? `Page ${citation.pageNumber}` : "Indexed excerpt"}
                      </p>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--muted)]">{citation.snippet}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-[var(--radius-md)] border border-[color-mix(in_oklch,var(--color-coral)_28%,var(--border))] bg-[var(--color-coral-soft)] p-4">
          <p className="text-[13px] leading-relaxed text-[var(--color-coral-ink)]">{error}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {usage?.plan === "free" && usage.remaining === 0 && (
              <Button href="/upgrade" variant="outline" size="sm">
                Upgrade to Pro
              </Button>
            )}
            <button
              type="button"
              onClick={() => void askQuestion()}
              className="text-[12px] font-medium text-[var(--color-coral-ink)] underline underline-offset-4"
            >
              Try again
            </button>
          </div>
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
            <div className="mt-5 space-y-2">
              {result.citations.map((citation) => (
                <div
                  key={citation.chunkId}
                  className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-3"
                >
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--accent-ink)]">
                    {citation.pageNumber ? `Page ${citation.pageNumber}` : "Indexed excerpt"}
                  </p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--muted)]">{citation.snippet}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
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
