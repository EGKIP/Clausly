# Track RR — Document export (PDF + CSV)

## Goal

Users can download a polished export of any document they own. Two
formats:
- **PDF**: 1–3 page digest with summary, clauses, dates, reminders, and
  a clear "informational only" footer.
- **CSV**: machine-readable clauses + dates (two CSV files in a zip, or
  a choice query param).

Free plan: 5 exports / 30 days. Pro: unlimited.

## Non-goals

- Not editable PDF templates.
- Not Word / Excel formats.
- Not bulk export across documents (single document only).
- Not branded white-label exports.

## Architecture

| File | Purpose |
|---|---|
| `supabase/migrations/20260620000100_document_exports.sql` | `document_exports` audit table (id, user_id, document_id, format, created_at) |
| `src/lib/exports/pdf.ts` | Renders document digest to PDF buffer using `@react-pdf/renderer` |
| `src/lib/exports/csv.ts` | Serialises clauses + dates to CSV strings |
| `src/lib/exports/zip.ts` | Wraps multiple CSV files into a zip buffer (use `jszip`) |
| `src/lib/exports/limits.ts` | `canExport(supabase, userId)` — checks 5/30d for free, unlimited for Pro |
| `src/app/api/documents/[id]/export/route.ts` | `GET ?format=pdf\|csv` returns a binary download |
| `src/components/dashboard/document-actions/export-button.tsx` | Dropdown: PDF / CSV |
| `src/components/dashboard/document-view.tsx` | Add the button to the action bar (next to Share/Compare) |

## Commit cadence (CRITICAL)

**Commit + push after EACH numbered deliverable below.** Each commit
must build + lint + test clean. Conventional Commits.

## Deliverables

### 1. Migration + audit + limit helper
- Write `supabase/migrations/20260620000100_document_exports.sql` (do NOT apply):
  ```sql
  create table public.document_exports (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users(id) on delete cascade,
    document_id uuid not null references public.documents(id) on delete cascade,
    format text not null check (format in ('pdf', 'csv')),
    created_at timestamptz not null default now()
  );
  alter table public.document_exports enable row level security;
  create policy "owners read own exports" on public.document_exports
    for select using (user_id = (select auth.uid()));
  grant select on public.document_exports to authenticated;
  create index document_exports_user_created_idx
    on public.document_exports (user_id, created_at desc);
  ```
- Add type to `src/lib/supabase/types.ts`
- Write `src/lib/exports/limits.ts`:
  - `canExport(supabase, userId)` returns `{allowed, used, limit, plan, resetsAt}`
  - Free: count of last 30 days < 5
  - Pro: always allowed
  - Mirror the shape of `canAskQuestion` for consistency
- Tests: `src/lib/exports/__tests__/limits.test.ts` (4 tests min)
- Commit: `feat(db): add document_exports audit table + limit helper`

### 2. PDF + CSV renderers
- `npm install @react-pdf/renderer jszip`
- `src/lib/exports/pdf.ts`:
  - `renderDocumentPdf({document, clauses, dates, reminders})` returns `Buffer`
  - Layout: cover page (title, party, dates) → summary → clauses table → dates → reminders → footer ("Informational only — not legal advice")
  - Use the existing brand color tokens via inline hex (PDF doesn't read CSS vars)
- `src/lib/exports/csv.ts`:
  - `clausesToCsv(clauses)` and `datesToCsv(dates)` return RFC-4180 strings
  - Escape `"` and `,` correctly, CRLF line endings
- `src/lib/exports/zip.ts`:
  - `buildExportZip({clausesCsv, datesCsv})` returns `Buffer`
- Tests: 6 minimum (PDF buffer non-empty, CSV escaping, zip contents)
- Commit: `feat(exports): add PDF + CSV + zip renderers`

### 3. API route
- `GET /api/documents/[id]/export?format=pdf|csv`
- Auth: 401 unauth, 404 if doc not owned
- Limit gate: 429 with `{error, used, limit, plan, resetsAt}` if exceeded
- PDF: `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="<slug>.pdf"`
- CSV: returns zip, `Content-Type: application/zip`, filename `<slug>-export.zip`
- After successful response: insert `document_exports` audit row (best-effort, log on failure but don't block)
- Mock mode: returns a tiny canned PDF / CSV
- Tests: 6 minimum (happy PDF, happy CSV, 401, 404, 429, mock mode)
- Commit: `feat(api): add /api/documents/[id]/export route`

### 4. UI button
- `src/components/dashboard/document-actions/export-button.tsx`:
  - Dropdown menu with PDF / CSV options
  - On click: triggers download via `<a href download>` or `fetch + blob`
  - Disabled state with tooltip if 429 returned
  - Shows toast on error (use existing toast helper)
- Wire into `document-view.tsx` action bar
- Free-user count display: "3 of 5 exports used this month" small text below
- Tests: 3 minimum (renders, click triggers fetch, disabled when over limit)
- Commit: `feat(exports): add Export button to document detail`

## Tests required

- Limits: 4
- Renderers: 6
- API: 6
- UI: 3
- Total: ~19 new tests

## Definition of done

- `npm test` ✅ all passing (currently 307)
- `npm run lint` ✅ clean
- `npx tsc --noEmit` ✅ clean
- `npx next build` ✅ clean (watch for function size warnings — if PDF
  blows past 50MB function size, switch to streamed rendering)
- Migration written but NOT applied
- All 4 commits pushed to `track-rr-document-export`
- PR body QA hook:
  1. Open document → click Export → PDF → file downloads, opens cleanly
  2. Click Export → CSV → zip downloads with `clauses.csv` + `dates.csv`
  3. On free plan, 6th export in 30d returns 429 with clear toast
- No regressions on document detail

## Function size caveat

`@react-pdf/renderer` adds ~5MB to the function. Vercel hobby limit is
50MB; check `npx next build` output. If it crosses, use the
`puppeteer-core` + `@sparticuz/chromium` route instead (more setup,
smaller). Default to `@react-pdf/renderer` first.
