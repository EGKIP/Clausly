import "server-only";

export type OnboardingTourState = {
  completedAt: string | null;
};

type UserTourRow = {
  onboarding_tour_completed_at: string | null;
};

type QueryResult<T> = {
  data: T | null;
  error: { message: string; code?: string } | null;
};

type UserQuery<T> = PromiseLike<QueryResult<T>> & {
  eq(column: string, value: unknown): UserQuery<T>;
  select(columns?: string): UserQuery<T>;
  single(): PromiseLike<QueryResult<T extends Array<infer U> ? U : T>>;
};

type UsersTable = {
  select(columns?: string): UserQuery<UserTourRow[]>;
  update(payload: Record<string, unknown>): UserQuery<UserTourRow[]>;
};

type SupabaseLike = {
  from(table: "users"): UsersTable;
};

export async function getTourState(supabase: unknown, userId: string): Promise<OnboardingTourState> {
  const db = supabase as SupabaseLike;
  const { data, error } = await db
    .from("users")
    .select("onboarding_tour_completed_at")
    .eq("id", userId)
    .single();

  if (error?.code === "PGRST116") return { completedAt: null };
  if (error) throw new Error(error.message);

  return { completedAt: data?.onboarding_tour_completed_at ?? null };
}

export async function markTourComplete(supabase: unknown, userId: string): Promise<OnboardingTourState> {
  const db = supabase as SupabaseLike;
  const completedAt = new Date().toISOString();
  const { data, error } = await db
    .from("users")
    .update({ onboarding_tour_completed_at: completedAt })
    .eq("id", userId)
    .select("onboarding_tour_completed_at")
    .single();

  if (error) throw new Error(error.message);

  return { completedAt: data?.onboarding_tour_completed_at ?? completedAt };
}
