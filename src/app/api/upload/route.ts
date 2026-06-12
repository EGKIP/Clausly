import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runAnalysis } from "@/lib/ai/run-analysis";
import { boundedTextSchema, validationIssues } from "@/lib/validation";
import { canUploadDocument } from "@/lib/billing/plan";

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const titleSchema = boundedTextSchema(1, 200);

function validateUpload(formData: FormData) {
  const rawFile = formData.get("file");
  const rawTitle = formData.get("title");
  const file = rawFile instanceof File ? rawFile : null;
  const fallbackTitle = file?.name.replace(/\.pdf$/i, "") ?? "";
  const title = String(rawTitle || fallbackTitle);
  const titleResult = titleSchema.safeParse(title);
  const issues: { path: string; message: string }[] = [];

  if (!titleResult.success) issues.push(...validationIssues(titleResult.error));
  if (!file) {
    issues.push({ path: "file", message: "Upload a PDF file." });
  } else {
    if (file.type !== "application/pdf") {
      issues.push({ path: "file", message: "Only PDF uploads are supported right now." });
    }
    if (file.size > MAX_FILE_BYTES) {
      issues.push({ path: "file", message: "PDF must be 25 MB or smaller." });
    }
  }

  if (issues.length > 0 || !file || !titleResult.success) {
    return { success: false as const, issues };
  }

  return { success: true as const, file, title: titleResult.data };
}

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const validation = validateUpload(formData);

  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid upload.", issues: validation.issues },
      { status: 400 }
    );
  }

  const { file, title } = validation;
  const uploadLimit = await canUploadDocument(supabase, user.id);
  if (!uploadLimit.allowed) {
    return NextResponse.json(
      {
        error: "Free plan is limited to 5 documents.",
        code: "PLAN_LIMIT_DOCUMENTS",
        current: uploadLimit.current,
        limit: uploadLimit.limit,
        plan: uploadLimit.plan,
      },
      { status: 402 }
    );
  }

  const id = crypto.randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storagePath = `${user.id}/${id}/${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, file, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: document, error: insertError } = await supabase
    .from("documents")
    .insert({
      id,
      user_id: user.id,
      title,
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type,
      file_size_bytes: file.size,
      status: "pending",
      document_type: "other",
      tags: ["Processing"],
    })
    .select("*")
    .single();

  if (insertError) {
    await supabase.storage.from("documents").remove([storagePath]);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  void runAnalysis(supabase, document.id, user.id).catch((error) => {
    console.error("Background document analysis failed.", {
      documentId: document.id,
      userId: user.id,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  });

  return NextResponse.json({ id: document.id, document }, { status: 201 });
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
