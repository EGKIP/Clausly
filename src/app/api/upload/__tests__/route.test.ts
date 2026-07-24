// @vitest-environment node
//
// This route runs in the Node.js server runtime, not a browser/DOM one. The
// project's default jsdom test environment provides its own File/Blob shim
// that (unlike Node's real, undici-backed File/Blob) doesn't implement
// arrayBuffer() — overriding to the node environment here exercises the same
// File/Blob implementation this route actually runs against in production.
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createServiceSupabaseClientMock,
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
vi.mock("@/lib/supabase/service", () => ({ createServiceSupabaseClient: () => createServiceSupabaseClientMock() }));
// after() requires Next's request-scope context, which direct unit-test
// calls to route handlers don't set up — run the callback immediately
// instead, mirroring after()'s "runs once the response is on its way" intent
// closely enough for these tests (see the upload route's real usage for the
// production execution-extension behavior this stands in for).
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: (callback: () => unknown) => { void callback(); } };
});

import { POST } from "../route";

function uploadRequest(file: File, title = "Uploaded lease") {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("title", title);
  return { formData: async () => formData } as Request;
}

function pastedTextRequest(text: string, title = "Copied lease") {
  const formData = new FormData();
  formData.set("source", "text");
  formData.set("title", title);
  formData.set("text", text);
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
    const response = await POST(uploadRequest(new File(["binary"], "lease.exe", { type: "application/octet-stream" })));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Invalid upload." });
  });

  it("returns 400 when the file claims to be a PDF but isn't", async () => {
    const spoofed = new File(["not actually a pdf"], "lease.pdf", { type: "application/pdf" });

    const response = await POST(uploadRequest(spoofed));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.issues).toContainEqual({ path: "file", message: "This file doesn't look like a valid PDF." });
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
      document_type: "other",
    });
    expect(db().documents[0].storage_path).toMatch(new RegExp("^" + userA.id + "/"));
    expect(storageCalls().uploaded[0].path).toBe(db().documents[0].storage_path);

    // Analysis is deferred through after(). In this unit-test shim the
    // callback runs immediately, so the document may already be ready/failed
    // by the time the response assertion runs; the important contract here is
    // that upload claimed an analysis attempt for the new document.
    await vi.waitFor(() => expect(db().documents[0].analysis_attempts).toBe(1));
    expect(["analyzing", "ready", "failed"]).toContain(db().documents[0].status);
  });

  it("stores pasted contract text and kicks off analysis", async () => {
    seedUser(userA, { subscription_tier: "free" });
    const text = "Residential lease agreement. ".repeat(12);

    const response = await POST(pastedTextRequest(text, "Portal lease"));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.id).toBe(db().documents[0].id);
    expect(db().documents[0]).toMatchObject({
      user_id: userA.id,
      title: "Portal lease",
      file_name: "portal-lease.txt",
      mime_type: "text/plain",
      document_type: "other",
    });
    expect(storageCalls().uploaded[0]).toMatchObject({
      path: db().documents[0].storage_path,
      options: { contentType: "text/plain", upsert: false },
    });
    await vi.waitFor(() => expect(db().documents[0].analysis_attempts).toBe(1));
    expect(["analyzing", "ready", "failed"]).toContain(db().documents[0].status);
  });

  it("accepts DOCX uploads by signature", async () => {
    seedUser(userA, { subscription_tier: "free" });
    const docx = new File(["PK\x03\x04fake-docx"], "service agreement.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const response = await POST(uploadRequest(docx, "Service agreement"));

    expect(response.status).toBe(201);
    expect(db().documents[0]).toMatchObject({
      file_name: "service agreement.docx",
      mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      title: "Service agreement",
    });
    expect(storageCalls().uploaded[0]).toMatchObject({
      options: {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: false,
      },
    });
  });

  it("accepts image uploads for OCR analysis", async () => {
    seedUser(userA, { subscription_tier: "free" });
    const png = new File([
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ], "scan.png", { type: "image/png" });

    const response = await POST(uploadRequest(png, "Scanned lease"));

    expect(response.status).toBe(201);
    expect(db().documents[0]).toMatchObject({
      file_name: "scan.png",
      mime_type: "image/png",
      title: "Scanned lease",
    });
    expect(storageCalls().uploaded[0]).toMatchObject({
      options: { contentType: "image/png", upsert: false },
    });
  });

  it("returns 400 when pasted contract text is too short", async () => {
    const response = await POST(pastedTextRequest("too short"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.issues).toContainEqual({ path: "text", message: "Paste at least 100 characters of contract text." });
    expect(storageCalls().uploaded).toHaveLength(0);
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
