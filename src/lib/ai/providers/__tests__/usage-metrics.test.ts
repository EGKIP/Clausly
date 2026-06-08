import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recordUsage } from "../../usage-metrics";

type InsertedRow = Record<string, unknown>;

function usageClient(options: { error?: { message: string }; throwOnInsert?: boolean } = {}) {
  const rows: InsertedRow[] = [];
  return {
    rows,
    client: {
      from(table: string) {
        expect(table).toBe("usage_metrics");
        return {
          async insert(row: InsertedRow) {
            if (options.throwOnInsert) throw new Error("Insert transport failed.");
            rows.push(row);
            return { error: options.error ?? null };
          },
        };
      },
    },
  };
}

describe("recordUsage", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("inserts a completed analysis usage row", async () => {
    const { client, rows } = usageClient();

    await recordUsage(client as never, {
      userId: "user-1",
      documentId: "doc-1",
      provider: "openai",
      model: "gpt-4o-mini",
      status: "completed",
      inputTokenCount: 10,
      outputTokenCount: 20,
    });

    expect(rows).toEqual([
      expect.objectContaining({
        user_id: "user-1",
        document_id: "doc-1",
        job_type: "analysis",
        provider: "openai",
        model: "gpt-4o-mini",
        input_token_count: 10,
        output_token_count: 20,
        status: "completed",
        error_message: null,
      }),
    ]);
  });

  it("inserts a failed analysis usage row with a sanitized error", async () => {
    const { client, rows } = usageClient();
    const longError = "x".repeat(600);

    await recordUsage(client as never, {
      userId: "user-1",
      documentId: "doc-1",
      provider: "anthropic",
      model: "claude-3-5-haiku-latest",
      status: "failed",
      errorMessage: longError,
    });

    expect(rows[0]).toMatchObject({
      job_type: "analysis",
      status: "failed",
      error_message: "x".repeat(500),
    });
  });

  it("does not bubble logging failures", async () => {
    const { client } = usageClient({ error: { message: "RLS denied." } });

    await expect(recordUsage(client as never, {
      userId: "user-1",
      status: "completed",
    })).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith("Usage metrics insert failed.", "RLS denied.");
  });
});
