import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  db,
  resetSupabaseMock,
  routeContext,
  seedClause,
  seedDate,
  seedDocument,
  seedDocumentExport,
  seedReminder,
  seedUser,
  setSupabaseEnv,
  setSupabaseUser,
  userA,
  userB,
} from "@/../tests/helpers/supabase";
import { renderDocumentPdf } from "@/lib/exports/pdf";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => createSupabaseClient() }));
vi.mock("@/lib/exports/pdf", () => ({
  renderDocumentPdf: vi.fn(async () => Buffer.from("%PDF-route-test\n")),
}));

import { GET } from "../route";

describe("GET /api/documents/[id]/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSupabaseMock(userA);
    seedUser(userA, { subscription_tier: "free" });
  });

  it("returns a canned PDF when Supabase is not configured", async () => {
    setSupabaseEnv(false);

    const response = await GET(
      new Request("http://localhost.test/api/documents/demo/export?format=pdf"),
      routeContext("demo")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain("demo.pdf");
    expect(Buffer.from(await response.arrayBuffer()).toString()).toContain("%PDF");
  });

  it("returns 401 when unauthenticated", async () => {
    setSupabaseUser(null);

    const response = await GET(
      new Request("http://localhost.test/api/documents/doc/export?format=pdf"),
      routeContext("doc")
    );

    expect(response.status).toBe(401);
  });

  it("returns 404 when the document is not owned by the caller", async () => {
    const other = seedDocument(userB);

    const response = await GET(
      new Request(`http://localhost.test/api/documents/${other.id}/export?format=pdf`),
      routeContext(other.id)
    );

    expect(response.status).toBe(404);
  });

  it("returns a PDF download and records an export audit row", async () => {
    const document = seedDocument(userA, { title: "Greenfield Lease" });
    seedClause(document.id, userA);
    seedDate(document.id, userA);
    seedReminder(document.id, userA, { status: "approved" });

    const response = await GET(
      new Request(`http://localhost.test/api/documents/${document.id}/export?format=pdf`),
      routeContext(document.id)
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain("greenfield-lease.pdf");
    expect(Buffer.from(await response.arrayBuffer()).toString()).toContain("%PDF-route-test");
    expect(renderDocumentPdf).toHaveBeenCalledWith(expect.objectContaining({
      document: expect.objectContaining({ title: "Greenfield Lease" }),
      clauses: expect.any(Array),
      dates: expect.any(Array),
      reminders: expect.any(Array),
    }));
    expect(db().document_exports).toEqual([
      expect.objectContaining({ user_id: userA.id, document_id: document.id, format: "pdf" }),
    ]);
  });

  it("returns a CSV zip download with clauses and dates files", async () => {
    const document = seedDocument(userA, { title: "Office Lease" });
    seedClause(document.id, userA, { title: "Payment, fees" });
    seedDate(document.id, userA, { label: "Notice deadline" });

    const response = await GET(
      new Request(`http://localhost.test/api/documents/${document.id}/export?format=csv`),
      routeContext(document.id)
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/zip");
    expect(response.headers.get("Content-Disposition")).toContain("office-lease-export.zip");
    const zip = await JSZip.loadAsync(Buffer.from(await response.arrayBuffer()));
    await expect(zip.file("clauses.csv")?.async("string")).resolves.toContain("Payment, fees");
    await expect(zip.file("dates.csv")?.async("string")).resolves.toContain("Notice deadline");
    expect(db().document_exports[0]).toMatchObject({ format: "csv" });
  });

  it("returns 429 when the free export budget is exhausted", async () => {
    const document = seedDocument(userA);
    for (let index = 0; index < 5; index += 1) {
      seedDocumentExport(document.id, userA, {
        id: `export-${index}`,
        created_at: new Date().toISOString(),
      });
    }

    const response = await GET(
      new Request(`http://localhost.test/api/documents/${document.id}/export?format=pdf`),
      routeContext(document.id)
    );
    const payload = await response.json();

    expect(response.status).toBe(429);
    expect(payload).toMatchObject({
      code: "EXPORT_RATE_LIMIT",
      used: 5,
      limit: 5,
      plan: "free",
    });
  });
});
