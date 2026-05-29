-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Migration 006 — Compliance Foundation
--   • Append-only audit_log (SEC 17a-3 "records made" + FINRA audit trail)
--   • WORM-style soft deletes on accounts & meetings (SEC 17a-4 "no erase")
-- Run in the Supabase SQL editor after 005_phase_library.sql
-- ════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────
-- 1. Audit log — immutable record of every material action
-- ────────────────────────────────────────────────────────────────────
create table if not exists audit_log (
  id           bigint generated always as identity primary key,
  occurred_at  timestamptz not null default now(),
  actor_id     uuid,                 -- auth.uid() of the user who acted
  actor_role   text,                 -- advisor | admin | client | system
  actor_email  text,
  firm_id      uuid,                 -- denormalized for firm-admin filtering
  action       text not null,        -- e.g. client.create, account.update, meeting.delete
  entity_type  text,                 -- client | account | meeting | profile | question | auth
  entity_id    text,
  client_id    uuid,                 -- denormalized for per-household filtering
  summary      text,                 -- human-readable description
  metadata     jsonb not null default '{}'::jsonb,
  ip_address   text,
  user_agent   text
);

create index if not exists audit_firm_idx    on audit_log(firm_id, occurred_at desc);
create index if not exists audit_client_idx   on audit_log(client_id, occurred_at desc);
create index if not exists audit_actor_idx    on audit_log(actor_id, occurred_at desc);

-- ── RLS ──
-- The table is append-only: we create INSERT + SELECT policies but deliberately
-- NO update/delete policies, so RLS denies mutation of existing rows for every
-- non-service role. (True storage-level WORM per 17a-4(f) is a deployment
-- concern — see roadmap; this enforces app-level immutability.)
alter table audit_log enable row level security;

do $$ begin
  -- Any authenticated user may append, but only as themselves
  if not exists (select 1 from pg_policies where tablename='audit_log' and policyname='audit_insert_self') then
    create policy audit_insert_self on audit_log
      for insert with check (actor_id = auth.uid());
  end if;

  -- Firm admins read the whole firm's trail
  if not exists (select 1 from pg_policies where tablename='audit_log' and policyname='audit_select_admin') then
    create policy audit_select_admin on audit_log
      for select using (firm_id = px_current_firm_id() and px_is_firm_admin());
  end if;

  -- Advisors read their own actions + anything touching one of their clients
  if not exists (select 1 from pg_policies where tablename='audit_log' and policyname='audit_select_advisor') then
    create policy audit_select_advisor on audit_log
      for select using (
        actor_id = auth.uid()
        or client_id in (select id from clients where advisor_id = px_current_advisor_id())
      );
  end if;
end $$;

-- ────────────────────────────────────────────────────────────────────
-- 2. WORM soft deletes — preserve records instead of erasing them
--    (SEC 17a-4 requires records be kept; "delete" becomes "archive")
-- ────────────────────────────────────────────────────────────────────
alter table accounts add column if not exists archived_at timestamptz;
alter table meetings add column if not exists archived_at timestamptz;

create index if not exists accounts_active_idx on accounts(client_id) where archived_at is null;
create index if not exists meetings_active_idx on meetings(client_id) where archived_at is null;
