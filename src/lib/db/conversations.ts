import "server-only";

export type ConversationScope = string | null;

export type ConversationSummary = {
  id: string;
  title: string;
  documentId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConversationMessage = {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  citations: unknown[];
  createdAt: string;
};

export type ConversationRef = {
  id: string;
  title: string;
  documentId: string | null;
  isNew: boolean;
};

type ConversationRow = {
  id: string;
  user_id: string;
  document_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  citations: unknown;
  created_at: string;
};

type QueryResult<T> = {
  data: T | null;
  error: { message: string; code?: string } | null;
};

type Query<T> = PromiseLike<QueryResult<T>> & {
  select(columns?: string): Query<T>;
  eq(column: string, value: unknown): Query<T>;
  order(column: string, options?: { ascending?: boolean }): Query<T>;
  limit(count: number): Query<T>;
  single(): PromiseLike<QueryResult<T extends Array<infer U> ? U : T>>;
};

type Table<T> = {
  select(columns?: string): Query<T[]>;
  insert(payload: Record<string, unknown>): Query<T[]>;
  update(payload: Record<string, unknown>): Query<T[]>;
};

type SupabaseLike = {
  from(table: "qa_conversations"): Table<ConversationRow>;
  from(table: "qa_messages"): Table<MessageRow>;
};

const MAX_TITLE_LENGTH = 80;

export async function getOrCreateConversation(
  supabase: unknown,
  userId: string,
  documentId: ConversationScope,
  firstQuestion: string,
  conversationId?: string | null
): Promise<ConversationRef> {
  const db = supabase as SupabaseLike;
  if (conversationId) {
    const existing = await findConversation(db, userId, documentId, conversationId);
    if (!existing) throw notFoundError();
    return toConversationRef(existing, false);
  }

  const title = titleFromQuestion(firstQuestion);
  const { data, error } = await db
    .from("qa_conversations")
    .insert({
      user_id: userId,
      document_id: documentId,
      title,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Conversation could not be created.");
  return toConversationRef(data, true);
}

export async function loadConversationMessages(
  supabase: unknown,
  userId: string,
  conversationId: string,
  limit = 10
): Promise<ConversationMessage[]> {
  const db = supabase as SupabaseLike;
  const conversation = await findConversationById(db, userId, conversationId);
  if (!conversation) throw notFoundError();

  const { data, error } = await db
    .from("qa_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).slice().reverse().map(toMessage);
}

export async function appendMessage(
  supabase: unknown,
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  citations: unknown[] = []
): Promise<ConversationMessage> {
  const db = supabase as SupabaseLike;
  const { data, error } = await db
    .from("qa_messages")
    .insert({
      conversation_id: conversationId,
      role,
      content,
      citations,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Message could not be appended.");
  return toMessage(data);
}

export async function touchConversation(supabase: unknown, conversationId: string): Promise<void> {
  const db = supabase as SupabaseLike;
  const { error } = await db
    .from("qa_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);
  if (error) throw new Error(error.message);
}

export async function listConversations(
  supabase: unknown,
  userId: string,
  documentId?: ConversationScope,
  limit = 10
): Promise<ConversationSummary[]> {
  const db = supabase as SupabaseLike;
  let query = db
    .from("qa_conversations")
    .select("*")
    .eq("user_id", userId);

  query = documentId === undefined
    ? query.eq("document_id", null)
    : query.eq("document_id", documentId);

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map(toSummary);
}

async function findConversation(
  db: SupabaseLike,
  userId: string,
  documentId: ConversationScope,
  conversationId: string
) {
  const { data, error } = await db
    .from("qa_conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .eq("document_id", documentId)
    .single();

  if (error?.code === "PGRST116") return null;
  if (error) throw new Error(error.message);
  return data;
}

async function findConversationById(db: SupabaseLike, userId: string, conversationId: string) {
  const { data, error } = await db
    .from("qa_conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .single();

  if (error?.code === "PGRST116") return null;
  if (error) throw new Error(error.message);
  return data;
}

function titleFromQuestion(question: string) {
  const compact = question.replace(/\s+/g, " ").trim();
  if (compact.length <= MAX_TITLE_LENGTH) return compact || "New Ask Clausly chat";
  return compact.slice(0, MAX_TITLE_LENGTH - 1).trimEnd() + "…";
}

function toConversationRef(row: ConversationRow, isNew: boolean): ConversationRef {
  return {
    id: row.id,
    title: row.title,
    documentId: row.document_id,
    isNew,
  };
}

function toSummary(row: ConversationRow): ConversationSummary {
  return {
    id: row.id,
    title: row.title,
    documentId: row.document_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toMessage(row: MessageRow): ConversationMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    citations: Array.isArray(row.citations) ? row.citations : [],
    createdAt: row.created_at,
  };
}

function notFoundError() {
  const error = new Error("Conversation not found.");
  error.name = "ConversationNotFoundError";
  return error;
}
