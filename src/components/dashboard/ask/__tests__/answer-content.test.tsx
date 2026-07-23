import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AskAnswerContent, normalizeAskAnswer } from "../answer-content";

describe("AskAnswerContent", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders markdown bold without showing literal markers", () => {
    render(<AskAnswerContent answer="**Move-out deadline:** Leave by noon." />);

    expect(screen.getByText("Move-out deadline:")).toBeInTheDocument();
    expect(screen.queryByText(/\*\*/)).not.toBeInTheDocument();
  });

  it("turns numbered answer lines into an ordered list", () => {
    render(<AskAnswerContent answer={"1. Give written notice.\n2. Pay remaining rent.\n3. Return the keys."} />);

    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");

    expect(list.tagName).toBe("OL");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Give written notice.");
    expect(items[2]).toHaveTextContent("Return the keys.");
  });

  it("extracts the answer from a JSON-shaped provider response", () => {
    const raw = JSON.stringify({
      answer: "You can renew by giving notice before the deadline.",
      citationChunkIds: ["chunk-1"],
    });

    expect(normalizeAskAnswer(raw)).toBe("You can renew by giving notice before the deadline.");
    render(<AskAnswerContent answer={raw} />);

    expect(screen.getByText("You can renew by giving notice before the deadline.")).toBeInTheDocument();
    expect(screen.queryByText(/citationChunkIds/)).not.toBeInTheDocument();
  });

  it("separates dense numbered text into readable steps", () => {
    render(<AskAnswerContent answer="First check the deadline. 2. Notify the landlord. 3. Keep a copy." />);

    const items = screen.getAllByRole("listitem");

    expect(screen.getByText("First check the deadline.")).toBeInTheDocument();
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Notify the landlord.");
    expect(items[1]).toHaveTextContent("Keep a copy.");
  });
});
