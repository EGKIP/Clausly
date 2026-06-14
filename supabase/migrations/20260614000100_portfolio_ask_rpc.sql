-- Portfolio-level Ask Clausly retrieval across all indexed chunks for a user.

create or replace function public.match_portfolio_chunks(
  query_embedding vector(1536),
  match_count integer default 12,
  per_doc_cap integer default 3
)
returns table (
  id uuid,
  document_id uuid,
  user_id uuid,
  chunk_index integer,
  content text,
  page_number integer,
  similarity double precision
)
language sql
stable
as $$
  with ranked as (
    select
      dc.id,
      dc.document_id,
      dc.user_id,
      dc.chunk_index,
      dc.content,
      dc.page_number,
      1 - (dc.embedding <=> query_embedding) as similarity,
      row_number() over (
        partition by dc.document_id
        order by dc.embedding <=> query_embedding
      ) as document_rank
    from public.document_chunks dc
    where dc.user_id = (select auth.uid())
      and dc.embedding is not null
  )
  select
    ranked.id,
    ranked.document_id,
    ranked.user_id,
    ranked.chunk_index,
    ranked.content,
    ranked.page_number,
    ranked.similarity
  from ranked
  where ranked.document_rank <= greatest(per_doc_cap, 0)
  order by ranked.similarity desc
  limit greatest(match_count, 0);
$$;

grant execute on function public.match_portfolio_chunks(vector, integer, integer) to authenticated;
