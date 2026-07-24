import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { runAnalysis } from "@/lib/ai/run-analysis";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { auditRequestMetadata, recordAuditEvent } from "@/lib/audit/log";
import { boundedTextSchema, validationIssues } from "@/lib/validation";
import { canUploadDocument } from "@/lib/billing/plan";
import { isJpegSignature, isPdfSignature, isPngSignature, isZipSignature } from "@/lib/upload/pdf-signature";

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_PASTED_TEXT_CHARS = 250_000;
const titleSchema = boundedTextSchema(1, 200);
const pastedTextSchema = boundedTextSchema(100, MAX_PASTED_TEXT_CHARS);
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const SUPPORTED_FILE_COPY = "PDF, DOCX, TXT, PNG, or JPG uploads are supported.";

type UploadValidation =
  | { success: true; kind: "pdf" | "docx" | "text" | "image"; file: Blob; title: string; fileName: string; mimeType: string }
  | { success: false; issues: { path: string; message: string }[] };

// Extends how long Vercel keeps this function alive for the after() callback
// below. 300s fits the current Pro-tier maxDuration ceiling; raise toward
// 800s if Fluid Compute is enabled. Large scanned/OCR documents can still
// exceed this — the stuck-analysis recovery sweep (see
// /api/admin/recover-stuck-analyses) picks those up and retries them.
export const maxDuration = 300;

async function validateUpload(formData: FormData): Promise<UploadValidation> {
  const rawFile = formData.get("file");
  const rawTitle = formData.get("title");
  const rawSource = formData.get("source");
  const rawText = formData.get("text");
  const source = rawSource === "text" ? "text" : "pdf";
  const file = rawFile instanceof File ? rawFile : null;
  const pastedText = typeof rawText === "string" ? rawText : "";
  const fallbackTitle = source === "text" ? "Pasted contract" : file ? stripKnownExtension(file.name) : "";
  const title = String(rawTitle || fallbackTitle);
  const titleResult = titleSchema.safeParse(title);
  const issues: { path: string; message: string }[] = [];

  if (!titleResult.success) issues.push(...validationIssues(titleResult.error));

  if (source === "text") {
    const textResult = pastedTextSchema.safeParse(pastedText);
    if (!textResult.success) {
      issues.push(...validationIssues(textResult.error).map((issue) => ({
        ...issue,
        path: issue.path || "text",
        message: issue.message.includes("at least") || issue.message.includes(">=100")
          ? "Paste at least 100 characters of contract text."
          : issue.message,
      })));
    }

    if (issues.length > 0 || !titleResult.success || !textResult.success) {
      return { success: false, issues };
    }

    return {
      success: true,
      kind: "text",
      file: new Blob([textResult.data], { type: "text/plain" }),
      title: titleResult.data,
      fileName: `${slugifyFileBase(titleResult.data)}.txt`,
      mimeType: "text/plain",
    };
  }

  if (!file) {
    issues.push({ path: "file", message: "Upload a PDF file." });
  } else {
    if (file.size > MAX_FILE_BYTES) {
      issues.push({ path: "file", message: "Contract file must be 25 MB or smaller." });
    }
    if (file.size <= MAX_FILE_BYTES) {
      const fileType = await detectUploadFileType(file);
      if (!fileType) {
        issues.push({ path: "file", message: invalidFileTypeMessage(file) });
      } else if (issues.length === 0 && titleResult.success) {
        return {
          success: true,
          kind: fileType.kind,
          file,
          title: titleResult.data,
          fileName: file.name,
          mimeType: fileType.mimeType,
        };
      }
    }
  }

  if (issues.length > 0 || !file || !titleResult.success) {
    return { success: false as const, issues };
  }

  return { success: false, issues: [{ path: "file", message: SUPPORTED_FILE_COPY }] };
}

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const validation = await validateUpload(formData);

  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid upload.", issues: validation.issues },
      { status: 400 }
    );
  }

  const { file, title, fileName, mimeType } = validation;
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
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storagePath = `${user.id}/${id}/${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, file, {
      contentType: mimeType,
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
      file_name: fileName,
      mime_type: mimeType,
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

  try {
    await recordAuditEvent(supabase, {
      userId: user.id,
      action: AUDIT_ACTIONS.DOCUMENT_UPLOADED,
      resourceType: "document",
      resourceId: document.id,
      metadata: {
        title,
        fileName,
        fileSizeBytes: file.size,
        source: validation.kind,
        ...auditRequestMetadata(request),
      },
    });
  } catch {
    // Audit logging is best-effort; upload success remains the source of truth.
  }

  // Deferred via after() so Vercel keeps this function alive past the
  // response (up to maxDuration) instead of the analysis racing an instance
  // freeze/recycle as a bare detached promise. Uses the service-role client,
  // not the request-scoped cookie-bound one — by the time this callback
  // runs the response has already been sent, and runAnalysis already
  // enforces ownership explicitly via .eq('user_id', userId) on every write.
  after(async () => {
    try {
      await runAnalysis(createServiceSupabaseClient(), document.id, user.id);
    } catch (error) {
      console.error("Background document analysis failed.", {
        documentId: document.id,
        userId: user.id,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  return NextResponse.json({ id: document.id, document }, { status: 201 });
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function slugifyFileBase(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "pasted-contract";
}

async function detectUploadFileType(file: File) {
  const lowerName = file.name.toLowerCase();
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());

  if ((file.type === "application/pdf" || lowerName.endsWith(".pdf")) && isPdfSignature(bytes)) {
    return { kind: "pdf" as const, mimeType: "application/pdf" };
  }

  if ((file.type === DOCX_MIME || lowerName.endsWith(".docx")) && isZipSignature(bytes)) {
    return { kind: "docx" as const, mimeType: DOCX_MIME };
  }

  if ((file.type === "text/plain" || lowerName.endsWith(".txt")) && file.size > 0) {
    return { kind: "text" as const, mimeType: "text/plain" };
  }

  if ((file.type === "image/png" || lowerName.endsWith(".png")) && isPngSignature(bytes)) {
    return { kind: "image" as const, mimeType: "image/png" };
  }

  if ((file.type === "image/jpeg" || lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) && isJpegSignature(bytes)) {
    return { kind: "image" as const, mimeType: "image/jpeg" };
  }

  return null;
}

function stripKnownExtension(fileName: string) {
  return fileName.replace(/\.(pdf|docx|txt|png|jpe?g)$/i, "");
}

function invalidFileTypeMessage(file: File) {
  const lowerName = file.name.toLowerCase();
  if (file.type === "application/pdf" || lowerName.endsWith(".pdf")) {
    return "This file doesn't look like a valid PDF.";
  }
  if (file.type === DOCX_MIME || lowerName.endsWith(".docx")) {
    return "This file doesn't look like a valid DOCX document.";
  }
  if (file.type === "image/png" || lowerName.endsWith(".png")) {
    return "This file doesn't look like a valid PNG image.";
  }
  if (file.type === "image/jpeg" || lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) {
    return "This file doesn't look like a valid JPG image.";
  }
  return SUPPORTED_FILE_COPY;
}
