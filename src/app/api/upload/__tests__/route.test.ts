import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseClient, db, resetSupabaseMock, setSupabaseUser, storageCalls, userA } from "@/../tests/helpers/supabase";

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
});
