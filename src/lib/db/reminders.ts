import "server-only";

import { createClient } from "@/lib/supabase/server";
import { reminders as mockReminders } from "@/lib/mock-reminders";
import { toUiReminder } from "./adapters";
import type { ReminderRow } from "./types";

// RLS already scopes `reminders` to `auth.uid() = user_id`; the explicit
// `.eq("user_id", ...)` below is defense-in-depth against a future RLS
// regression, not the only guard.
export async function listReminders() {
  if (!hasSupabaseEnv()) return mockReminders;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let query = supabase
    .from("reminders")
    .select("*, documents(title)")
    .neq("status", "ignored")
    .order("fire_on", { ascending: true });
  if (user) query = query.eq("user_id", user.id);
  const { data, error } = await query;

  if (error) throw error;
  return ((data ?? []) as ReminderRow[]).map(toUiReminder);
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
