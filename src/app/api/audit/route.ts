import { NextResponse } from "next/server";
import { getUserPlan } from "@/lib/billing/plan";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

type AuditEventItem = {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Json;
  createdAt: string;
};

type AuditEventRow = {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Json;
  created_at: string;
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function GET(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const plan = await getUserPlan(supabase, user.id);
  if (plan !== "pro") {
    return NextResponse.json(
      {
        error: "Activity log is available on Pro.",
        code: "PLAN_REQUIRED",
        plan,
      },
      { status: 403 }
    );
  }

  const parsed = parseAuditQuery(new URL(request.url).searchParams);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  let query = supabase
    .from("audit_events")
    .select("id,action,resource_type,resource_id,metadata,created_at")
    .eq("user_id", user.id);

  if (parsed.cursor) query = query.lt("created_at", parsed.cursor.createdAt);

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(parsed.limit + 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = ((data ?? []) as AuditEventRow[]).slice(0, parsed.limit);
  const hasNextPage = (data ?? []).length > parsed.limit;
  const cursorRow = rows[rows.length - 1];

  return NextResponse.json({
    events: rows.map(toAuditEventItem),
    nextCursor: hasNextPage && cursorRow ? encodeCursor({ createdAt: cursorRow.created_at }) : null,
  });
}

function parseAuditQuery(searchParams: URLSearchParams): { limit: number; cursor: { createdAt: string } | null } | { error: string } {
  const limitValue = Number(searchParams.get("limit") ?? DEFAULT_LIMIT);
  if (!Number.isFinite(limitValue) || limitValue < 1) return { error: "Invalid limit." };

  const cursorValue = searchParams.get("cursor");
  const cursor = cursorValue ? decodeCursor(cursorValue) : null;
  if (cursorValue && !cursor) return { error: "Invalid cursor." };

  return {
    limit: Math.min(Math.floor(limitValue), MAX_LIMIT),
    cursor,
  };
}

function toAuditEventItem(row: AuditEventRow): AuditEventItem {
  return {
    id: row.id,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

function encodeCursor(cursor: { createdAt: string }) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(value: string): { createdAt: string } | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { createdAt?: unknown };
    if (typeof parsed.createdAt !== "string") return null;
    return { createdAt: parsed.createdAt };
  } catch {
    return null;
  }
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
