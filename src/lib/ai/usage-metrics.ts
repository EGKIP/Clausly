import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type AnyClient = SupabaseClient<Database>;

type UsageMetricStatus = Database["public"]["Tables"]["usage_metrics"]["Insert"]["status"];

type RecordUsageInput = {
  userId: string;
  documentId?: string | null;
  provider?: string | null;
  model?: string | null;
  status: NonNullable<UsageMetricStatus>;
  inputTokenCount?: number;
  outputTokenCount?: number;
  errorMessage?: string | null;
};

export async function recordUsage(supabase: AnyClient, input: RecordUsageInput): Promise<void> {
  try {
    const { error } = await supabase.from("usage_metrics").insert({
      user_id: input.userId,
      document_id: input.documentId ?? null,
      job_type: "analysis",
      provider: input.provider ?? null,
      model: input.model ?? null,
      input_token_count: input.inputTokenCount ?? 0,
      output_token_count: input.outputTokenCount ?? 0,
      status: input.status,
      error_message: input.errorMessage ? truncate(input.errorMessage) : null,
    });
    if (error) throw error;
  } catch (error) {
    console.warn("Usage metrics insert failed.", sanitizeLogError(error));
  }
}

function truncate(message: string): string {
  return message.slice(0, 500);
}

function sanitizeLogError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 200);
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message.slice(0, 200);
  }
  return "Unknown usage metrics error.";
}
