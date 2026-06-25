import "server-only";

import { randomBytes } from "node:crypto";
import type { Database } from "@/lib/supabase/types";

type ShareRow = Database["public"]["Tables"]["document_shares"]["Row"];
type ShareInsert = Database["public"]["Tables"]["document_shares"]["Insert"];
type ShareSupabaseClient = {
  from: (table: "document_shares") => {
    select: (columns?: string) => ShareQuery;
    insert: (payload: ShareInsert) => ShareQuery;
    update: (payload: Partial<ShareRow>) => ShareQuery;
  };
};
type ShareQueryResult = { data: unknown; error: SupabaseError | null };
type ShareQuery = PromiseLike<ShareQueryResult> & {
  select: (columns?: string) => ShareQuery;
  eq: (column: string, value: unknown) => ShareQuery;
  order: (column: string, options?: { ascending?: boolean }) => ShareQuery;
  single: () => Promise<ShareQueryResult>;
};
type SupabaseError = { code?: string; message: string };

export type DocumentShare = {
  id: string;
  documentId: string;
  userId: string;
  token: string;
  expiresAt: string | null;
  revokedAt: string | null;
  viewCount: number;
  createdAt: string;
};

export type CreateShareInput = {
  documentId: string;
  userId: string;
  expiresInDays?: number | null;
};

export function generateShareToken() {
  return randomBytes(32).toString("base64url");
}

export async function createShare(
  supabase: ShareSupabaseClient,
  input: CreateShareInput
) {
  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const { data, error } = await supabase
    .from("document_shares")
    .insert({
      document_id: input.documentId,
      user_id: input.userId,
      token: generateShareToken(),
      expires_at: expiresAt,
      revoked_at: null,
      view_count: 0,
    })
    .select("*")
    .single() as { data: ShareRow | null; error: SupabaseError | null };

  if (error) throw error;
  if (!data) throw new Error("Share creation returned no row.");
  return toDocumentShare(data);
}

export async function listShares(
  supabase: ShareSupabaseClient,
  documentId: string,
  userId: string
) {
  const { data, error } = await supabase
    .from("document_shares")
    .select("*")
    .eq("document_id", documentId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false }) as { data: ShareRow[] | null; error: SupabaseError | null };

  if (error) throw error;
  return (data ?? []).map(toDocumentShare);
}

export async function getShareByToken(
  supabase: ShareSupabaseClient,
  token: string
) {
  const { data, error } = await supabase
    .from("document_shares")
    .select("*")
    .eq("token", token)
    .single() as { data: ShareRow | null; error: SupabaseError | null };

  if (error?.code === "PGRST116") return null;
  if (error) throw error;
  if (!data || data.revoked_at || isExpired(data.expires_at)) return null;
  return toDocumentShare(data);
}

export async function revokeShare(
  supabase: ShareSupabaseClient,
  shareId: string,
  userId: string
) {
  const { data, error } = await supabase
    .from("document_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", shareId)
    .eq("user_id", userId)
    .single() as { data: ShareRow | null; error: SupabaseError | null };

  if (error?.code === "PGRST116") return null;
  if (error) throw error;
  return data ? toDocumentShare(data) : null;
}

export async function incrementViewCount(
  supabase: ShareSupabaseClient,
  shareId: string
) {
  try {
    const { data, error } = await supabase
      .from("document_shares")
      .select("*")
      .eq("id", shareId)
      .single() as { data: ShareRow | null; error: SupabaseError | null };

    if (error || !data) return;

    await supabase
      .from("document_shares")
      .update({ view_count: data.view_count + 1 })
      .eq("id", shareId);
  } catch {
    // Best-effort analytics must never block public share reads.
  }
}

function toDocumentShare(row: ShareRow): DocumentShare {
  return {
    id: row.id,
    documentId: row.document_id,
    userId: row.user_id,
    token: row.token,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    viewCount: row.view_count,
    createdAt: row.created_at,
  };
}

function isExpired(expiresAt: string | null) {
  return Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now());
}
