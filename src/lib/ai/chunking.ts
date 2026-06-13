export type DocumentTextChunk = {
  index: number;
  content: string;
  pageNumber?: number;
};

export type ChunkDocumentOptions = {
  maxChars?: number;
  overlapChars?: number;
};

type TextPart = {
  text: string;
  pageNumber?: number;
};

const DEFAULT_MAX_CHARS = 2000;
const DEFAULT_OVERLAP_CHARS = 200;

export function chunkDocumentText(text: string, options: ChunkDocumentOptions = {}): DocumentTextChunk[] {
  const maxChars = Math.max(1, options.maxChars ?? DEFAULT_MAX_CHARS);
  const overlapChars = Math.min(Math.max(0, options.overlapChars ?? DEFAULT_OVERLAP_CHARS), Math.max(0, maxChars - 1));
  const parts = splitIntoPageParts(text);
  const chunks: DocumentTextChunk[] = [];
  let active = "";
  let activePage: number | undefined;

  for (const part of parts) {
    if (active && activePage !== part.pageNumber) {
      pushChunk(chunks, active, activePage);
      active = "";
      activePage = undefined;
    }

    const segments = splitPart(part.text, maxChars);
    for (const segment of segments) {
      if (!segment.trim()) continue;
      if (!active) {
        active = segment.trim();
        activePage = part.pageNumber;
        continue;
      }

      if (active.length + 2 + segment.length <= maxChars) {
        active = `${active}\n\n${segment.trim()}`;
        continue;
      }

      pushChunk(chunks, active, activePage);
      active = withOverlap(active, segment.trim(), overlapChars);
      activePage = part.pageNumber;
    }
  }

  pushChunk(chunks, active, activePage);
  return chunks;
}

function splitIntoPageParts(text: string): TextPart[] {
  if (!text.trim()) return [];
  return text.split("\f").flatMap((pageText, pageIndex) => {
    const normalized = normalizeText(pageText);
    if (!normalized) return [];
    return [{ text: normalized, pageNumber: text.includes("\f") ? pageIndex + 1 : undefined }];
  });
}

function normalizeText(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitPart(text: string, maxChars: number): string[] {
  const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const segments: string[] = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxChars) {
      segments.push(paragraph);
      continue;
    }
    segments.push(...splitLongText(paragraph, maxChars));
  }
  return segments;
}

function splitLongText(text: string, maxChars: number): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g)?.map((item) => item.trim()).filter(Boolean) ?? [text];
  const segments: string[] = [];
  let active = "";

  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      if (active) {
        segments.push(active);
        active = "";
      }
      segments.push(...hardCut(sentence, maxChars));
      continue;
    }

    if (!active) {
      active = sentence;
    } else if (active.length + 1 + sentence.length <= maxChars) {
      active = `${active} ${sentence}`;
    } else {
      segments.push(active);
      active = sentence;
    }
  }

  if (active) segments.push(active);
  return segments;
}

function hardCut(text: string, maxChars: number) {
  const chunks: string[] = [];
  for (let start = 0; start < text.length; start += maxChars) {
    const chunk = text.slice(start, start + maxChars).trim();
    if (chunk) chunks.push(chunk);
  }
  return chunks;
}

function withOverlap(previous: string, next: string, overlapChars: number) {
  if (overlapChars <= 0) return next;
  const overlap = previous.slice(Math.max(0, previous.length - overlapChars)).trim();
  return overlap ? `${overlap}\n\n${next}` : next;
}

function pushChunk(chunks: DocumentTextChunk[], content: string, pageNumber?: number) {
  const trimmed = content.trim();
  if (!trimmed) return;
  chunks.push({
    index: chunks.length,
    content: trimmed,
    ...(pageNumber ? { pageNumber } : {}),
  });
}
