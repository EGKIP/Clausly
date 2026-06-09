import { vi } from "vitest";

type TableName = "users" | "documents" | "clauses" | "dates" | "reminders";
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
  documents: [],
  clauses: [],
  dates: [],
  reminders: [],
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
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
  tables.documents.push(row);
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
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: currentUser }, error: null })),
      signOut: vi.fn(async () => {
        currentUser = null;
        return { error: null };
      }),
    },
    rpc: vi.fn(async (name: string, args: Row = {}) => {
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
      return new Query(table);
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
  private filters: { column: string; value: unknown; op: "eq" | "neq" | "in" }[] = [];
  private head = false;
  private wantsCount = false;
  private action: "select" | "insert" | "update" | "delete" = "select";
  private payload: Row | Row[] | null = null;

  constructor(private table: TableName) {}

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
    return this.execute();
  }

  order() {
    return this;
  }

  single() {
    return this.execute(true);
  }

  then(resolve: (value: any) => void, reject?: (reason?: any) => void) {
    return this.execute().then(resolve, reject);
  }

  private async execute(single = false) {
    const forced = consumeFailure(this.action, this.table);
    if (forced) return { data: single ? null : [], error: forced, count: null };

    if (this.action === "insert") return this.executeInsert(single);
    if (this.action === "update") return this.executeUpdate(single);
    if (this.action === "delete") return this.executeDelete();
    return this.executeSelect(single);
  }

  private async executeSelect(single: boolean) {
    const rows = this.filteredRows();
    if (this.head) return { data: null, error: null, count: rows.length };
    if (single) {
      const row = rows[0];
      return row ? { data: clone(row), error: null, count: null } : { data: null, error: notFound(), count: null };
    }
    return { data: clone(rows), error: null, count: this.wantsCount ? rows.length : null };
  }

  private async executeInsert(single: boolean) {
    const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
    const inserted = rows.filter(Boolean).map((row) => ({ ...row, id: row.id ?? nextUuid() }));
    tables[this.table].push(...inserted);
    return { data: single ? clone(inserted[0]) : clone(inserted), error: null, count: null };
  }

  private async executeUpdate(single: boolean) {
    const rows = this.filteredRows();
    for (const row of rows) {
      for (const [key, value] of Object.entries(this.payload ?? {})) {
        if (value !== undefined) row[key] = value;
      }
    }
    if (single) {
      const row = rows[0];
      return row ? { data: clone(row), error: null, count: null } : { data: null, error: notFound(), count: null };
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
    let rows = tables[this.table].filter((row) => isVisible(this.table, row));
    for (const filter of this.filters) {
      if (filter.op === "eq") rows = rows.filter((row) => row[filter.column] === filter.value);
      if (filter.op === "neq") rows = rows.filter((row) => row[filter.column] !== filter.value);
      if (filter.op === "in") rows = rows.filter((row) => Array.isArray(filter.value) && filter.value.includes(row[filter.column]));
    }
    return rows;
  }
}

function isVisible(table: TableName, row: Row) {
  if (!currentUser) return false;
  if (table === "users") return row.id === currentUser.id;
  return row.user_id === currentUser.id;
}

function cascadeDocuments(ids: Set<string>) {
  for (const table of ["clauses", "dates", "reminders"] as TableName[]) {
    tables[table] = tables[table].filter((row) => !ids.has(row.document_id));
  }
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
