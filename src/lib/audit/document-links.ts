import "server-only";

import type { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type AuditEventDocumentRef = {
  resourceType: string;
  resourceId: string | null;
  metadata: Json;
};

/**
 * The document an audit event links to for its "View resource" link, if any.
 * `document`/`document_export` events point at the document directly via
 * `resource_id`; `document_share` events point at it via `metadata.documentId`.
 */
export function documentIdForEvent(event: AuditEventDocumentRef): string | null {
  if (event.resourceType === "document" || event.resourceType === "document_export") {
    return event.resourceId;
  }
  if (event.resourceType === "document_share") {
    if (!event.metadata || typeof event.metadata !== "object" || Array.isArray(event.metadata)) return null;
    const value = (event.metadata as Record<string, Json>).documentId;
    return typeof value === "string" ? value : null;
  }
  return null;
}

/**
 * Audit events outlive the documents they reference (no FK/cascade from
 * `audit_events.resource_id`), so a "View resource" link built from
 * `resource_id`/`metadata.documentId` alone can point at an already-deleted
 * document. This resolves which of the referenced document ids in a page of
 * events still exist, so the UI can drop the link instead of 404ing.
 */
export async function loadExistingDocumentIds(
  supabase: SupabaseServerClient,
  userId: string,
  events: AuditEventDocumentRef[]
): Promise<Set<string>> {
  const ids = Array.from(
    new Set(events.map(documentIdForEvent).filter((id): id is string => Boolean(id)))
  );
  if (ids.length === 0) return new Set();

  const { data, error } = await supabase
    .from("documents")
    .select("id")
    .eq("user_id", userId)
    .in("id", ids);

  if (error || !data) return new Set();
  return new Set(data.map((row) => row.id));
}
