-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Migration 007 — Profile versioning (15e) + CRM workflow (17)
-- Run in the Supabase SQL editor after 006_audit_compliance.sql
-- ════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────
-- 1. Profile version history (SEC 17a-3/17a-4: version, never overwrite)
--    Every profile save appends an immutable snapshot. Read-only to the
--    advisor/client pair; no update/delete policy → tamper-resistant.
-- ────────────────────────────────────────────────────────────────────
create table if not exists profile_versions (
  id         bigint generated always as identity primary key,
  client_id  uuid not null references clients(id) on delete cascade,
  version    int  not null default 0,
  data       jsonb not null,
  saved_by   uuid,
  saved_at   timestamptz not null default now()
);
create index if not exists profile_versions_client_idx on profile_versions(client_id, version desc);

-- Auto-increment version per client
create or replace function set_profile_version() returns trigger
language plpgsql as $$
begin
  select coalesce(max(version), 0) + 1 into new.version
  from profile_versions where client_id = new.client_id;
  return new;
end $$;

drop trigger if exists trg_profile_version on profile_versions;
create trigger trg_profile_version before insert on profile_versions
  for each row execute function set_profile_version();

alter table profile_versions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='profile_versions' and policyname='pv_select_pair') then
    create policy pv_select_pair on profile_versions for select using (
      client_id = px_current_client_id()
      or exists (select 1 from clients c where c.id = profile_versions.client_id and c.advisor_id = px_current_advisor_id())
    );
  end if;
  if not exists (select 1 from pg_policies where tablename='profile_versions' and policyname='pv_insert_pair') then
    create policy pv_insert_pair on profile_versions for insert with check (
      client_id = px_current_client_id()
      or exists (select 1 from clients c where c.id = profile_versions.client_id and c.advisor_id = px_current_advisor_id())
    );
  end if;
end $$;

-- ────────────────────────────────────────────────────────────────────
-- 2. CRM workflow tasks (17b / 17c / 17d)
-- ────────────────────────────────────────────────────────────────────
create table if not exists crm_tasks (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid references firms(id) on delete cascade,
  advisor_id   uuid not null references advisors(id) on delete cascade,
  client_id    uuid references clients(id) on delete set null,
  title        text not null,
  detail       text,
  priority     text not null default 'normal',  -- low | normal | high
  status       text not null default 'open',    -- open | done
  due_at       timestamptz,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists crm_tasks_advisor_idx on crm_tasks(advisor_id, status, due_at);
create index if not exists crm_tasks_client_idx  on crm_tasks(client_id);

alter table crm_tasks enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='crm_tasks' and policyname='crm_tasks_advisor') then
    create policy crm_tasks_advisor on crm_tasks for all
      using (advisor_id = px_current_advisor_id())
      with check (advisor_id = px_current_advisor_id());
  end if;
  if not exists (select 1 from pg_policies where tablename='crm_tasks' and policyname='crm_tasks_admin_read') then
    create policy crm_tasks_admin_read on crm_tasks for select
      using (firm_id = px_current_firm_id() and px_is_firm_admin());
  end if;
end $$;

-- ────────────────────────────────────────────────────────────────────
-- 3. Pipeline stage on clients (17b)
-- ────────────────────────────────────────────────────────────────────
alter table clients add column if not exists pipeline_stage text default 'active';
-- lead | onboarding | active | review_due | inactive
