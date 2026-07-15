-- Adds durability bookkeeping for the document analysis pipeline: a start
-- timestamp + monotonic attempt counter (used as a concurrency fencing token
-- so a stale/superseded analysis attempt can't clobber a newer one's results)
-- and a coarse failure category for user-facing messaging. Additive only;
-- not applied to any live database by this commit.

alter table public.documents
  add column if not exists analysis_started_at timestamptz;

alter table public.documents
  add column if not exists analysis_attempts integer not null default 0;

alter table public.documents
  add column if not exists failure_category text;

alter table public.documents
  drop constraint if exists documents_failure_category_check;

alter table public.documents
  add constraint documents_failure_category_check
  check (
    failure_category is null or failure_category in (
      'unsupported_file',
      'storage_error',
      'extraction_timeout',
      'no_text',
      'provider_error',
      'stuck_timeout',
      'unknown'
    )
  );

-- Supports the stuck-analysis recovery sweep's query
-- (status = 'analyzing' and analysis_started_at < cutoff).
create index if not exists documents_stuck_analyzing_idx
  on public.documents (analysis_started_at)
  where status = 'analyzing';
