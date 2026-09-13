import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  resetSupabaseMock,
  seedClause,
  seedDate,
  seedDocument,
  seedDocumentShare,
  seedReminder,
  userA,
} from "@/../tests/helpers/supabase";
import { getPublicShareDigest } from "../share-digest";

vi.mock("server-only", () => ({}));

type ShareDigestClient = Parameters<typeof getPublicShareDigest>[0];
const shareDigestClient = () => createSupabaseClient() as unknown as ShareDigestClient;

describe("getPublicShareDigest", () => {
  beforeEach(() => {
    resetSupabaseMock(userA);
  });

  it("returns null for an unknown token", async () => {
    await expect(getPublicShareDigest(shareDigestClient(), "missing-token")).resolves.toBeNull();
  });

  it("includes clauses and dates for the shared document", async () => {
    const document = seedDocument(userA);
    seedClause(document.id, userA);
    seedDate(document.id, userA);
    const share = seedDocumentShare(document.id, userA, { token: "share-token" });

    const digest = await getPublicShareDigest(shareDigestClient(), share.token);

    expect(digest?.document.title).toBe(document.title);
    expect(digest?.clauses).toHaveLength(1);
    expect(digest?.document.dates).toHaveLength(1);
  });

  it("only surfaces approved or sent reminders as recommended actions, never suggested or ignored ones", async () => {
    const document = seedDocument(userA);
    seedReminder(document.id, userA, { id: "r-suggested", status: "suggested", title: "Unreviewed suggestion" });
    seedReminder(document.id, userA, { id: "r-ignored", status: "ignored", title: "Dismissed by owner" });
    seedReminder(document.id, userA, { id: "r-approved", status: "approved", title: "Approved reminder" });
    seedReminder(document.id, userA, { id: "r-sent", status: "sent", title: "Already sent reminder" });
    const share = seedDocumentShare(document.id, userA, { token: "share-token" });

    const digest = await getPublicShareDigest(shareDigestClient(), share.token);

    expect(digest?.recommendedActions.map((action) => action.id).sort()).toEqual(["r-approved", "r-sent"]);
  });
});
