import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/dynamic", () => ({
  default: () =>
    function ThrowingPDFViewer() {
      throw new Error("Cannot read properties of null (reading 'sendWithPromise')");
    },
}));

import { PDFPreview } from "../pdf-preview";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PDFPreview", () => {
  it("falls back to the faux paper preview when the real PDF viewer crashes", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<PDFPreview docTitle="Greenfield Lease" pages={3} signedUrl="https://signed.test/file.pdf" />);

    await waitFor(() => expect(screen.getByText("Page 1 of 3")).toBeInTheDocument());

    expect(screen.getAllByText("Greenfield Lease")).toHaveLength(2);
    expect(screen.getByText(/Cannot read properties of null/)).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
