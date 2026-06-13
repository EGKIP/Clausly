-- Ask Clausly document Q&A retrieval layer.

create extension if not exists vector;

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null check (length(trim(content)) > 0),
  page_number integer check (page_number is null or page_number > 0),
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create unique index if not exists document_chunks_document_index_idx
on public.document_chunks(document_id, chunk_index);

create index if not exists document_chunks_user_document_idx
on public.document_chunks(user_id, document_id);

create index if not exists document_chunks_embedding_idx
on public.document_chunks
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

alter table public.document_chunks enable row level security;

drop policy if exists "Users can read their document chunks" on public.document_chunks;
create policy "Users can read their document chunks"
on public.document_chunks for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their document chunks" on public.document_chunks;
create policy "Users can create their document chunks"
on public.document_chunks for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their document chunks" on public.document_chunks;
create policy "Users can update their document chunks"
on public.document_chunks for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their document chunks" on public.document_chunks;
create policy "Users can delete their document chunks"
on public.document_chunks for delete
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.match_document_chunks(
  target_document_id uuid,
  query_embedding vector(1536),
  match_count integer default 5
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
  select
    dc.id,
    dc.document_id,
    dc.user_id,
    dc.chunk_index,
    dc.content,
    dc.page_number,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  where dc.document_id = target_document_id
    and dc.user_id = (select auth.uid())
    and dc.embedding is not null
  order by dc.embedding <=> query_embedding
  limit greatest(match_count, 0);
$$;

grant select, insert, update, delete on public.document_chunks to authenticated;
grant execute on function public.match_document_chunks(uuid, vector, integer) to authenticated;
