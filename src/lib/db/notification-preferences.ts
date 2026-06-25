import "server-only";

export type EmailNotificationPreferences = {
  email: boolean;
  reminders: boolean;
  weeklyDigest: boolean;
};

type NotificationPreferencesPatch = Partial<EmailNotificationPreferences>;
type NotificationPreferencesStoredPatch = {
  email?: boolean;
  reminders?: boolean;
  weekly_digest?: boolean;
};
type NotificationPreferencesClient = {
  from: (table: "users") => {
    select: (columns?: string) => NotificationPreferencesQuery;
    update: (payload: { notification_preferences: Record<string, unknown> }) => NotificationPreferencesQuery;
  };
};
type NotificationPreferencesQueryResult = {
  data: unknown;
  error: { code?: string; message: string } | null;
};
type NotificationPreferencesQuery = PromiseLike<NotificationPreferencesQueryResult> & {
  select: (columns?: string) => NotificationPreferencesQuery;
  eq: (column: string, value: unknown) => NotificationPreferencesQuery;
  single: () => Promise<NotificationPreferencesQueryResult>;
};

const allowedStoredKeys = new Set(["email", "reminders", "weekly_digest"]);
const defaults: EmailNotificationPreferences = {
  email: true,
  reminders: true,
  weeklyDigest: true,
};

export async function getPreferences(
  supabase: NotificationPreferencesClient,
  userId: string
) {
  const { data, error } = await supabase
    .from("users")
    .select("notification_preferences")
    .eq("id", userId)
    .single() as { data: { notification_preferences: unknown } | null; error: { message: string } | null };

  if (error) throw error;
  return normalizePreferences(data?.notification_preferences);
}

export async function updatePreferences(
  supabase: NotificationPreferencesClient,
  userId: string,
  patch: NotificationPreferencesPatch
) {
  const currentStored = await getStoredPreferences(supabase, userId);
  assertAllowedStoredKeys(currentStored);
  const nextStored = {
    ...currentStored,
    ...toStoredPatch(patch),
  };

  const { data, error } = await supabase
    .from("users")
    .update({ notification_preferences: nextStored })
    .eq("id", userId)
    .select("notification_preferences")
    .single() as { data: { notification_preferences: unknown } | null; error: { message: string } | null };

  if (error) throw error;
  return normalizePreferences(data?.notification_preferences);
}

export function normalizePreferences(value: unknown): EmailNotificationPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
  const stored = value as Record<string, unknown>;
  return {
    email: typeof stored.email === "boolean" ? stored.email : defaults.email,
    reminders: typeof stored.reminders === "boolean" ? stored.reminders : defaults.reminders,
    weeklyDigest: typeof stored.weekly_digest === "boolean" ? stored.weekly_digest : defaults.weeklyDigest,
  };
}

async function getStoredPreferences(
  supabase: NotificationPreferencesClient,
  userId: string
) {
  const { data, error } = await supabase
    .from("users")
    .select("notification_preferences")
    .eq("id", userId)
    .single() as { data: { notification_preferences: unknown } | null; error: { message: string } | null };

  if (error) throw error;
  const value = data?.notification_preferences;
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
}

function toStoredPatch(patch: NotificationPreferencesPatch): NotificationPreferencesStoredPatch {
  const stored: NotificationPreferencesStoredPatch = {};
  if (patch.email !== undefined) stored.email = patch.email;
  if (patch.reminders !== undefined) stored.reminders = patch.reminders;
  if (patch.weeklyDigest !== undefined) stored.weekly_digest = patch.weeklyDigest;
  return stored;
}

function assertAllowedStoredKeys(value: Record<string, unknown>) {
  const unknownKeys = Object.keys(value).filter((key) => !allowedStoredKeys.has(key));
  if (unknownKeys.length > 0) {
    throw new Error(`Unsupported notification preference key: ${unknownKeys[0]}`);
  }
}
