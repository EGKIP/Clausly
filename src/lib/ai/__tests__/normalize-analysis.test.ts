import { describe, expect, it } from "vitest";
import {
  normalizeAnalysisPayload,
  normalizeDocumentType,
  normalizeRiskLevel,
  unwrapAnalysisObject,
} from "../normalize-analysis";

describe("normalizeDocumentType", () => {
  it("passes canonical values through, case-insensitively", () => {
    expect(normalizeDocumentType("lease")).toBe("lease");
    expect(normalizeDocumentType("NDA")).toBe("nda");
    expect(normalizeDocumentType("Other")).toBe("other");
  });

  it("maps common lease phrasings", () => {
    expect(normalizeDocumentType("Lease Agreement")).toBe("lease");
    expect(normalizeDocumentType("residential lease")).toBe("lease");
    expect(normalizeDocumentType("Commercial Lease Agreement")).toBe("lease");
    expect(normalizeDocumentType("rental agreement")).toBe("lease");
  });

  it("maps employment/consulting/contractor phrasings", () => {
    expect(normalizeDocumentType("Employment Agreement")).toBe("employment");
    expect(normalizeDocumentType("employment contract")).toBe("employment");
    expect(normalizeDocumentType("Consulting Agreement")).toBe("employment");
    expect(normalizeDocumentType("independent contractor agreement")).toBe("employment");
  });

  it("maps service/vendor/terms-of-service phrasings", () => {
    expect(normalizeDocumentType("Service Agreement")).toBe("service");
    expect(normalizeDocumentType("services agreement")).toBe("service");
    expect(normalizeDocumentType("Vendor Agreement")).toBe("service");
    expect(normalizeDocumentType("Terms of Service")).toBe("service");
  });

  it("maps NDA phrasings", () => {
    expect(normalizeDocumentType("Non-Disclosure Agreement")).toBe("nda");
    expect(normalizeDocumentType("confidentiality agreement")).toBe("nda");
  });

  it("maps auto/insurance phrasings", () => {
    expect(normalizeDocumentType("Auto Insurance Policy")).toBe("auto");
    expect(normalizeDocumentType("vehicle lease")).toBe("lease");
  });

  it("maps generic purchase/sales/contract phrasings to other", () => {
    expect(normalizeDocumentType("Purchase Agreement")).toBe("other");
    expect(normalizeDocumentType("sales agreement")).toBe("other");
    expect(normalizeDocumentType("General Contract")).toBe("other");
  });

  it("leaves unrecognized values untouched so they still fail validation", () => {
    expect(normalizeDocumentType("mystery document")).toBe("mystery document");
    expect(normalizeDocumentType("")).toBe("");
  });
});

describe("normalizeRiskLevel", () => {
  it("passes canonical values through, case-insensitively", () => {
    expect(normalizeRiskLevel("Low")).toBe("Low");
    expect(normalizeRiskLevel("LOW")).toBe("Low");
    expect(normalizeRiskLevel("needs review")).toBe("Needs Review");
  });

  it("maps '<level> risk' phrasings", () => {
    expect(normalizeRiskLevel("low risk")).toBe("Low");
    expect(normalizeRiskLevel("Medium Risk")).toBe("Medium");
    expect(normalizeRiskLevel("high risk")).toBe("High");
  });

  it("maps moderate/critical variants onto the closest canonical value", () => {
    expect(normalizeRiskLevel("moderate")).toBe("Medium");
    expect(normalizeRiskLevel("critical")).toBe("High");
    expect(normalizeRiskLevel("very high")).toBe("High");
  });

  it("leaves unrecognized values untouched so they still fail validation", () => {
    expect(normalizeRiskLevel("banana")).toBe("banana");
  });
});

describe("unwrapAnalysisObject", () => {
  it("unwraps a wrapper whose inner object looks like an analysis", () => {
    const inner = { documentTitle: "Lease", documentType: "lease" };
    expect(unwrapAnalysisObject({ analysis: inner })).toBe(inner);
    expect(unwrapAnalysisObject({ result: inner })).toBe(inner);
    expect(unwrapAnalysisObject({ data: inner })).toBe(inner);
    expect(unwrapAnalysisObject({ contractAnalysis: inner })).toBe(inner);
  });

  it("does not unwrap when the outer object is itself an analysis", () => {
    const outer = { documentTitle: "Lease", analysis: { documentTitle: "Nested" } };
    expect(unwrapAnalysisObject(outer)).toBe(outer);
  });

  it("does not unwrap wrappers whose inner value is not analysis-shaped", () => {
    const outer = { data: { rows: [1, 2, 3] } };
    expect(unwrapAnalysisObject(outer)).toBe(outer);
    expect(unwrapAnalysisObject({ result: "ok" })).toEqual({ result: "ok" });
  });

  it("passes non-objects through", () => {
    expect(unwrapAnalysisObject(null)).toBe(null);
    expect(unwrapAnalysisObject("text")).toBe("text");
    expect(unwrapAnalysisObject([1])).toEqual([1]);
  });
});

describe("normalizeAnalysisPayload", () => {
  it("normalizes root enums and clause-level risk levels", () => {
    const normalized = normalizeAnalysisPayload({
      documentTitle: "Lease",
      documentType: "Lease Agreement",
      riskLevel: "medium risk",
      clauses: [
        { title: "Termination", riskLevel: "HIGH RISK" },
        { title: "Payment", riskLevel: "Low" },
        "not-an-object",
      ],
    }) as Record<string, unknown>;

    expect(normalized.documentType).toBe("lease");
    expect(normalized.riskLevel).toBe("Medium");
    expect(normalized.clauses).toEqual([
      { title: "Termination", riskLevel: "High" },
      { title: "Payment", riskLevel: "Low" },
      "not-an-object",
    ]);
  });

  it("unwraps and then normalizes in one pass", () => {
    const normalized = normalizeAnalysisPayload({
      analysis: { documentTitle: "Lease", documentType: "rental agreement", riskLevel: "moderate" },
    }) as Record<string, unknown>;

    expect(normalized.documentType).toBe("lease");
    expect(normalized.riskLevel).toBe("Medium");
  });

  it("leaves non-string enum fields alone", () => {
    const payload = { documentTitle: "X", documentType: 4, riskLevel: null };
    expect(normalizeAnalysisPayload(payload)).toEqual(payload);
  });
});
