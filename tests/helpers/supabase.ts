import { vi } from "vitest";

type TableName =
  | "users"
  | "billing_customers"
  | "qa_conversations"
  | "qa_messages"
  | "document_suggestions"
  | "portfolio_suggestions"
  | "documents"
  | "clauses"
  | "dates"
  | "reminders"
  | "document_chunks"
  | "usage_metrics"
  | "document_exports"
  | "document_shares"
  | "audit_events"
  | "weekly_digests";
type Row = Record<string, any>;
type TableStore = Record<TableName, Row[]>;
type TestUser = { id: string; email?: string | null };

type Failure = {
  table: TableName;
  operation: "insert" | "update" | "delete" | "select";
  message: string;
  once?: boolean;
};

const tables: TableStore = {
  users: [],
  billing_customers: [],
  qa_conversations: [],
  qa_messages: [],
  document_suggestions: [],
  portfolio_suggestions: [],
  documents: [],
  clauses: [],
  dates: [],
  reminders: [],
  document_chunks: [],
  usage_metrics: [],
  document_exports: [],
  document_shares: [],
  audit_events: [],
  weekly_digests: [],
};

const storage = {
  uploaded: [] as { path: string; file: File; options?: unknown }[],
  removed: [] as string[],
  signedUrls: [] as string[],
  files: new Map<string, Blob>(),
};

let currentUser: TestUser | null = null;
let failure: Failure | null = null;
let uuidCounter = 0;
const rpcCallsList: { name: string; args: Row }[] = [];

export function installSupabaseMock() {
  vi.mock("@/lib/supabase/server", () => ({
    createClient: async () => createSupabaseClient(),
  }));
  vi.mock("server-only", () => ({}));
}

export function resetSupabaseMock(user: TestUser | null = userA) {
  for (const key of Object.keys(tables) as TableName[]) tables[key] = [];
  storage.uploaded = [];
  storage.removed = [];
  storage.signedUrls = [];
  storage.files = new Map();
  currentUser = user;
  failure = null;
  uuidCounter = 0;
  rpcCallsList.length = 0;
  vi.spyOn(crypto, "randomUUID").mockImplementation(() => nextUuid() as any);
  setSupabaseEnv(true);
}

export function setSupabaseUser(user: TestUser | null) {
  currentUser = user;
}

export function setSupabaseEnv(enabled: boolean) {
  if (enabled) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  } else {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  }
}

export function failNext(operation: Failure["operation"], table: TableName, message = "Forced Supabase error.") {
  failure = { operation, table, message, once: true };
}

export function db() {
  return tables;
}

export function storageCalls() {
  return storage;
}

export function rpcCalls() {
  return rpcCallsList;
}

export function seedStoredPdf(path: string, bytes: BlobPart = "%PDF-1.7") {
  const file = bytes instanceof Blob
    ? bytes
    : new Blob([bytes], { type: "application/pdf" });
  storage.files.set(path, file);
  return file;
}

export const userA = { id: "11111111-1111-4111-8111-111111111111", email: "ada@clausly.app" };
export const userB = { id: "22222222-2222-4222-8222-222222222222", email: "ben@clausly.app" };

export function seedUser(user = userA, overrides: Row = {}) {
  const row = {
    id: user.id,
    email: user.email,
    full_name: user.email?.split("@")[0] ?? "Test User",
    onboarded_at: null,
    onboarding_tour_completed_at: null,
    ...overrides,
  };
  tables.users.push(row);
  return row;
}

export function seedDocument(user = userA, overrides: Row = {}) {
  const id = overrides.id ?? nextUuid();
  const row = {
    id,
    user_id: user.id,
    title: "Test Lease",
    party: "Test Properties LLC",
    document_type: "lease",
    jurisdiction: "Minnesota",
    page_count: 8,
    storage_path: user.id + "/" + id + "/lease.pdf",
    file_name: "lease.pdf",
    mime_type: "application/pdf",
    file_size_bytes: 1024,
    status: "ready",
    risk_level: "medium",
    monthly_value: 1200,
    effective_date: "2026-01-01",
    end_date: "2026-12-31",
    notice_window_days: 60,
    summary: "A test lease.",
    summary_short: "A test lease.",
    tags: ["Lease"],
    error_message: null,
    analysis_started_at: null,
    analysis_attempts: 0,
    failure_category: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
  tables.documents.push(row);
  return row;
}

export function seedBillingCustomer(user = userA, overrides: Row = {}) {
  const row = {
    user_id: user.id,
    stripe_customer_id: "cus_test_" + user.id.slice(0, 8),
    created_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
  tables.billing_customers.push(row);
  return row;
}

export function seedConversation(user = userA, overrides: Row = {}) {
  const row = {
    id: overrides.id ?? nextUuid(),
    user_id: user.id,
    document_id: overrides.document_id ?? null,
    title: "Termination clause",
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
  tables.qa_conversations.push(row);
  return row;
}

export function seedMessage(conversationId: string, overrides: Row = {}) {
  const row = {
    id: overrides.id ?? nextUuid(),
    conversation_id: conversationId,
    role: "user",
    content: "What is the termination clause?",
    citations: [],
    created_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
  tables.qa_messages.push(row);
  return row;
}

export function seedDocumentSuggestion(documentId: string, overrides: Row = {}) {
  const row = {
    document_id: documentId,
    suggestions: [
      "What's the termination clause?",
      "When does this auto-renew?",
      "What notice period applies?",
      "Which fees could surprise me?",
    ],
    generated_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
  tables.document_suggestions.push(row);
  return row;
}

export function seedPortfolioSuggestion(user = userA, overrides: Row = {}) {
  const row = {
    user_id: user.id,
    suggestions: [
      "Which contracts renew soon?",
      "Where is my highest monthly cost?",
      "Which agreements need notice?",
      "Which risks appear across documents?",
    ],
    document_count: 0,
    generated_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
  tables.portfolio_suggestions.push(row);
  return row;
}

export function seedClause(documentId: string, user = userA, overrides: Row = {}) {
  const row = {
    id: overrides.id ?? nextUuid(),
    user_id: user.id,
    document_id: documentId,
    title: "Notice window",
    category: "Renewal",
    risk_level: "medium",
    page_number: 2,
    source_quote: "Notice is required.",
    plain_english: "Send notice before the deadline.",
    why_it_matters: "Missing the deadline can extend obligations.",
    confidence: 0.9,
    bbox: [0.1, 0.2, 0.3, 0.1],
    created_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
  tables.clauses.push(row);
  return row;
}

export function seedDate(documentId: string, user = userA, overrides: Row = {}) {
  const row = {
    id: overrides.id ?? nextUuid(),
    user_id: user.id,
    document_id: documentId,
    clause_id: null,
    label: "Notice due",
    date_value: "2026-11-01",
    kind: "notice",
    description: "Send notice.",
    source_quote: "Notice is due.",
    confidence: 0.88,
    created_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
  tables.dates.push(row);
  return row;
}

export function seedReminder(documentId: string, user = userA, overrides: Row = {}) {
  const row = {
    id: overrides.id ?? nextUuid(),
    user_id: user.id,
    document_id: documentId,
    date_id: null,
    title: "Review notice window",
    description: "Review the contract before notice is due.",
    fire_on: "2026-10-01",
    reminder_time: null,
    reminder_type: "Notice",
    status: "suggested",
    channel: "email",
    source_quote: "Notice is due.",
    confidence: 0.87,
    created_at: "2026-06-01T00:00:00.000Z",
    documents: { title: "Test Lease" },
    ...overrides,
  };
  tables.reminders.push(row);
  return row;
}

export function seedDocumentChunk(documentId: string, user = userA, overrides: Row = {}) {
  const row = {
    id: overrides.id ?? nextUuid(),
    user_id: user.id,
    document_id: documentId,
    chunk_index: overrides.chunk_index ?? 0,
    content: "This lease requires 60 days written notice before renewal.",
    page_number: 2,
    embedding: Array.from({ length: 1536 }, (_, index) => index / 1536),
    created_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
  tables.document_chunks.push(row);
  return row;
}

export function seedUsageMetric(user = userA, overrides: Row = {}) {
  const row = {
    id: overrides.id ?? nextUuid(),
    user_id: user.id,
    document_id: overrides.document_id ?? null,
    job_type: "qa_question",
    provider: "mock",
    model: "mock",
    input_token_count: 10,
    output_token_count: 10,
    status: "completed",
    error_message: null,
    created_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
  tables.usage_metrics.push(row);
  return row;
}

export function seedDocumentExport(documentId: string, user = userA, overrides: Row = {}) {
  const row = {
    id: overrides.id ?? nextUuid(),
    user_id: user.id,
    document_id: documentId,
    format: "pdf",
    created_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
  tables.document_exports.push(row);
  return row;
}

export function seedDocumentShare(documentId: string, user = userA, overrides: Row = {}) {
  const row = {
    id: overrides.id ?? nextUuid(),
    document_id: documentId,
    user_id: user.id,
    token: "share-token-" + String(tables.document_shares.length + 1),
    expires_at: null,
    revoked_at: null,
    view_count: 0,
    created_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
  tables.document_shares.push(row);
  return row;
}

export function seedAuditEvent(user = userA, overrides: Row = {}) {
  const row = {
    id: overrides.id ?? nextUuid(),
    user_id: user.id,
    action: "document.uploaded",
    resource_type: "document",
    resource_id: overrides.resource_id ?? null,
    metadata: {},
    created_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
  tables.audit_events.push(row);
  return row;
}

export function jsonRequest(body: unknown, init: RequestInit = {}) {
  return new Request("http://localhost.test", {
    method: init.method ?? "POST",
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    body: JSON.stringify(body),
    ...init,
  });
}

export function routeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

export function createSupabaseClient() {
  return createSupabaseClientForRole(false);
}

export function createServiceSupabaseClientMock() {
  return createSupabaseClientForRole(true);
}

function createSupabaseClientForRole(bypassRls: boolean) {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: currentUser }, error: null })),
      signOut: vi.fn(async () => {
        currentUser = null;
        return { error: null };
      }),
    },
    rpc: vi.fn(async (name: string, args: Row = {}) => {
      rpcCallsList.push({ name, args });
      if (name === "match_document_chunks") {
        const targetDocumentId = args.target_document_id;
        const limit = Number(args.match_count ?? 5);
        const data = tables.document_chunks
          .filter((row) => isVisible("document_chunks", row) && row.document_id === targetDocumentId)
          .slice(0, limit)
          .map((row, index) => ({ ...row, similarity: 0.9 - index * 0.01 }));
        return { data: clone(data), error: null };
      }

      if (name === "match_portfolio_chunks") {
        const matchCount = Number(args.match_count ?? 12);
        const perDocCap = Number(args.per_doc_cap ?? 3);
        const counts = new Map<string, number>();
        const data = tables.document_chunks
          .filter((row) => isVisible("document_chunks", row))
          .filter((row) => {
            const count = counts.get(row.document_id) ?? 0;
            if (count >= perDocCap) return false;
            counts.set(row.document_id, count + 1);
            return true;
          })
          .slice(0, matchCount)
          .map((row, index) => ({ ...row, similarity: 0.9 - index * 0.01 }));
        return { data: clone(data), error: null };
      }

      if (name !== "delete_account") {
        return { data: null, error: { message: "Unknown RPC.", code: "TEST_ERROR" } };
      }

      const targetUserId = args.target_user_id;
      if (!currentUser || currentUser.id !== targetUserId) {
        return { data: null, error: { message: "Cannot delete another user account.", code: "42501" } };
      }

      tables.users = tables.users.filter((row) => row.id !== targetUserId);
      const documentIds = new Set(
        tables.documents.filter((row) => row.user_id === targetUserId).map((row) => row.id)
      );
      tables.documents = tables.documents.filter((row) => row.user_id !== targetUserId);
      cascadeDocuments(documentIds);
      return { data: null, error: null };
    }),
    from(table: TableName) {
      return new Query(table, bypassRls);
    },
    storage: {
      from() {
        return {
          upload: vi.fn(async (path: string, file: File, options?: unknown) => {
            storage.uploaded.push({ path, file, options });
            storage.files.set(path, file);
            return { data: { path }, error: null };
          }),
          download: vi.fn(async (path: string) => {
            const file = storage.files.get(path);
            if (!file) {
              return { data: null, error: { message: "Stored file not found.", code: "NOT_FOUND" } };
            }
            return { data: file, error: null };
          }),
          remove: vi.fn(async (paths: string[]) => {
            storage.removed.push(...paths);
            paths.forEach((path) => storage.files.delete(path));
            return { data: paths.map((path) => ({ name: path })), error: null };
          }),
          createSignedUrl: vi.fn(async (path: string) => {
            storage.signedUrls.push(path);
            return { data: { signedUrl: "https://signed.test/" + path }, error: null };
          }),
        };
      },
    },
  };
}

class Query {
  private filters: { column: string; value: unknown; op: "eq" | "neq" | "in" | "gte" | "lt" }[] = [];
  private orFilters: { column: string; term: string; op: "ilike" }[] = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private limitCount: number | null = null;
  private head = false;
  private wantsCount = false;
  private action: "select" | "insert" | "update" | "delete" = "select";
  private payload: Row | Row[] | null = null;

  constructor(private table: TableName, private bypassRls = false) {}

  select(_columns = "*", options?: { count?: string; head?: boolean }) {
    this.head = Boolean(options?.head);
    this.wantsCount = Boolean(options?.count);
    return this;
  }

  insert(payload: Row | Row[]) {
    this.action = "insert";
    this.payload = payload;
    return this;
  }

  update(payload: Row) {
    this.action = "update";
    this.payload = payload;
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value, op: "eq" });
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push({ column, value, op: "neq" });
    return this;
  }

  in(column: string, value: unknown[]) {
    this.filters.push({ column, value, op: "in" });
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push({ column, value, op: "gte" });
    return this;
  }

  lt(column: string, value: unknown) {
    this.filters.push({ column, value, op: "lt" });
    return this;
  }

  or(query: string) {
    this.orFilters.push(...query
      .split(",")
      .map((part) => {
        const match = part.match(/^([a-zA-Z0-9_]+)\.ilike\.%(.*)%$/);
        if (!match) return null;
        return { column: match[1], term: match[2].toLowerCase(), op: "ilike" as const };
      })
      .filter((filter): filter is { column: string; term: string; op: "ilike" } => Boolean(filter)));
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: options?.ascending ?? true };
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    return this.execute(true, false);
  }

  maybeSingle() {
    return this.execute(true, true);
  }

  then(resolve: (value: any) => void, reject?: (reason?: any) => void) {
    return this.execute().then(resolve, reject);
  }

  private async execute(single = false, lenient = false) {
    const forced = consumeFailure(this.action, this.table);
    if (forced) return { data: single ? null : [], error: forced, count: null };

    if (this.action === "insert") return this.executeInsert(single);
    if (this.action === "update") return this.executeUpdate(single, lenient);
    if (this.action === "delete") return this.executeDelete();
    return this.executeSelect(single, lenient);
  }

  private async executeSelect(single: boolean, lenient = false) {
    const filtered = this.filteredRows();
    const rows = this.orderedAndLimitedRows(filtered);
    if (this.head) return { data: null, error: null, count: filtered.length };
    if (single) {
      const row = rows[0];
      if (row) return { data: clone(row), error: null, count: null };
      return { data: null, error: lenient ? null : notFound(), count: null };
    }
    return { data: clone(rows), error: null, count: this.wantsCount ? filtered.length : null };
  }

  private async executeInsert(single: boolean) {
    const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
    const inserted = rows.filter(Boolean).map((row) => ({ ...row, id: row.id ?? nextUuid() }));
    tables[this.table].push(...inserted);
    return { data: single ? clone(inserted[0]) : clone(inserted), error: null, count: null };
  }

  private async executeUpdate(single: boolean, lenient = false) {
    const rows = this.filteredRows();
    for (const row of rows) {
      for (const [key, value] of Object.entries(this.payload ?? {})) {
        if (value !== undefined) row[key] = value;
      }
    }
    if (single) {
      const row = rows[0];
      if (row) return { data: clone(row), error: null, count: null };
      return { data: null, error: lenient ? null : notFound(), count: null };
    }
    return { data: clone(rows), error: null, count: rows.length };
  }

  private async executeDelete() {
    const rows = this.filteredRows();
    const ids = new Set(rows.map((row) => row.id));
    tables[this.table] = tables[this.table].filter((row) => !ids.has(row.id));
    if (this.table === "documents") cascadeDocuments(ids);
    return { data: null, error: null, count: rows.length };
  }

  private filteredRows() {
    let rows = tables[this.table].filter((row) => isVisible(this.table, row, this.bypassRls));
    for (const filter of this.filters) {
      if (filter.op === "eq") rows = rows.filter((row) => row[filter.column] === filter.value);
      if (filter.op === "neq") rows = rows.filter((row) => row[filter.column] !== filter.value);
      if (filter.op === "in") rows = rows.filter((row) => Array.isArray(filter.value) && filter.value.includes(row[filter.column]));
      if (filter.op === "gte") rows = rows.filter((row) => String(row[filter.column]) >= String(filter.value));
      if (filter.op === "lt") rows = rows.filter((row) => String(row[filter.column]) < String(filter.value));
    }
    if (this.orFilters.length > 0) {
      rows = rows.filter((row) => this.orFilters.some((filter) =>
        String(row[filter.column] ?? "").toLowerCase().includes(filter.term)
      ));
    }
    return rows;
  }

  private orderedAndLimitedRows(rows: Row[]) {
    let nextRows = rows;
    if (this.orderBy) {
      const { column, ascending } = this.orderBy;
      nextRows = [...nextRows].sort((a, b) => {
        if (a[column] === b[column]) return 0;
        if (a[column] == null) return ascending ? -1 : 1;
        if (b[column] == null) return ascending ? 1 : -1;
        return a[column] > b[column] ? (ascending ? 1 : -1) : (ascending ? -1 : 1);
      });
    }
    if (this.limitCount !== null) return nextRows.slice(0, this.limitCount);
    return nextRows;
  }
}

function isVisible(table: TableName, row: Row, bypassRls = false) {
  if (bypassRls) return true;
  if (!currentUser) return false;
  if (table === "users") return row.id === currentUser.id;
  if (table === "document_suggestions") {
    const document = tables.documents.find((item) => item.id === row.document_id);
    return document?.user_id === currentUser.id;
  }
  if (table === "qa_messages") {
    const conversation = tables.qa_conversations.find((item) => item.id === row.conversation_id);
    return conversation?.user_id === currentUser.id;
  }
  return row.user_id === currentUser.id;
}

function cascadeDocuments(ids: Set<string>) {
  const conversationIds = new Set(
    tables.qa_conversations.filter((row) => ids.has(row.document_id)).map((row) => row.id)
  );
  for (const table of ["clauses", "dates", "reminders", "document_chunks", "qa_conversations", "document_suggestions", "document_shares"] as TableName[]) {
    tables[table] = tables[table].filter((row) => !ids.has(row.document_id));
  }
  tables.qa_messages = tables.qa_messages.filter((row) => !conversationIds.has(row.conversation_id));
}

function consumeFailure(operation: Failure["operation"], table: TableName) {
  if (!failure || failure.operation !== operation || failure.table !== table) return null;
  const error = { message: failure.message, code: "TEST_ERROR" };
  if (failure.once) failure = null;
  return error;
}

function notFound() {
  return { message: "Not found", code: "PGRST116" };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function nextUuid() {
  uuidCounter += 1;
  return "00000000-0000-4000-8000-" + String(uuidCounter).padStart(12, "0");
}
