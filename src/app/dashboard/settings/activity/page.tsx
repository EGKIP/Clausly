import { History, Sparkles } from "lucide-react";
import { ActivityTimeline, type AuditTimelineEvent } from "@/components/dashboard/audit/activity-timeline";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/primitives";
import { getUserPlan } from "@/lib/billing/plan";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

type AuditEventRow = {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Json;
  created_at: string;
};

const FIRST_PAGE_LIMIT = 50;

export default async function ActivityPage() {
  const audit = await getInitialAuditEvents();

  if (audit.kind === "upgrade") {
    return (
      <PageBody className="max-w-[980px]">
        <PageHeader
          eyebrow="Settings · Activity"
          title="Activity log"
          description="A private trail of significant changes across your Clausly account."
        />
        <ActivityUpgradeCard />
      </PageBody>
    );
  }

  return (
    <PageBody className="max-w-[980px]">
      <PageHeader
        eyebrow="Settings · Activity"
        title="Activity log"
        description="Uploads, shares, reminders, billing changes, and other write actions, newest first."
      />
      <ActivityTimeline initialEvents={audit.events} initialNextCursor={audit.nextCursor} />
    </PageBody>
  );
}

async function getInitialAuditEvents(): Promise<
  | { kind: "upgrade" }
  | { kind: "events"; events: AuditTimelineEvent[]; nextCursor: string | null }
> {
  if (!hasSupabaseEnv()) return { kind: "upgrade" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { kind: "upgrade" };

  const plan = await getUserPlan(supabase, user.id);
  if (plan !== "pro") return { kind: "upgrade" };

  const { data, error } = await supabase
    .from("audit_events")
    .select("id,action,resource_type,resource_id,metadata,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(FIRST_PAGE_LIMIT + 1);

  if (error) {
    console.warn("Activity log could not be loaded.", {
      userId: user.id,
      message: error.message,
    });
    return { kind: "events", events: [], nextCursor: null };
  }

  const rows = ((data ?? []) as AuditEventRow[]).slice(0, FIRST_PAGE_LIMIT);
  const hasNextPage = (data ?? []).length > FIRST_PAGE_LIMIT;
  const cursorRow = rows[rows.length - 1];

  return {
    kind: "events",
    events: rows.map(toTimelineEvent),
    nextCursor: hasNextPage && cursorRow ? encodeCursor({ createdAt: cursorRow.created_at }) : null,
  };
}

function ActivityUpgradeCard() {
  return (
    <Card className="mt-8 overflow-hidden p-6 sm:p-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <Badge tone="iris">
            <Sparkles className="size-2.5" /> Pro · Activity
          </Badge>
          <h2 className="mt-5 font-serif text-[clamp(2rem,4vw,3.25rem)] leading-[1.02] tracking-[-0.01em]">
            Review every important account change.
          </h2>
          <p className="mt-4 text-[14px] leading-relaxed text-[var(--muted)]">
            Activity logs help Pro workspaces understand when documents were uploaded,
            reminders were approved, shares were created, and billing changed.
          </p>
        </div>
        <Button href="/dashboard/settings#billing" variant="primary" size="md" className="min-h-11 w-full sm:w-auto">
          <History className="size-3.5" />
          Upgrade to Pro
        </Button>
      </div>
    </Card>
  );
}

function toTimelineEvent(row: AuditEventRow): AuditTimelineEvent {
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

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
