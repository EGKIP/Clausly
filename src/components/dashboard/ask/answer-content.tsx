"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type AnswerBlock =
  | { type: "paragraph"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "numbers"; items: string[] };

export function normalizeAskAnswer(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  const withoutFence = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

  if (withoutFence.startsWith("{")) {
    try {
      const parsed = JSON.parse(withoutFence) as { answer?: unknown };
      if (typeof parsed.answer === "string") {
        return parsed.answer.trim();
      }
    } catch {
      // Keep rendering the original text when it is not valid JSON.
    }
  }

  return trimmed;
}

function splitDenseNumberedText(text: string): string {
  return text.replace(/([^\n])\s+([2-9]\.\s+)/g, "$1\n$2");
}

function toBlocks(answer: string): AnswerBlock[] {
  const normalized = splitDenseNumberedText(normalizeAskAnswer(answer));
  const lines = normalized.split(/\r?\n/);
  const blocks: AnswerBlock[] = [];
  let paragraph: string[] = [];
  let bullets: string[] = [];
  let numbers: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", text: paragraph.join(" ").replace(/\s+/g, " ").trim() });
      paragraph = [];
    }
  };

  const flushBullets = () => {
    if (bullets.length > 0) {
      blocks.push({ type: "bullets", items: bullets });
      bullets = [];
    }
  };

  const flushNumbers = () => {
    if (numbers.length > 0) {
      blocks.push({ type: "numbers", items: numbers });
      numbers = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushBullets();
      flushNumbers();
      continue;
    }

    const bullet = line.match(/^[-*•]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      flushNumbers();
      bullets.push(bullet[1].trim());
      continue;
    }

    const numbered = line.match(/^\d+[.)]\s+(.+)$/);
    if (numbered) {
      flushParagraph();
      flushBullets();
      numbers.push(numbered[1].trim());
      continue;
    }

    flushBullets();
    flushNumbers();
    paragraph.push(line);
  }

  flushParagraph();
  flushBullets();
  flushNumbers();

  return blocks.filter((block) => block.type !== "paragraph" || block.text.length > 0);
}

function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={`${part}-${index}`} className="font-semibold text-[var(--foreground)]">
              {part.slice(2, -2)}
            </strong>
          );
        }

        return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
      })}
    </>
  );
}

export function AskAnswerContent({ answer, className }: { answer: string; className?: string }) {
  const blocks = toBlocks(answer);

  if (blocks.length === 0) {
    return <p className={cn("mt-2 text-[14px] leading-relaxed", className)}>Thinking...</p>;
  }

  return (
    <div className={cn("mt-2 space-y-3 text-[14px] leading-relaxed", className)}>
      {blocks.map((block, index) => {
        if (block.type === "bullets") {
          return (
            <ul key={index} className="space-y-1.5 pl-4">
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`} className="list-disc marker:text-[var(--accent)]">
                  <InlineText text={item} />
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "numbers") {
          return (
            <ol key={index} className="space-y-1.5 pl-4">
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`} className="list-decimal marker:text-[var(--accent)]">
                  <InlineText text={item} />
                </li>
              ))}
            </ol>
          );
        }

        return (
          <p key={index}>
            <InlineText text={block.text} />
          </p>
        );
      })}
    </div>
  );
}
