-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Migration 004 — Flag messages (reply thread on flagged questions)
-- Run in the Supabase SQL editor after 003_meetings_realtime.sql
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Reply-thread table — advisor ↔ client messages on a flagged question
create table if not exists flag_messages (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references flagged_questions(id) on delete cascade,
  author_id    uuid not null,              -- advisors.id or clients.id
  author_role  text not null check (author_role in ('advisor', 'client')),
  body         text not null,
  created_at   timestamptz not null default now()
);

create index if not exists flag_messages_question_idx on flag_messages(question_id);
create index if not exists flag_messages_created_idx  on flag_messages(created_at);

-- 2. RLS — each party sees only threads on questions they own
alter table flag_messages enable row level security;

-- Advisors: full access to threads on their flagged questions
create policy flag_messages_advisor on flag_messages
  for all
  using (
    exists (
      select 1 from flagged_questions fq
       where fq.id = flag_messages.question_id
         and fq.advisor_id = px_current_advisor_id()
    )
  )
  with check (
    exists (
      select 1 from flagged_questions fq
       where fq.id = flag_messages.question_id
         and fq.advisor_id = px_current_advisor_id()
    )
  );

-- Clients: full access to threads on their own questions
create policy flag_messages_client on flag_messages
  for all
  using (
    exists (
      select 1 from flagged_questions fq
       where fq.id = flag_messages.question_id
         and fq.client_id = px_current_client_id()
    )
  )
  with check (
    exists (
      select 1 from flagged_questions fq
       where fq.id = flag_messages.question_id
         and fq.client_id = px_current_client_id()
    )
  );

-- 3. Realtime publication
do $$ begin
  alter publication supabase_realtime add table flag_messages;
exception when others then null; end $$;
