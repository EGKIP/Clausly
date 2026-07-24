import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/shell";
import { TourOverlay } from "@/components/onboarding/tour-overlay";
import type { PlanName } from "@/lib/billing/limits";
import { getUserPlan } from "@/lib/billing/plan";
import { getTourState } from "@/lib/db/onboarding-tour";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Clausly workspace",
  description:
    "Your contract intelligence workspace. Documents, clauses, deadlines, reminders, all in one place.",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { showTour, plan } = await getDashboardShellState();

  return (
    <DashboardShell plan={plan}>
      {children}
      {showTour && <TourOverlay />}
    </DashboardShell>
  );
}

async function getDashboardShellState(): Promise<{ showTour: boolean; plan: PlanName }> {
  if (!hasSupabaseEnv()) return { showTour: false, plan: "free" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { showTour: false, plan: "free" };

  try {
    const [tourState, documentCount, plan] = await Promise.all([
      getTourState(supabase, user.id),
      countUserDocuments(supabase, user.id),
      getUserPlan(supabase, user.id),
    ]);
    return { showTour: tourState.completedAt == null && documentCount >= 1, plan };
  } catch {
    return { showTour: false, plan: "free" };
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
