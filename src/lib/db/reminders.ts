import "server-only";

import { createClient } from "@/lib/supabase/server";
import { reminders as mockReminders } from "@/lib/mock-reminders";
import { toUiReminder } from "./adapters";
import type { ReminderRow } from "./types";

export async function listReminders() {
  if (!hasSupabaseEnv()) return mockReminders;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reminders")
    .select("*, documents(title)")
    .neq("status", "ignored")
    .order("fire_on", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as ReminderRow[]).map(toUiReminder);
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
