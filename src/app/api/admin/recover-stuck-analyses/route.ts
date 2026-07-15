import { NextResponse } from "next/server";
import {
  claimAnalysisAttempt,
  markAnalysisFailed,
  runClaimedAnalysis,
} from "@/lib/ai/run-analysis";
import {
  createServiceSupabaseClient,
  hasServiceSupabaseEnv,
  hasSupabaseEnv,
} from "@/lib/notifications/supabase-service";

// Vercel Cron invokes this on a schedule (see vercel.json) with
// Authorization: Bearer ${CRON_SECRET}; CLAUSLY_DISPATCH_SECRET is accepted
// too so it can also be triggered manually/externally, matching
// /api/notifications/dispatch's auth pattern.
const STUCK_THRESHOLD_MINUTES = 10;
const MAX_ANALYSIS_ATTEMPTS = 3;
const BATCH_SIZE = 20;

export const maxDuration = 300;

type StuckDocument = {
  id: string;
  user_id: string;
  analysis_attempts: number;
};

async function handle(request: Request) {
  const dispatchSecret = process.env.CLAUSLY_DISPATCH_SECRET;
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  const expected = [dispatchSecret, cronSecret].filter((value): value is string => Boolean(value));
  if (expected.length === 0 || !expected.some((secret) => authorization === `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }
  if (!hasServiceSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 503 });
  }

  const supabase = createServiceSupabaseClient();
  const cutoffIso = new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60_000).toISOString();

  const { data: stuck, error } = await supabase
    .from("documents")
    .select("id, user_id, analysis_attempts")
    .eq("status", "analyzing")
    .lt("analysis_started_at", cutoffIso)
    .order("analysis_started_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let retried = 0;
  let gaveUp = 0;
  let skipped = 0;

  for (const document of (stuck ?? []) as StuckDocument[]) {
    if (document.analysis_attempts < MAX_ANALYSIS_ATTEMPTS) {
      const claim = await claimAnalysisAttempt(supabase, document.id, document.user_id, {
        requireStaleSince: cutoffIso,
      });

      if (!claim.claimed) {
        // Something else (a manual reanalyze, or a previous sweep run)
        // already resolved this document since we listed it above.
        skipped += 1;
        continue;
      }

      retried += 1;
      try {
        await runClaimedAnalysis(supabase, document.user_id, claim.document, claim.attemptToken);
      } catch (recoveryError) {
        // runClaimedAnalysis already records the failure on the document
        // itself; this is just sweep-level visibility.
        console.warn("Stuck-analysis retry failed.", {
          documentId: document.id,
          message: recoveryError instanceof Error ? recoveryError.message : "Unknown recovery error.",
        });
      }
      continue;
    }

    // Exhausted retries — stop retrying and surface an actionable failed
    // state (the document detail page's "Re-analyze" button still works
    // from here). Guarded by the same attempt-token + status='analyzing'
    // fence as every other terminal write, so this is a no-op if the
    // document has moved on since the query above.
    await markAnalysisFailed(
      supabase,
      document.id,
      document.user_id,
      `Analysis did not complete after ${document.analysis_attempts} attempts.`,
      "stuck_timeout",
      document.analysis_attempts,
    );
    gaveUp += 1;
  }

  return NextResponse.json({ found: stuck?.length ?? 0, retried, gaveUp, skipped });
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}
