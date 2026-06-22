import { diffWords } from "diff";

export type TextDiffSegment = {
  type: "equal" | "add" | "remove";
  value: string;
};

export function textDiff(a: string, b: string): TextDiffSegment[] {
  return diffWords(a, b)
    .filter((part) => part.value.length > 0)
    .map((part) => ({
      type: part.added ? "add" as const : part.removed ? "remove" as const : "equal" as const,
      value: part.value,
    }));
}
