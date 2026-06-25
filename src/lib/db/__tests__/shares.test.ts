import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  db,
  failNext,
  resetSupabaseMock,
  seedDocument,
  seedDocumentShare,
  setSupabaseUser,
  userA,
  userB,
} from "@/../tests/helpers/supabase";
import {
  createShare,
  getShareByToken,
  incrementViewCount,
  listShares,
  revokeShare,
} from "../shares";

vi.mock("server-only", () => ({}));

type ShareClient = Parameters<typeof createShare>[0];
const shareClient = () => createSupabaseClient() as unknown as ShareClient;

describe("document share data helpers", () => {
  beforeEach(() => {
    resetSupabaseMock(userA);
    vi.setSystemTime(new Date("2026-06-10T12:00:00.000Z"));
  });

  it("creates a share with a 32-byte base64url token and expiry", async () => {
    const document = seedDocument(userA);

    const share = await createShare(shareClient(), {
      documentId: document.id,
      userId: userA.id,
      expiresInDays: 7,
    });

    expect(share).toMatchObject({
      documentId: document.id,
      userId: userA.id,
      expiresAt: "2026-06-17T12:00:00.000Z",
      revokedAt: null,
      viewCount: 0,
    });
    expect(share.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("creates a non-expiring share when no expiry is requested", async () => {
    const document = seedDocument(userA);

    const share = await createShare(shareClient(), {
      documentId: document.id,
      userId: userA.id,
    });

    expect(share.expiresAt).toBeNull();
  });

  it("lists shares for the requested owner and document in newest-first order", async () => {
    const document = seedDocument(userA);
    seedDocumentShare(document.id, userA, { id: "old", created_at: "2026-06-01T00:00:00.000Z" });
    seedDocumentShare(document.id, userA, { id: "new", created_at: "2026-06-02T00:00:00.000Z" });
    seedDocumentShare("other-doc", userA, { id: "other-doc-share" });
    seedDocumentShare(document.id, userB, { id: "other-user-share" });

    const shares = await listShares(shareClient(), document.id, userA.id);

    expect(shares.map((share) => share.id)).toEqual(["new", "old"]);
  });

  it("returns active shares by token and hides revoked or expired shares", async () => {
    const document = seedDocument(userA);
    seedDocumentShare(document.id, userA, { id: "active", token: "active-token" });
    seedDocumentShare(document.id, userA, {
      id: "revoked",
      token: "revoked-token",
      revoked_at: "2026-06-09T00:00:00.000Z",
    });
    seedDocumentShare(document.id, userA, {
      id: "expired",
      token: "expired-token",
      expires_at: "2026-06-09T00:00:00.000Z",
    });

    await expect(getShareByToken(shareClient(), "active-token")).resolves.toMatchObject({ id: "active" });
    await expect(getShareByToken(shareClient(), "revoked-token")).resolves.toBeNull();
    await expect(getShareByToken(shareClient(), "expired-token")).resolves.toBeNull();
    await expect(getShareByToken(shareClient(), "missing-token")).resolves.toBeNull();
  });

  it("revokes only shares owned by the caller", async () => {
    const document = seedDocument(userA);
    const share = seedDocumentShare(document.id, userA, { id: "share-1" });

    const revoked = await revokeShare(shareClient(), share.id, userA.id);

    expect(revoked).toMatchObject({ id: share.id });
    expect(revoked?.revokedAt).toBe("2026-06-10T12:00:00.000Z");

    setSupabaseUser(userB);
    await expect(revokeShare(shareClient(), share.id, userB.id)).resolves.toBeNull();
  });

  it("increments view count on a best-effort basis", async () => {
    const document = seedDocument(userA);
    const share = seedDocumentShare(document.id, userA, { id: "share-1", view_count: 2 });

    await incrementViewCount(shareClient(), share.id);

    expect(db().document_shares[0].view_count).toBe(3);
  });

  it("swallows view-count increment failures", async () => {
    const document = seedDocument(userA);
    const share = seedDocumentShare(document.id, userA, { id: "share-1", view_count: 2 });
    failNext("select", "document_shares", "View count unavailable.");

    await expect(incrementViewCount(shareClient(), share.id)).resolves.toBeUndefined();

    expect(db().document_shares[0].view_count).toBe(2);
  });
});
