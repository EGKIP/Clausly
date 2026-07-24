import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  db,
  resetSupabaseMock,
  seedUser,
  userA,
} from "@/../tests/helpers/supabase";
import {
  getPreferences,
  normalizePreferences,
  updatePreferences,
} from "../notification-preferences";

vi.mock("server-only", () => ({}));

type PreferencesClient = Parameters<typeof getPreferences>[0];
const preferencesClient = () => createSupabaseClient() as unknown as PreferencesClient;

describe("notification preference helpers", () => {
  beforeEach(() => resetSupabaseMock(userA));

  it("defaults every email preference to true when settings are empty", async () => {
    seedUser(userA, { notification_preferences: {} });

    await expect(getPreferences(preferencesClient(), userA.id)).resolves.toEqual({
      email: true,
      reminders: true,
      weeklyDigest: true,
    });
    expect(normalizePreferences(null)).toEqual({
      email: true,
      reminders: true,
      weeklyDigest: true,
    });
  });

  it("maps stored snake_case weekly_digest to the UI shape", async () => {
    seedUser(userA, {
      notification_preferences: { email: false, reminders: true, weekly_digest: false },
    });

    await expect(getPreferences(preferencesClient(), userA.id)).resolves.toEqual({
      email: false,
      reminders: true,
      weeklyDigest: false,
    });
  });

  it("merges patches into existing JSONB without changing unspecified flags", async () => {
    seedUser(userA, {
      notification_preferences: {
        email: true,
        reminders: true,
        weekly_digest: true,
        welcome_email_sent_at: "2026-07-24T12:00:00.000Z",
      },
    });

    const preferences = await updatePreferences(preferencesClient(), userA.id, {
      reminders: false,
    });

    expect(preferences).toEqual({ email: true, reminders: false, weeklyDigest: true });
    expect(db().users[0].notification_preferences).toEqual({
      email: true,
      reminders: false,
      weekly_digest: true,
      welcome_email_sent_at: "2026-07-24T12:00:00.000Z",
    });
  });

  it("rejects stored unknown keys before updating", async () => {
    seedUser(userA, {
      notification_preferences: { email: true, sms: true },
    });

    await expect(updatePreferences(preferencesClient(), userA.id, { email: false }))
      .rejects
      .toThrow("Unsupported notification preference key: sms");
  });
});
