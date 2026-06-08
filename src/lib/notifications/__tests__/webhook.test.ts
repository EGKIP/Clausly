import { beforeEach, describe, expect, it, vi } from "vitest";
import { Webhook } from "svix";
import type { ServiceSupabaseClient } from "../supabase-service";
import { handleResendWebhook } from "../webhook";

type Row = Record<string, unknown>;
type TableName = "users" | "usage_metrics";

const store: Record<TableName, Row[]> = {
  users: [],
  usage_metrics: [],
};
const webhookSecret = "whsec_dGVzdF9zZWNyZXQ=";

vi.mock("../supabase-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../supabase-service")>();
  return {
    ...actual,
    createServiceSupabaseClient: () => createSupabaseMock(),
  };
});

describe("Resend webhook route signature verification", () => {
  beforeEach(() => {
    resetStore();
    process.env.RESEND_WEBHOOK_SECRET = webhookSecret;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
  });

  it("accepts a valid Svix signature", async () => {
    store.users.push({
      id: "user-1",
      email: "ada@clausly.test",
      notification_preferences: { email: true, version: 1 },
    });
    const { POST } = await import("@/app/api/notifications/webhook/route");
    const payload = JSON.stringify(eventPayload("evt-delivered", "email.delivered"));
    const response = await POST(signedRequest(payload));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      duplicate: false,
      event_id: "evt-delivered",
      type: "email.delivered",
    });
  });

  it("rejects an invalid Svix signature", async () => {
    const { POST } = await import("@/app/api/notifications/webhook/route");
    const payload = JSON.stringify(eventPayload("evt-invalid", "email.delivered"));
    const request = signedRequest(payload);
    request.headers.set("svix-signature", "v1,bad-signature");

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(store.usage_metrics).toHaveLength(0);
  });
});

describe("Resend webhook event handling", () => {
  beforeEach(() => {
    resetStore();
    process.env.RESEND_WEBHOOK_SECRET = webhookSecret;
    store.users.push({
      id: "user-1",
      email: "ada@clausly.test",
      notification_preferences: { email: true, version: 3, sms: true },
    });
  });

  it.each([
    ["email.delivered", "completed", true],
    ["email.delivery_delayed", "completed", true],
    ["email.opened", "completed", true],
    ["email.clicked", "completed", true],
    ["email.bounced", "failed", true],
  ])("logs %s with expected state", async (type, status, useBounce) => {
    await handleResendWebhook(
      JSON.stringify(eventPayload(`evt-${type}`, type, useBounce ? { bounce: { type: "soft" } } : undefined)),
      signedHeaders(JSON.stringify(eventPayload(`evt-${type}`, type, useBounce ? { bounce: { type: "soft" } } : undefined))),
      { supabase: createSupabaseMock(), secret: webhookSecret },
    );

    expect(store.usage_metrics).toEqual([
      expect.objectContaining({
        job_type: "email_webhook",
        provider: "resend",
        model: `evt-${type}`,
        status,
      }),
    ]);
    expect(store.users[0].notification_preferences).toMatchObject({ email: true, version: 3 });
  });

  it("disables email and bumps preference version for hard bounces", async () => {
    const payload = JSON.stringify(eventPayload("evt-hard-bounce", "email.bounced", { bounce: { type: "hard" } }));

    await handleResendWebhook(payload, signedHeaders(payload), {
      supabase: createSupabaseMock(),
      secret: webhookSecret,
    });

    expect(store.users[0].notification_preferences).toEqual({ email: false, version: 4, sms: true });
    expect(store.usage_metrics[0]).toMatchObject({
      job_type: "email_webhook",
      provider: "resend",
      model: "evt-hard-bounce",
      status: "failed",
    });
  });

  it("treats complaints like hard bounces", async () => {
    const payload = JSON.stringify(eventPayload("evt-complaint", "email.complained"));

    await handleResendWebhook(payload, signedHeaders(payload), {
      supabase: createSupabaseMock(),
      secret: webhookSecret,
    });

    expect(store.users[0].notification_preferences).toEqual({ email: false, version: 4, sms: true });
    expect(store.usage_metrics[0]).toMatchObject({ model: "evt-complaint", status: "failed" });
  });

  it("replaying the same event id is a no-op", async () => {
    const payload = JSON.stringify(eventPayload("evt-replay", "email.delivered"));
    const supabase = createSupabaseMock();

    const first = await handleResendWebhook(payload, signedHeaders(payload), { supabase, secret: webhookSecret });
    const second = await handleResendWebhook(payload, signedHeaders(payload), { supabase, secret: webhookSecret });

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(store.usage_metrics).toHaveLength(1);
  });

  it("does not log usage_metrics when no matching user is found", async () => {
    const payload = JSON.stringify(eventPayload("evt-orphan", "email.delivered", {}, ["stranger@example.com"]));

    const result = await handleResendWebhook(payload, signedHeaders(payload), {
      supabase: createSupabaseMock(),
      secret: webhookSecret,
    });

    expect(result.ok).toBe(true);
    expect(store.usage_metrics).toHaveLength(0);
  });
});

function eventPayload(id: string, type: string, data: Row = {}, to: string[] = ["ada@clausly.test"]) {
  return {
    id,
    type,
    created_at: "2026-06-08T15:00:00.000Z",
    data: {
      email_id: "email-1",
      to,
      ...data,
    },
  };
}

function signedRequest(payload: string) {
  return new Request("https://clausly.test/api/notifications/webhook", {
    method: "POST",
    headers: signedHeaders(payload),
    body: payload,
  });
}

function signedHeaders(payload: string) {
  const timestamp = new Date();
  const signature = new Webhook(webhookSecret).sign("msg_123", timestamp, payload);
  return {
    "svix-id": "msg_123",
    "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
    "svix-signature": signature,
  };
}

function resetStore() {
  store.users = [];
  store.usage_metrics = [];
}

function createSupabaseMock(): ServiceSupabaseClient {
  return {
    from(table: TableName) {
      return new Query(table);
    },
  } as unknown as ServiceSupabaseClient;
}

class Query {
  private filters: { column: string; value: unknown }[] = [];
  private payload: Row | null = null;
  private maxRows: number | null = null;
  private action: "select" | "update" | "insert" = "select";

  constructor(private table: TableName) {}

  select() {
    return this;
  }

  insert(payload: Row) {
    this.action = "insert";
    this.payload = payload;
    return this.execute();
  }

  update(payload: Row) {
    this.action = "update";
    this.payload = payload;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  limit(value: number) {
    this.maxRows = value;
    return this.execute();
  }

  single() {
    return this.execute(true);
  }

  then(resolve: (value: unknown) => void, reject?: (reason?: unknown) => void) {
    return this.execute().then(resolve, reject);
  }

  private async execute(single = false) {
    if (this.action === "insert") {
      store[this.table].push({ id: `${this.table}-${store[this.table].length + 1}`, ...this.payload });
      return { data: null, error: null };
    }

    if (this.action === "update") {
      const rows = this.filteredRows();
      for (const row of rows) Object.assign(row, this.payload);
      return { data: single ? rows[0] ?? null : rows, error: null };
    }

    const rows = this.filteredRows();
    const limitedRows = this.maxRows === null ? rows : rows.slice(0, this.maxRows);
    return { data: single ? limitedRows[0] ?? null : limitedRows, error: null };
  }

  private filteredRows() {
    return store[this.table].filter((row) => this.filters.every((filter) => row[filter.column] === filter.value));
  }
}
