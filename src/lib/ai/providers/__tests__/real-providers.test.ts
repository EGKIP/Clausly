import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeDocument, getAnalysisModel, getAnalysisProvider } from "../../provider";
import { ProviderSchemaError } from "../../errors";
import type { AnalysisResult } from "../../schema";

const sampleInput = {
  text: "Lease starts 2026-09-01 and ends 2027-08-31. Rent is $1500.",
  fileName: "lease.pdf",
  title: "Sample Lease",
};

function validResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    documentTitle: "Sample Lease",
    documentType: "lease",
    jurisdiction: "Minnesota",
    summaryShort: "A lease with rent, term, and notice obligations.",
    summaryLong: "This lease should be reviewed for dates, rent, and renewal terms.",
    riskLevel: "Medium",
    riskReasons: ["Notice obligations require review."],
    pageCount: 2,
    monthlyValue: 1500,
    effectiveDate: "2026-09-01",
    endDate: "2027-08-31",
    noticeWindowDays: 60,
    tags: ["Lease"],
    clauses: [
      {
        title: "Rent",
        category: "Payment",
        riskLevel: "Medium",
        sourcePage: 1,
        sourceText: "Rent is $1500.",
        plainEnglish: "Monthly rent is due under the lease.",
        whyItMatters: "Payment defaults can trigger penalties.",
        confidence: 0.9,
      },
    ],
    importantDates: [],
    suggestedReminders: [],
    ...overrides,
  };
}

function jsonResponse(payload: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => payload,
  } as Response);
}

function openAIResponse(payload: unknown) {
  return { output_text: JSON.stringify(payload) };
}

function anthropicResponse(payload: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(payload) }] };
}

describe("real AI provider selection", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    delete process.env.CLAUSLY_AI_PROVIDER;
    delete process.env.CLAUSLY_AI_MODEL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.CLAUSLY_AI_PROVIDER;
    delete process.env.CLAUSLY_AI_MODEL;
  });

  it("defaults to mock provider and default real model names", () => {
    expect(getAnalysisProvider()).toBe("mock");
    expect(getAnalysisModel("openai")).toBe("gpt-4o-mini");
    expect(getAnalysisModel("anthropic")).toBe("claude-3-5-haiku-latest");
  });

  it("selects OpenAI and honors CLAUSLY_AI_MODEL override", async () => {
    process.env.CLAUSLY_AI_PROVIDER = "openai";
    process.env.CLAUSLY_AI_MODEL = "gpt-test-model";
    vi.mocked(fetch).mockImplementation(() => jsonResponse(openAIResponse(validResult())));

    const result = await analyzeDocument(sampleInput);

    expect(result.documentTitle).toBe("Sample Lease");
    expect(fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"model":"gpt-test-model"'),
      }),
    );
  });

  it("selects Anthropic and returns a valid response", async () => {
    process.env.CLAUSLY_AI_PROVIDER = "anthropic";
    vi.mocked(fetch).mockImplementation(() => jsonResponse(anthropicResponse(validResult({ riskLevel: "Low" }))));

    const result = await analyzeDocument(sampleInput);

    expect(result.riskLevel).toBe("Low");
    expect(fetch).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"model":"claude-3-5-haiku-latest"'),
      }),
    );
  });

  it("retries once when OpenAI JSON violates the analysis schema", async () => {
    process.env.CLAUSLY_AI_PROVIDER = "openai";
    vi.mocked(fetch)
      .mockImplementationOnce(() => jsonResponse(openAIResponse({ documentTitle: "" })))
      .mockImplementationOnce(() => jsonResponse(openAIResponse(validResult())));

    const result = await analyzeDocument(sampleInput);

    expect(result.documentTitle).toBe("Sample Lease");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(String(vi.mocked(fetch).mock.calls[1][1]?.body)).toContain("Previous JSON failed validation");
  });

  it("throws when Anthropic returns invalid JSON twice", async () => {
    process.env.CLAUSLY_AI_PROVIDER = "anthropic";
    vi.mocked(fetch).mockImplementation(() => jsonResponse(anthropicResponse({ documentTitle: "" })));

    await expect(analyzeDocument(sampleInput)).rejects.toThrow(/schema validation/i);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("tells the model the exact allowed enum values in the system prompt", async () => {
    process.env.CLAUSLY_AI_PROVIDER = "openai";
    vi.mocked(fetch).mockImplementation(() => jsonResponse(openAIResponse(validResult())));

    await analyzeDocument(sampleInput);

    const body = String(vi.mocked(fetch).mock.calls[0][1]?.body);
    expect(body).toContain('\\"lease\\" | \\"auto\\" | \\"employment\\" | \\"service\\" | \\"nda\\" | \\"other\\"');
    expect(body).toContain('\\"Low\\" | \\"Medium\\" | \\"High\\" | \\"Needs Review\\"');
    expect(body).toContain("documentTitle");
    expect(body).toContain("suggestedReminders");
  });

  it("asks real providers for fuller grounded clause coverage", async () => {
    process.env.CLAUSLY_AI_PROVIDER = "openai";
    vi.mocked(fetch).mockImplementation(() => jsonResponse(openAIResponse(validResult())));

    await analyzeDocument(sampleInput);

    const body = String(vi.mocked(fetch).mock.calls[0][1]?.body);
    expect(body).toContain("identify roughly 8-18 material clauses");
    expect(body).toContain("Every clause must be grounded in an exact sourceText quote");
    expect(body).toContain("Use whyItMatters to explain the practical effect");
  });

  it("accepts natural-language enum drift without needing a retry", async () => {
    process.env.CLAUSLY_AI_PROVIDER = "openai";
    const drifted = {
      ...validResult(),
      documentType: "Lease Agreement",
      riskLevel: "medium risk",
      clauses: [{ ...validResult().clauses[0], riskLevel: "HIGH RISK" }],
    };
    vi.mocked(fetch).mockImplementation(() => jsonResponse(openAIResponse(drifted)));

    const result = await analyzeDocument(sampleInput);

    expect(result.documentType).toBe("lease");
    expect(result.riskLevel).toBe("Medium");
    expect(result.clauses[0].riskLevel).toBe("High");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("accepts a response wrapped in an analysis envelope", async () => {
    process.env.CLAUSLY_AI_PROVIDER = "openai";
    vi.mocked(fetch).mockImplementation(() => jsonResponse(openAIResponse({ analysis: validResult() })));

    const result = await analyzeDocument(sampleInput);

    expect(result.documentTitle).toBe("Sample Lease");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("includes invalid paths and allowed values in the repair prompt", async () => {
    process.env.CLAUSLY_AI_PROVIDER = "openai";
    vi.mocked(fetch)
      .mockImplementationOnce(() => jsonResponse(openAIResponse(validResult({ documentType: "mystery" as never }))))
      .mockImplementationOnce(() => jsonResponse(openAIResponse(validResult())));

    await analyzeDocument(sampleInput);

    const repairBody = String(vi.mocked(fetch).mock.calls[1][1]?.body);
    expect(repairBody).toContain("documentType");
    expect(repairBody).toContain('Allowed \\"documentType\\" values');
    expect(repairBody).toContain('Allowed \\"riskLevel\\" values');
  });

  it("throws a typed ProviderSchemaError when repair also fails, without contract text", async () => {
    process.env.CLAUSLY_AI_PROVIDER = "openai";
    vi.mocked(fetch).mockImplementation(() =>
      jsonResponse(openAIResponse(validResult({ documentType: "mystery" as never })))
    );

    const failure = await analyzeDocument(sampleInput).catch((error) => error);

    expect(failure).toBeInstanceOf(ProviderSchemaError);
    expect(failure.message).toMatch(/schema validation/i);
    expect(failure.message).toContain("documentType");
    expect(failure.message).not.toContain(sampleInput.text);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("still rejects unknown documentType after normalization and repair", async () => {
    process.env.CLAUSLY_AI_PROVIDER = "anthropic";
    vi.mocked(fetch).mockImplementation(() =>
      jsonResponse(anthropicResponse(validResult({ documentType: "mystery document" as never })))
    );

    await expect(analyzeDocument(sampleInput)).rejects.toThrow(/documentType/);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
