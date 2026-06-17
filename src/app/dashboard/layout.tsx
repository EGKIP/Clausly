import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/shell";
import { TourOverlay } from "@/components/onboarding/tour-overlay";
import { getTourState } from "@/lib/db/onboarding-tour";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Clausly — Workspace",
  description:
    "Your contract intelligence workspace. Documents, clauses, deadlines, reminders, all in one place.",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const showTour = await shouldShowTour();

  return (
    <DashboardShell>
      {children}
      {showTour && <TourOverlay />}
    </DashboardShell>
  );
}

async function shouldShowTour() {
  if (!hasSupabaseEnv()) return false;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  try {
    const [tourState, documentCount] = await Promise.all([
      getTourState(supabase, user.id),
      countUserDocuments(supabase, user.id),
    ]);
    return tourState.completedAt == null && documentCount >= 1;
  } catch {
    return false;
  }
}

async function countUserDocuments(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { count, error } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) return 0;
  return count ?? 0;
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
