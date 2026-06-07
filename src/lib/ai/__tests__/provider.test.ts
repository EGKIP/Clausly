import { beforeEach, describe, expect, it } from "vitest";
import { analyzeDocument } from "../provider";
import { analysisResultSchema } from "../schema";

const sampleLease = {
  text: "This Lease Agreement is made between Landlord and Tenant on 2026-09-01. Rent is $1,500. Tenant must give 60 days notice. The lease term ends 2027-08-31.",
  fileName: "cedar-lease.pdf",
  title: "Cedar House Lease",
};

const sampleNda = {
  text: "This Non-Disclosure Agreement protects Confidential Information shared between the parties. Trade secret obligations survive for two years.",
  fileName: "pine-nda.pdf",
  title: "Pine Labs NDA",
};

describe("analyzeDocument (mock provider)", () => {
  beforeEach(() => {
    delete process.env.CLAUSLY_AI_PROVIDER;
  });

  it("returns a payload that conforms to analysisResultSchema", async () => {
    const result = await analyzeDocument(sampleLease);
    expect(() => analysisResultSchema.parse(result)).not.toThrow();
  });

  it("infers a lease from rent / tenant language", async () => {
    const result = await analyzeDocument(sampleLease);
    expect(result.documentType).toBe("lease");
    expect(result.tags).toContain("Lease");
    expect(result.noticeWindowDays).toBe(60);
  });

  it("infers an NDA from confidentiality language", async () => {
    const result = await analyzeDocument(sampleNda);
    expect(result.documentType).toBe("nda");
    expect(result.riskLevel).toBe("Needs Review");
  });

  it("is deterministic for identical inputs", async () => {
    const a = await analyzeDocument(sampleLease);
    const b = await analyzeDocument(sampleLease);
    expect(a).toEqual(b);
  });

  it("extracts ISO dates from the source text when available", async () => {
    const result = await analyzeDocument(sampleLease);
    expect(result.endDate).toBe("2027-08-31");
  });

  it("throws when a non-mock provider is configured but not implemented", async () => {
    process.env.CLAUSLY_AI_PROVIDER = "openai";
    await expect(analyzeDocument(sampleLease)).rejects.toThrow(/not implemented/i);
  });
});
