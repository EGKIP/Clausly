/**
 * Keyset cursor for the clause library, ordered `created_at desc, id desc`.
 *
 * `created_at` alone is not unique: an analysis inserts all of a document's
 * clauses in one statement, so they share one `now()` timestamp. A cursor of
 * just `created_at < x` skipped every remaining clause from that batch when a
 * page boundary fell inside it. The `id` tiebreaker makes the order total.
 */
export type ClauseCursor = { createdAt: string; id: string | null };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Postgres/ISO timestamps only; anything else could alter the PostgREST filter.
const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2})?)?$/;

export function encodeClauseCursor(row: { created_at: string; id: string }) {
  return Buffer.from(JSON.stringify({ createdAt: row.created_at, id: row.id }), "utf8").toString("base64url");
}

export function decodeClauseCursor(value: string): ClauseCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { createdAt?: unknown; id?: unknown };
    if (typeof parsed.createdAt !== "string" || !TIMESTAMP_RE.test(parsed.createdAt)) return null;
    if (parsed.id === undefined) return { createdAt: parsed.createdAt, id: null };
    if (typeof parsed.id !== "string" || !UUID_RE.test(parsed.id)) return null;
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

type CursorQuery<Q> = { lt(column: string, value: string): Q; or(filters: string): Q };

/** Rows strictly after `cursor` in `created_at desc, id desc` order. */
export function applyClauseCursor<Q extends CursorQuery<Q>>(query: Q, cursor: ClauseCursor): Q {
  // Cursors issued before the id tiebreaker existed: keep the old behavior.
  if (!cursor.id) return query.lt("created_at", cursor.createdAt);
  const at = `"${cursor.createdAt}"`;
  return query.or(`created_at.lt.${at},and(created_at.eq.${at},id.lt.${cursor.id})`);
}
