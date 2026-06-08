import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnalysisDocument, runAnalysis } from "@/lib/ai/run-analysis";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const { document, error } = await getAnalysisDocument(supabase, id, user.id);

  if (error?.code === "PGRST116") {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  if (document.status === "analyzing") {
    return NextResponse.json({ error: "Already analyzing." }, { status: 409 });
  }
  if (document.status === "ready") {
    return NextResponse.json(
      { error: "Already analyzed. Delete and re-upload to re-run." },
      { status: 409 }
    );
  }

  try {
    const result = await runAnalysis(supabase, document.id, user.id, document);
    return NextResponse.json({ ok: true, ...result });
  } catch (analysisError) {
    const message = analysisError instanceof Error ? analysisError.message : "Document analysis failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
