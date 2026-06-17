create table public.qa_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  document_id uuid references public.documents(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.qa_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.qa_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.qa_conversations enable row level security;
alter table public.qa_messages enable row level security;

create policy "Users can read their own QA conversations"
  on public.qa_conversations for select
  using (user_id = (select auth.uid()));

create policy "Users can insert their own QA conversations"
  on public.qa_conversations for insert
  with check (user_id = (select auth.uid()));

create policy "Users can update their own QA conversations"
  on public.qa_conversations for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users can read their own QA messages"
  on public.qa_messages for select
  using (
    exists (
      select 1 from public.qa_conversations
      where qa_conversations.id = qa_messages.conversation_id
      and qa_conversations.user_id = (select auth.uid())
    )
  );

create policy "Users can insert messages into their own QA conversations"
  on public.qa_messages for insert
  with check (
    exists (
      select 1 from public.qa_conversations
      where qa_conversations.id = qa_messages.conversation_id
      and qa_conversations.user_id = (select auth.uid())
    )
  );

create policy "Users can update messages in their own QA conversations"
  on public.qa_messages for update
  using (
    exists (
      select 1 from public.qa_conversations
      where qa_conversations.id = qa_messages.conversation_id
      and qa_conversations.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.qa_conversations
      where qa_conversations.id = qa_messages.conversation_id
      and qa_conversations.user_id = (select auth.uid())
    )
  );

create index qa_conversations_user_created_idx
  on public.qa_conversations (user_id, created_at desc);

create index qa_conversations_user_document_created_idx
  on public.qa_conversations (user_id, document_id, created_at desc);

create index qa_messages_conversation_created_idx
  on public.qa_messages (conversation_id, created_at);

drop trigger if exists qa_conversations_set_updated_at on public.qa_conversations;
create trigger qa_conversations_set_updated_at
before update on public.qa_conversations
for each row execute function public.set_updated_at();

grant select, insert, update on public.qa_conversations to authenticated;
grant select, insert, update on public.qa_messages to authenticated;
