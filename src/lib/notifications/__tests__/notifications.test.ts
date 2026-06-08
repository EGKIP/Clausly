import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EmailProvider, EmailMessage } from "../email-provider";
import { ResendEmailProvider } from "../email-provider";
import {
  buildUnsubscribeUrl,
  dispatchDueReminderEmails,
  unsubscribeUserEmail,
} from "../dispatch";
import type { DispatchOptions } from "../dispatch";
import {
  createUnsubscribeToken,
  renderReminderEmail,
} from "../templates";

type Row = Record<string, unknown>;
type TableName = "users" | "documents" | "reminders" | "usage_metrics";

const store: Record<TableName, Row[]> = {
  users: [],
  documents: [],
  reminders: [],
  usage_metrics: [],
};

const sentMessages: EmailMessage[] = [];

class MockProvider implements EmailProvider {
  async send(message: EmailMessage) {
    sentMessages.push(message);
    return { id: `email-${sentMessages.length}` };
  }
}

import { POST } from "@/app/api/notifications/dispatch/route";

describe("notification dispatch", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
    process.env.CLAUSLY_DISPATCH_SECRET = "dispatch-secret";
    resetStore();
  });

  it("rejects unauthorized dispatch requests", async () => {
    const response = await POST(new Request("https://clausly.test/api/notifications/dispatch", { method: "POST" }));

    expect(response.status).toBe(401);
    expect(sentMessages).toHaveLength(0);
  });

  it("dispatches due reminders idempotently across double runs", async () => {
    seedDueReminder();

    const options = {
      supabase: createSupabaseMock(),
      provider: new MockProvider(),
      baseUrl: "https://clausly.test",
      from: "Clausly <reminders@clausly.test>",
      unsubscribeSecret: "unsubscribe-secret",
      now: new Date("2026-06-08T15:00:00.000Z"),
    };
    const first = await dispatchDueReminderEmails(options);
    const second = await dispatchDueReminderEmails(options);

    expect(first).toMatchObject({ processed: 1, sent: 1, skipped: 0, failed: 0 });
    expect(second).toMatchObject({ processed: 0, sent: 0, skipped: 0, failed: 0 });
    expect(sentMessages).toHaveLength(1);
    expect(store.reminders[0].sent_at).toEqual(expect.any(String));
    expect(store.reminders[0].status).toBe("sent");
  });

  it("skips users who disabled email notifications", async () => {
    seedDueReminder({ user: { notification_preferences: { email: false } } });

    const result = await dispatchDueReminderEmails({
      supabase: createSupabaseMock(),
      provider: new MockProvider(),
      baseUrl: "https://clausly.test",
      from: "Clausly <reminders@clausly.test>",
      unsubscribeSecret: "unsubscribe-secret",
      now: new Date("2026-06-08T15:00:00.000Z"),
    });

    expect(result).toMatchObject({ processed: 1, sent: 0, skipped: 1, failed: 0 });
    expect(sentMessages).toHaveLength(0);
    expect(store.reminders[0].sent_at).toBeNull();
  });
});

describe("unsubscribe tokens", () => {
  beforeEach(() => resetStore());

  it("round trips a token and disables email preferences", async () => {
    store.users.push({
      id: "user-1",
      email: "ada@clausly.test",
      notification_preferences: { email: true, version: 7, sms: true },
    });
    const token = createUnsubscribeToken("user-1", 7, "unsubscribe-secret");

    const result = await unsubscribeUserEmail({
      supabase: createSupabaseMock(),
      userId: "user-1",
      token,
      secret: "unsubscribe-secret",
    });

    expect(result).toMatchObject({ ok: true, status: 200 });
    expect(store.users[0].notification_preferences).toEqual({ email: false, version: 7, sms: true });
  });

  it("builds an unsubscribe URL with a verifiable token", () => {
    const url = new URL(buildUnsubscribeUrl({
      baseUrl: "https://clausly.test/",
      userId: "user-1",
      preferences: { version: 2 },
      secret: "unsubscribe-secret",
    }));

    expect(url.pathname).toBe("/api/notifications/unsubscribe");
    expect(url.searchParams.get("user_id")).toBe("user-1");
    expect(url.searchParams.get("token")).toBe(createUnsubscribeToken("user-1", 2, "unsubscribe-secret"));
  });
});

describe("reminder email template", () => {
  it("requires all fields and includes the expected reminder content", () => {
    expect(() => renderReminderEmail({
      title: "",
      documentName: "Lease",
      documentUrl: "https://clausly.test/dashboard/documents/doc-1",
      dueDate: "2026-06-08",
      description: "Review notice window.",
      unsubscribeUrl: "https://clausly.test/unsubscribe",
    })).toThrow("title");

    const template = renderReminderEmail({
      title: "Review renewal",
      documentName: "Office Lease",
      documentUrl: "https://clausly.test/dashboard/documents/doc-1",
      dueDate: "2026-06-08",
      description: "Review notice window.",
      unsubscribeUrl: "https://clausly.test/unsubscribe",
    });

    expect(template.subject).toBe("Reminder: Review renewal");
    expect(template.html).toContain("Office Lease");
    expect(template.html).toContain("Open document in Clausly");
    expect(template.text).toContain("Document URL: https://clausly.test/dashboard/documents/doc-1");
    expect(template.text).toContain("This reminder is informational only and is not legal advice.");
    expect(template.text).toContain("Unsubscribe: https://clausly.test/unsubscribe");
  });
});

describe("Resend email provider abstraction", () => {
  it("sends through fetch and returns the provider id", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(
      JSON.stringify({ id: "resend-id" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    ));
    const provider = new ResendEmailProvider("test-key", "https://resend.test/emails");

    await expect(provider.send({
      to: "ada@clausly.test",
      from: "Clausly <reminders@clausly.test>",
      subject: "Reminder",
      html: "<p>Reminder</p>",
      text: "Reminder",
    })).resolves.toEqual({ id: "resend-id" });

    expect(fetchMock).toHaveBeenCalledWith("https://resend.test/emails", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
    }));
  });
});

function resetStore() {
  store.users = [];
  store.documents = [];
  store.reminders = [];
  store.usage_metrics = [];
  sentMessages.length = 0;
}

function seedDueReminder(options: { user?: Row; reminder?: Row; document?: Row } = {}) {
  const user = {
    id: "user-1",
    email: "ada@clausly.test",
    notification_preferences: { email: true, version: 1 },
    ...options.user,
  };
  const document = {
    id: "doc-1",
    user_id: user.id,
    title: "Office Lease",
    ...options.document,
  };
  const reminder = {
    id: "reminder-1",
    user_id: user.id,
    document_id: document.id,
    title: "Review renewal",
    description: "Review notice window.",
    fire_on: "2026-06-08",
    status: "approved",
    channel: "email",
    sent_at: null,
    ...options.reminder,
  };

  store.users.push(user);
  store.documents.push(document);
  store.reminders.push(reminder);
}

function createSupabaseMock(): NonNullable<DispatchOptions["supabase"]> {
  return {
    from(table: TableName) {
      return new Query(table);
    },
  } as unknown as NonNullable<DispatchOptions["supabase"]>;
}

class Query {
  private filters: { column: string; op: "eq" | "is" | "lte"; value: unknown }[] = [];
  private action: "select" | "update" | "insert" = "select";
  private payload: Row | null = null;
  private maxRows: number | null = null;

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
    this.filters.push({ column, op: "eq", value });
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push({ column, op: "is", value });
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.push({ column, op: "lte", value });
    return this;
  }

  order() {
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

    const rows = this.filteredRows().map((row) => this.withRelationships(row));
    const limitedRows = this.maxRows === null ? rows : rows.slice(0, this.maxRows);
    return { data: single ? limitedRows[0] ?? null : limitedRows, error: null };
  }

  private filteredRows() {
    return store[this.table].filter((row) => this.filters.every((filter) => {
      if (filter.op === "eq") return row[filter.column] === filter.value;
      if (filter.op === "is") return row[filter.column] === filter.value;
      if (filter.op === "lte") return String(row[filter.column]) <= String(filter.value);
      return true;
    }));
  }

  private withRelationships(row: Row) {
    if (this.table !== "reminders") return { ...row };

    return {
      ...row,
      users: store.users.find((user) => user.id === row.user_id) ?? null,
      documents: store.documents.find((document) => document.id === row.document_id) ?? null,
    };
  }
}
