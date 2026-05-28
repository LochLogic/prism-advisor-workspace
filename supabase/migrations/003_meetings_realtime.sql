-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Migration 003 — Meetings log + realtime publications
-- Run in the Supabase SQL editor after 002_accounts.sql
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Meetings table — advisor-logged client sessions
create table if not exists meetings (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients(id) on delete cascade,
  advisor_id    uuid not null references advisors(id) on delete cascade,
  met_at        timestamptz not null default now(),
  duration_min  int,           -- meeting length in minutes (nullable)
  notes         text,          -- free-form notes
  created_at    timestamptz default now()
);

create index if not exists meetings_client_idx on meetings(client_id);
create index if not exists meetings_advisor_idx on meetings(advisor_id);

-- 2. RLS — advisor sees / manages only their own meetings
alter table meetings enable row level security;

create policy meetings_advisor on meetings
  for all
  using (advisor_id = px_current_advisor_id())
  with check (advisor_id = px_current_advisor_id());

-- 3. Enable realtime publications
-- Each block silently ignores "already a member" errors so the script is
-- safe to run more than once.

do $$ begin
  alter publication supabase_realtime add table alerts;
exception when others then null; end $$;

do $$ begin
  alter publication supabase_realtime add table flagged_questions;
exception when others then null; end $$;

do $$ begin
  alter publication supabase_realtime add table meetings;
exception when others then null; end $$;
