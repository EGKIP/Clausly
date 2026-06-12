import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  db,
  resetSupabaseMock,
  seedDocument,
  seedUser,
  setSupabaseUser,
  storageCalls,
  userA,
} from "@/../tests/helpers/supabase";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => createSupabaseClient() }));

import { POST } from "../route";

function uploadRequest(file: File, title = "Uploaded lease") {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("title", title);
  return { formData: async () => formData } as Request;
}

describe("POST /api/upload", () => {
  beforeEach(() => resetSupabaseMock(userA));

  it("returns 401 when there is no session", async () => {
    setSupabaseUser(null);

    const response = await POST(uploadRequest(new File(["%PDF"], "lease.pdf", { type: "application/pdf" })));

    expect(response.status).toBe(401);
  });

  it("returns 400 on bad mime type", async () => {
    const response = await POST(uploadRequest(new File(["text"], "lease.txt", { type: "text/plain" })));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Invalid upload." });
  });

  it("returns 400 when the file exceeds the size limit", async () => {
    const oversized = new File([new Uint8Array(25 * 1024 * 1024 + 1)], "large.pdf", { type: "application/pdf" });

    const response = await POST(uploadRequest(oversized));

    expect(response.status).toBe(400);
  });

  it("stores the PDF and kicks off analysis for the session user", async () => {
    seedUser(userA, { subscription_tier: "free" });
    const file = new File(["%PDF-1.7"], "my lease.pdf", { type: "application/pdf" });

    const response = await POST(uploadRequest(file, "My Lease"));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.id).toBe(db().documents[0].id);
    expect(db().documents).toHaveLength(1);
    expect(db().documents[0]).toMatchObject({
      user_id: userA.id,
      title: "My Lease",
      status: "analyzing",
      document_type: "other",
    });
    expect(db().documents[0].storage_path).toMatch(new RegExp("^" + userA.id + "/"));
    expect(storageCalls().uploaded[0].path).toBe(db().documents[0].storage_path);
  });

  it("returns 402 when a free user is at the document limit", async () => {
    seedUser(userA, { subscription_tier: "free" });
    for (let index = 0; index < 5; index += 1) {
      seedDocument(userA, { id: `document-${index}` });
    }

    const response = await POST(uploadRequest(new File(["%PDF"], "lease.pdf", { type: "application/pdf" })));
    const body = await response.json();

    expect(response.status).toBe(402);
    expect(body).toMatchObject({
      error: "Free plan is limited to 5 documents.",
      code: "PLAN_LIMIT_DOCUMENTS",
      current: 5,
      limit: 5,
      plan: "free",
    });
    expect(storageCalls().uploaded).toHaveLength(0);
  });

  it("allows a free user under the document limit", async () => {
    seedUser(userA, { subscription_tier: "free" });
    for (let index = 0; index < 4; index += 1) {
      seedDocument(userA, { id: `document-${index}` });
    }

    const response = await POST(uploadRequest(new File(["%PDF"], "lease.pdf", { type: "application/pdf" })));

    expect(response.status).toBe(201);
    expect(storageCalls().uploaded).toHaveLength(1);
  });

  it("allows a pro user above the free document limit", async () => {
    seedUser(userA, { subscription_tier: "pro" });
    for (let index = 0; index < 100; index += 1) {
      seedDocument(userA, { id: `document-${index}` });
    }

    const response = await POST(uploadRequest(new File(["%PDF"], "lease.pdf", { type: "application/pdf" })));

    expect(response.status).toBe(201);
    expect(storageCalls().uploaded).toHaveLength(1);
  });
});
