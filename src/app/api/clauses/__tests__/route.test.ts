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

  it("matches facet categories exactly as stored, including multi-word and hyphenated ones", async () => {
    const document = seedDocument(userA, { title: "MSA" });
    seedClause(document.id, userA, { title: "Cap", category: "Limitation of Liability" });
    seedClause(document.id, userA, { title: "Renewal", category: "Auto-Renewal" });
    seedClause(document.id, userA, { title: "IP", category: "IP" });
    seedClause(document.id, userA, { title: "Fee", category: "Payment" });

    const params = new URLSearchParams({ category: "Limitation of Liability,Auto-Renewal,IP" });
    const response = await GET(new Request(`http://localhost.test/api/clauses?${params.toString()}`));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.totalCount).toBe(3);
    expect(payload.clauses.map((clause: { title: string }) => clause.title).sort()).toEqual(["Cap", "IP", "Renewal"]);
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

  it("does not skip clauses that share a created_at across a page boundary", async () => {
    // One analysis inserts all of a document's clauses in a single statement,
    // so they share one created_at. The page boundary falls inside that batch.
    const document = seedDocument(userA);
    const batchAt = "2026-06-02T10:00:00.123456+00:00";
    for (const title of ["A", "B", "C", "D", "E"]) {
      seedClause(document.id, userA, { title, created_at: batchAt });
    }
    seedClause(document.id, userA, { title: "Older", created_at: "2026-06-01T00:00:00.000000+00:00" });

    const seen: string[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 10; page += 1) {
      const url: string = `http://localhost.test/api/clauses?limit=2${cursor ? `&cursor=${cursor}` : ""}`;
      const payload = await (await GET(new Request(url))).json();
      seen.push(...payload.clauses.map((clause: { title: string }) => clause.title));
      cursor = payload.nextCursor;
      if (!cursor) break;
    }

    expect(seen).toHaveLength(6);
    expect(new Set(seen)).toEqual(new Set(["A", "B", "C", "D", "E", "Older"]));
    expect(seen[seen.length - 1]).toBe("Older");
  });

  it("still accepts a cursor issued before the id tiebreaker", async () => {
    const document = seedDocument(userA);
    seedClause(document.id, userA, { title: "Newer", created_at: "2026-06-02T00:00:00.000Z" });
    seedClause(document.id, userA, { title: "Older", created_at: "2026-06-01T00:00:00.000Z" });
    const legacy = Buffer.from(JSON.stringify({ createdAt: "2026-06-02T00:00:00.000Z" })).toString("base64url");

    const payload = await (await GET(new Request(`http://localhost.test/api/clauses?cursor=${legacy}`))).json();

    expect(payload.clauses.map((clause: { title: string }) => clause.title)).toEqual(["Older"]);
  });

  it("rejects a cursor whose values could alter the filter", async () => {
    const forged = Buffer.from(JSON.stringify({
      createdAt: "2026-06-01T00:00:00Z\",user_id.neq.x",
      id: "00000000-0000-0000-0000-000000000000",
    })).toString("base64url");
    const badId = Buffer.from(JSON.stringify({ createdAt: "2026-06-01T00:00:00Z", id: "x),or(id.neq.y" })).toString("base64url");

    expect((await GET(new Request(`http://localhost.test/api/clauses?cursor=${forged}`))).status).toBe(400);
    expect((await GET(new Request(`http://localhost.test/api/clauses?cursor=${badId}`))).status).toBe(400);
  });

  it("searches text containing parentheses and quotes", async () => {
    const document = seedDocument(userA);
    seedClause(document.id, userA, { title: "Rent (monthly)", plain_english: "Pay rent.", source_quote: "Rent." });
    seedClause(document.id, userA, { title: "Deposit", plain_english: "Deposit.", source_quote: "Deposit." });

    const response = await GET(new Request(`http://localhost.test/api/clauses?q=${encodeURIComponent('rent (monthly)')}`));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.clauses.map((clause: { title: string }) => clause.title)).toEqual(["Rent (monthly)"]);
    expect((await GET(new Request(`http://localhost.test/api/clauses?q=${encodeURIComponent('"rent"')}`))).status).toBe(200);
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
