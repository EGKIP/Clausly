import "server-only";

import { getShareByToken, incrementViewCount, type DocumentShare } from "./shares";

type ShareDigestClient = Parameters<typeof getShareByToken>[0] & {
  from: (table: "documents" | "clauses" | "dates" | "reminders" | "document_shares") => {
    select: (columns?: string) => ShareDigestQuery;
  };
};
type ShareDigestQueryResult = { data: unknown; error: { code?: string; message: string } | null };
type ShareDigestQuery = PromiseLike<ShareDigestQueryResult> & {
  eq: (column: string, value: unknown) => ShareDigestQuery;
  order: (column: string, options?: { ascending?: boolean }) => ShareDigestQuery;
  single: () => Promise<ShareDigestQueryResult>;
};

type DocumentRow = {
  id: string;
  title: string;
  party: string | null;
  document_type: string;
  summary: string | null;
  summary_short: string | null;
};
type ClauseRow = {
  id: string;
  title: string;
  category: string;
  risk_level: string;
  page_number: number;
  plain_english: string;
  why_it_matters: string | null;
};
type DateRow = {
  id: string;
  label: string;
  date_value: string;
  kind: string;
  description: string | null;
};
type ReminderRow = {
  id: string;
  title: string;
  description: string;
  fire_on: string;
  status: string;
};

export type PublicShareDigest = {
  share: Pick<DocumentShare, "id" | "expiresAt" | "viewCount" | "createdAt">;
  document: {
    title: string;
    type: string;
    party: string | null;
    dates: Array<{
      id: string;
      label: string;
      date: string;
      kind: string;
      description: string | null;
    }>;
  };
  summary: string | null;
  clauses: Array<{
    id: string;
    title: string;
    category: string;
    riskLevel: string;
    pageNumber: number;
    plainEnglish: string;
    whyItMatters: string | null;
  }>;
  recommendedActions: Array<{
    id: string;
    title: string;
    description: string;
    fireOn: string;
    status: string;
  }>;
};

export async function getPublicShareDigest(
  supabase: ShareDigestClient,
  token: string
): Promise<PublicShareDigest | null> {
  const share = await getShareByToken(supabase, token);
  if (!share) return null;

  const { data: document, error: documentError } = await supabase
    .from("documents")
    .select("id, title, party, document_type, summary, summary_short")
    .eq("id", share.documentId)
    .single() as { data: DocumentRow | null; error: { code?: string; message: string } | null };

  if (documentError?.code === "PGRST116" || !document) return null;
  if (documentError) throw documentError;

  const [
    { data: clauses, error: clausesError },
    { data: dates, error: datesError },
    { data: reminders, error: remindersError },
  ] = await Promise.all([
    supabase
      .from("clauses")
      .select("id, title, category, risk_level, page_number, plain_english, why_it_matters")
      .eq("document_id", share.documentId)
      .order("page_number", { ascending: true }) as PromiseLike<{ data: ClauseRow[] | null; error: { message: string } | null }>,
    supabase
      .from("dates")
      .select("id, label, date_value, kind, description")
      .eq("document_id", share.documentId)
      .order("date_value", { ascending: true }) as PromiseLike<{ data: DateRow[] | null; error: { message: string } | null }>,
    supabase
      .from("reminders")
      .select("id, title, description, fire_on, status")
      .eq("document_id", share.documentId)
      .order("fire_on", { ascending: true }) as PromiseLike<{ data: ReminderRow[] | null; error: { message: string } | null }>,
  ]);

  if (clausesError) throw clausesError;
  if (datesError) throw datesError;
  if (remindersError) throw remindersError;

  void incrementViewCount(supabase, share.id);

  return {
    share: {
      id: share.id,
      expiresAt: share.expiresAt,
      viewCount: share.viewCount,
      createdAt: share.createdAt,
    },
    document: {
      title: document.title,
      type: document.document_type,
      party: document.party,
      dates: (dates ?? []).map((date) => ({
        id: date.id,
        label: date.label,
        date: date.date_value,
        kind: date.kind,
        description: date.description,
      })),
    },
    summary: document.summary ?? document.summary_short,
    clauses: (clauses ?? []).map((clause) => ({
      id: clause.id,
      title: clause.title,
      category: clause.category,
      riskLevel: clause.risk_level,
      pageNumber: clause.page_number,
      plainEnglish: clause.plain_english,
      whyItMatters: clause.why_it_matters,
    })),
    recommendedActions: (reminders ?? []).map((reminder) => ({
      id: reminder.id,
      title: reminder.title,
      description: reminder.description,
      fireOn: reminder.fire_on,
      status: reminder.status,
    })),
  };
}
