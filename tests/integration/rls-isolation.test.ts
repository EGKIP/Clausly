import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  db,
  jsonRequest,
  resetSupabaseMock,
  routeContext,
  seedUser,
  setSupabaseUser,
  userA,
  userB,
} from "@/../tests/helpers/supabase";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => createSupabaseClient() }));
vi.mock("server-only", () => ({}));

import { POST as uploadDocument } from "@/app/api/upload/route";
import { GET as getDocument } from "@/app/api/documents/[id]/route";
import { POST as createReminder } from "@/app/api/reminders/route";
import { PATCH as patchReminder } from "@/app/api/reminders/[id]/route";
import { GET as getProfile } from "@/app/api/profile/route";
import { POST as seedDemo } from "@/app/api/seed-demo/route";

function uploadRequest() {
  const formData = new FormData();
  formData.set("title", "Tenant A Lease");
  formData.set("file", new File(["%PDF-1.7"], "tenant-a.pdf", { type: "application/pdf" }));
  return { formData: async () => formData } as Request;
}

describe("route-level tenant isolation", () => {
  beforeEach(() => {
    resetSupabaseMock(userA);
    seedUser(userA, { full_name: "Ada A" });
    seedUser(userB, { full_name: "Ben B" });
  });

  it("hides userA uploaded documents from userB", async () => {
    const upload = await uploadDocument(uploadRequest());
    const { id } = await upload.json();

    setSupabaseUser(userB);
    const response = await getDocument(new Request("http://localhost.test"), routeContext(id));

    expect(response.status).toBe(404);
  });

  it("prevents userB from patching userA reminders", async () => {
    const upload = await uploadDocument(uploadRequest());
    const { id: documentId } = await upload.json();
    const created = await createReminder(jsonRequest({
      documentId,
      title: "Review renewal",
      description: "Review before renewal.",
      fireOn: "2026-11-01",
      type: "Review",
      channel: "Email",
    }));
    const { reminder } = await created.json();

    setSupabaseUser(userB);
    const response = await patchReminder(jsonRequest({ status: "approved" }, { method: "PATCH" }), routeContext(reminder.id));

    expect(response.status).toBe(404);
    expect(db().reminders.find((row) => row.id === reminder.id)?.status).toBe("suggested");
  });

  it("keeps userB portfolio unchanged when userA seeds demo data", async () => {
    await seedDemo();

    setSupabaseUser(userB);
    const visibleToUserB = db().documents.filter((row) => row.user_id === userB.id);

    expect(visibleToUserB).toHaveLength(0);
  });

  it("returns only the caller profile", async () => {
    const responseA = await getProfile();
    const bodyA = await responseA.json();

    setSupabaseUser(userB);
    const responseB = await getProfile();
    const bodyB = await responseB.json();

    expect(bodyA).toMatchObject({ displayName: "Ada A", email: userA.email });
    expect(bodyB).toMatchObject({ displayName: "Ben B", email: userB.email });
  });
});
