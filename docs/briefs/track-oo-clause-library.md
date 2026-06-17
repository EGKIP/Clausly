# Track OO — Cross-portfolio clause library

## Goal

A new `/dashboard/clauses` page that surfaces every clause Clausly has
extracted across the user's entire portfolio, searchable + filterable
by category and risk. Click → jump to source contract with the clause
highlighted.

## Non-goals

- Not changing clause extraction (clauses come from existing `clauses` table).
- Not adding cross-document clause similarity / clustering.
- Not building edit-in-place — clauses are read-only here.
- Not Pro-gated. Available to all users.

## Architecture

| File | Purpose |
|---|---|
| `src/app/api/clauses/route.ts` | `GET` paginated, filterable list of clauses for current user |
| `src/app/dashboard/clauses/page.tsx` | Server component fetching first page + metadata |
| `src/components/dashboard/clauses/clause-library.tsx` | Client component with search/filter UI |
| `src/components/dashboard/clauses/clause-row.tsx` | Single clause row (category, risk, doc title, snippet) |
| `src/components/dashboard/sidebar.tsx` | Add "Clauses" nav item between Documents and Reminders |

## Database (no migration needed)

Uses the existing `clauses` table. Sortable indexes already exist via
the `clauses_document_id_idx` and the implicit `user_id` index. If query
performance is poor at >1000 clauses per user, add:
```sql
create index if not exists clauses_user_category_risk_idx
  on public.clauses (user_id, category, risk_level);
```
…in a follow-up. Don't add it preemptively.

## Commit cadence (CRITICAL)

**Commit and push after EACH numbered deliverable below.** Each commit
must build + lint + test clean.

## Deliverables

### 1. API route
- `GET /api/clauses` accepts query params:
  - `q` — full-text on `title`, `plain_english`, `source_quote` (use ILIKE OR'd)
  - `category` — comma-separated list (e.g. `termination,renewal`)
  - `risk` — comma-separated list (`low,medium,high,needs_review`)
  - `documentId` — uuid filter
  - `limit` — default 50, max 100
  - `cursor` — opaque cursor for pagination (use `created_at` desc)
- Returns `{ clauses, nextCursor, totalCount }`
- 401 if unauthenticated; mock mode returns 3 canned clauses
- Tests: `src/app/api/clauses/__tests__/route.test.ts` (6 tests min)
- Commit: `feat(api): add /api/clauses paginated list`

### 2. Server page + initial render
- `src/app/dashboard/clauses/page.tsx` fetches first page server-side
- Passes initial data + facets (counts per category, counts per risk) to client
- Empty state if user has zero docs (link to upload)
- Commit: `feat(clauses): add /dashboard/clauses server page`

### 3. Client library UI
- Search input (debounced 200ms)
- Multi-select filter chips for category + risk
- Sort dropdown (newest / risk desc / category)
- Each clause card: title, category badge, risk badge, doc title (linked),
  source quote excerpt (3 lines, truncated), "View in document" button
- Infinite scroll using `nextCursor`
- Commit: `feat(clauses): wire search + filter + infinite scroll`

### 4. Wire sidebar + document detail link
- Add "Clauses" item to `sidebar.tsx` with `BookOpen` icon between
  Documents and Reminders
- On document detail, each clause row gets an icon link "View in library"
  → opens `/dashboard/clauses?documentId=<id>` filtered to that doc
- Commit: `feat(clauses): wire sidebar nav + document detail cross-link`

## "View in document" jump behavior

Clicking "View in document" navigates to
`/dashboard/documents/[id]?clause=<clauseId>`. The document detail page
already supports `activeClauseId` state (see `document-view.tsx`); read
the URL param on mount and call `setActiveClauseId`.

## Tests required

- API route: 6 tests covering filters, pagination, search, RLS, mock mode, 401
- Client UI: 3 tests covering search debounce, filter toggle, empty state
- Total new tests: ~10

## Definition of done

- `npm test` ✅ all passing (currently 249)
- `npm run lint` ✅ clean
- `npx tsc --noEmit` ✅ clean
- `npx next build` ✅ clean
- All 4 commits pushed to `track-oo-clause-library`
- PR body QA hook:
  1. Open `/dashboard/clauses`
  2. Search "termination" → list filters live
  3. Toggle risk = high → only high-risk clauses
  4. Click "View in document" → navigates with clause highlighted
- No regressions on existing document detail page
