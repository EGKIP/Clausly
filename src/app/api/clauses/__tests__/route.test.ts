import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  resetSupabaseMock,
  seedClause,
  seedDocument,
  setSupabaseEnv,
  setSupabaseUser,
  userA,
  userB,
} from "@/../tests/helpers/supabase";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => createSupabaseClient() }));

import { GET } from "../route";

describe("GET /api/clauses", () => {
  beforeEach(() => resetSupabaseMock(userA));

  it("returns 401 when unauthenticated", async () => {
    setSupabaseUser(null);

    const response = await GET(new Request("http://localhost.test/api/clauses"));

    expect(response.status).toBe(401);
  });

  it("returns canned clauses in mock mode", async () => {
    setSupabaseEnv(false);

    const response = await GET(new Request("http://localhost.test/api/clauses"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.clauses).toHaveLength(3);
    expect(payload.totalCount).toBe(3);
    expect(payload.nextCursor).toBeNull();
  });

  it("searches title, plain English, and source quote", async () => {
    const document = seedDocument(userA, { title: "Greenfield Lease" });
    seedClause(document.id, userA, {
      title: "Early exit",
      plain_english: "Leaving early triggers a termination payment.",
      source_quote: "Tenant may terminate early.",
    });
    seedClause(document.id, userA, {
      title: "Security deposit",
      plain_english: "The deposit returns after move-out.",
      source_quote: "Deposit shall be returned.",
    });

    const response = await GET(new Request("http://localhost.test/api/clauses?q=termination"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.clauses).toHaveLength(1);
    expect(payload.clauses[0]).toMatchObject({
      title: "Early exit",
      documentTitle: "Greenfield Lease",
    });
  });

  it("filters by category, risk, and document id", async () => {
    const lease = seedDocument(userA, { title: "Lease" });
    const nda = seedDocument(userA, { title: "NDA" });
    seedClause(lease.id, userA, { title: "Auto-renewal", category: "Renewal", risk_level: "high" });
    seedClause(lease.id, userA, { title: "Late fee", category: "Payment", risk_level: "medium" });
    seedClause(nda.id, userA, { title: "Confidentiality", category: "Privacy", risk_level: "high" });

    const response = await GET(new Request(
      `http://localhost.test/api/clauses?category=renewal,privacy&risk=high&documentId=${lease.id}`
    ));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.clauses).toHaveLength(1);
    expect(payload.clauses[0]).toMatchObject({ title: "Auto-renewal", riskLevel: "high" });
  });

  it("paginates with an opaque created_at cursor", async () => {
    const document = seedDocument(userA);
    seedClause(document.id, userA, { title: "Newest", created_at: "2026-06-03T00:00:00.000Z" });
    seedClause(document.id, userA, { title: "Middle", created_at: "2026-06-02T00:00:00.000Z" });
    seedClause(document.id, userA, { title: "Oldest", created_at: "2026-06-01T00:00:00.000Z" });

    const first = await GET(new Request("http://localhost.test/api/clauses?limit=2"));
    const firstPayload = await first.json();

    expect(firstPayload.clauses.map((clause: { title: string }) => clause.title)).toEqual(["Newest", "Middle"]);
    expect(firstPayload.totalCount).toBe(3);
    expect(firstPayload.nextCursor).toEqual(expect.any(String));

    const second = await GET(new Request(`http://localhost.test/api/clauses?limit=2&cursor=${firstPayload.nextCursor}`));
    const secondPayload = await second.json();

    expect(secondPayload.clauses.map((clause: { title: string }) => clause.title)).toEqual(["Oldest"]);
    expect(secondPayload.nextCursor).toBeNull();
  });

  it("does not leak clauses from another user", async () => {
    const owned = seedDocument(userA, { title: "Owned Lease" });
    const other = seedDocument(userB, { title: "Other Lease" });
    seedClause(owned.id, userA, { title: "Owned clause", risk_level: "medium" });
    seedClause(other.id, userB, { title: "Other high clause", risk_level: "high" });

    const response = await GET(new Request("http://localhost.test/api/clauses?risk=high,medium"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.clauses).toHaveLength(1);
    expect(payload.clauses[0]).toMatchObject({ title: "Owned clause", documentTitle: "Owned Lease" });
  });
});
