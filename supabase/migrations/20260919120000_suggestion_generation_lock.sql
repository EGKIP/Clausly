-- The suggested-questions endpoints poll every 2.5s while generation runs in
-- the background (after()). Without a lock, every poll that lands before the
-- first generation finishes re-triggers a full embedding + LLM run and
-- inserts another usage_metrics row against the user's daily Q&A quota for
-- what should be a single generation. This column lets the route recognize
-- "a generation is already in flight" and skip re-triggering one.
alter table public.document_suggestions add column generating_at timestamptz;
alter table public.portfolio_suggestions add column generating_at timestamptz;
