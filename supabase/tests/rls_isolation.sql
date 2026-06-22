-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Row-Level Security isolation test
--
-- Proves the firm → advisor → client tenant boundary actually holds in the
-- database, not just the UI. Seeds two independent firms, then — acting as each
-- user via a simulated JWT — asserts that no one can read or write across the
-- boundary. EVERYTHING RUNS IN A TRANSACTION THAT ROLLS BACK, so it leaves no
-- rows behind and is safe to run against any Prism (Supabase) database.
--
-- Run:   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_isolation.sql
--   or:   npm run test:rls   (wrapper; needs DATABASE_URL + psql)
--
-- A failed assertion RAISEs an exception → psql exits non-zero → the test fails.
-- (Fixed UUIDs are written as literals, not psql :vars, because psql does not
--  interpolate :vars inside dollar-quoted DO blocks.)
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

begin;

-- ── Preconditions: this must be a Supabase-shaped database ───────────────────
do $$
begin
  if to_regprocedure('auth.uid()') is null then
    raise exception 'auth.uid() not found — run this against a Supabase database';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise exception 'role "authenticated" not found — run this against a Supabase database';
  end if;
end $$;

-- ── Seed (as the connecting/superuser role — RLS is bypassed for seeding) ────
--   Firm A and Firm B are two unrelated tenants. UUIDs are namespaced so they
--   will not collide with real data; the whole transaction rolls back anyway.
insert into auth.users (id, email) values
  ('aaaa2222-0000-4000-8000-000000000001', 'adv-a@example.test'),
  ('bbbb2222-0000-4000-8000-000000000002', 'adv-b@example.test'),
  ('aaaa4444-0000-4000-8000-000000000001', 'cli-a@example.test')
on conflict (id) do nothing;

insert into firms (id, name, slug) values
  ('aaaa0000-0000-4000-8000-000000000001', 'Firm A', 'rls-test-firm-a'),
  ('bbbb0000-0000-4000-8000-000000000002', 'Firm B', 'rls-test-firm-b')
on conflict (id) do nothing;

insert into advisors (id, auth_user_id, firm_id, full_name, email, role) values
  ('aaaa1111-0000-4000-8000-000000000001', 'aaaa2222-0000-4000-8000-000000000001',
   'aaaa0000-0000-4000-8000-000000000001', 'Advisor A', 'adv-a@example.test', 'advisor'),
  ('bbbb1111-0000-4000-8000-000000000002', 'bbbb2222-0000-4000-8000-000000000002',
   'bbbb0000-0000-4000-8000-000000000002', 'Advisor B', 'adv-b@example.test', 'advisor')
on conflict (id) do nothing;

-- Inserting a client fires the seed trigger that creates its profile row.
insert into clients (id, firm_id, advisor_id, auth_user_id, household_name, short_name) values
  ('aaaa3333-0000-4000-8000-000000000001', 'aaaa0000-0000-4000-8000-000000000001',
   'aaaa1111-0000-4000-8000-000000000001', 'aaaa4444-0000-4000-8000-000000000001', 'Household A', 'A'),
  ('bbbb3333-0000-4000-8000-000000000002', 'bbbb0000-0000-4000-8000-000000000002',
   'bbbb1111-0000-4000-8000-000000000002', null, 'Household B', 'B')
on conflict (id) do nothing;

-- Seed a message + a document for Household A (used by checks 6 & 7). Guarded so the
-- test still runs on a database where migrations 019/020 haven't been applied yet.
do $$ begin
  if to_regclass('public.messages') is not null then
    insert into messages (id, firm_id, client_id, author_role, body) values
      ('aaaa5555-0000-4000-8000-000000000001', 'aaaa0000-0000-4000-8000-000000000001',
       'aaaa3333-0000-4000-8000-000000000001', 'advisor', 'rls-test message for A')
    on conflict (id) do nothing;
  end if;
  if to_regclass('public.documents') is not null then
    insert into documents (id, firm_id, client_id, category, title, file_name, storage_path) values
      ('aaaa6666-0000-4000-8000-000000000001', 'aaaa0000-0000-4000-8000-000000000001',
       'aaaa3333-0000-4000-8000-000000000001', 'ips', 'IPS A', 'ipsA.pdf',
       'aaaa3333-0000-4000-8000-000000000001/ipsA.pdf')
    on conflict (id) do nothing;
  end if;
  -- Seed a CX playbook override for Firm A (used by check 9; migration 045).
  if to_regclass('public.firm_playbooks') is not null then
    insert into firm_playbooks (firm_id, phase, questions, cadence) values
      ('aaaa0000-0000-4000-8000-000000000001', 0, array['rls-test question'], 'rls-test cadence')
    on conflict (firm_id, phase) do nothing;
  end if;
end $$;

-- Helper: become a given Supabase user (sets the JWT claims the RLS helpers read).
create or replace function pg_temp.act_as(p_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid)::text, true);
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
end $$;

-- Assertions run under the un-privileged `authenticated` role so RLS applies.
set local role authenticated;

-- ── 1 · Advisor A sees only their own book ──────────────────────────────────
do $$
declare n int; leak int;
begin
  perform pg_temp.act_as('aaaa2222-0000-4000-8000-000000000001');
  select count(*) into n    from clients;
  select count(*) into leak from clients where id = 'bbbb3333-0000-4000-8000-000000000002';
  if n <> 1    then raise exception 'FAIL 1a: Advisor A sees % client rows, expected 1', n; end if;
  if leak <> 0 then raise exception 'FAIL 1b: Advisor A can read Firm B''s client (cross-tenant leak)'; end if;
  raise notice 'PASS 1 · advisor sees only own book';
end $$;

-- ── 2 · Advisor B sees only their own book ──────────────────────────────────
do $$
declare n int; leak int;
begin
  perform pg_temp.act_as('bbbb2222-0000-4000-8000-000000000002');
  select count(*) into n    from clients;
  select count(*) into leak from clients where id = 'aaaa3333-0000-4000-8000-000000000001';
  if n <> 1    then raise exception 'FAIL 2a: Advisor B sees % client rows, expected 1', n; end if;
  if leak <> 0 then raise exception 'FAIL 2b: Advisor B can read Firm A''s client (cross-tenant leak)'; end if;
  raise notice 'PASS 2 · advisor sees only own book';
end $$;

-- ── 3 · Firm isolation: Advisor A cannot see Firm B ─────────────────────────
do $$
declare n int;
begin
  perform pg_temp.act_as('aaaa2222-0000-4000-8000-000000000001');
  select count(*) into n from firms where id = 'bbbb0000-0000-4000-8000-000000000002';
  if n <> 0 then raise exception 'FAIL 3a: Advisor A can read Firm B''s firm row'; end if;
  select count(*) into n from firms;
  if n <> 1 then raise exception 'FAIL 3b: Advisor A sees % firm rows, expected 1', n; end if;
  raise notice 'PASS 3 · firm row isolation holds';
end $$;

-- ── 4 · Client self-access: client A sees only their own client + profile ───
do $$
declare n int;
begin
  perform pg_temp.act_as('aaaa4444-0000-4000-8000-000000000001');
  select count(*) into n from clients;
  if n <> 1 then raise exception 'FAIL 4a: Client A sees % client rows, expected 1 (own)', n; end if;
  select count(*) into n from clients where id = 'bbbb3333-0000-4000-8000-000000000002';
  if n <> 0 then raise exception 'FAIL 4b: Client A can read another household'; end if;
  select count(*) into n from profiles where client_id = 'bbbb3333-0000-4000-8000-000000000002';
  if n <> 0 then raise exception 'FAIL 4c: Client A can read another household''s profile'; end if;
  raise notice 'PASS 4 · client self-access scoped to own household';
end $$;

-- ── 5 · Cross-tenant WRITE is blocked: Advisor A cannot mutate Firm B ────────
do $$
declare affected int;
begin
  perform pg_temp.act_as('aaaa2222-0000-4000-8000-000000000001');
  update clients set notes = 'tampered' where id = 'bbbb3333-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL 5: Advisor A updated % of Firm B''s client rows (write leak)', affected; end if;
  raise notice 'PASS 5 · cross-tenant write blocked';
end $$;

-- ── 6 · Messaging isolation (migration 019) ─────────────────────────────────
do $$
declare n int;
begin
  if to_regclass('public.messages') is null then
    raise notice 'SKIP 6 · messages table not present (run migration 019)';
  else
    -- Client A reads their own thread; Advisor B (other firm) cannot.
    perform pg_temp.act_as('aaaa4444-0000-4000-8000-000000000001');
    select count(*) into n from messages where client_id = 'aaaa3333-0000-4000-8000-000000000001';
    if n < 1 then raise exception 'FAIL 6a: Client A cannot read their own message'; end if;
    perform pg_temp.act_as('bbbb2222-0000-4000-8000-000000000002');
    select count(*) into n from messages where client_id = 'aaaa3333-0000-4000-8000-000000000001';
    if n <> 0 then raise exception 'FAIL 6b: Advisor B can read Firm A''s messages (cross-tenant leak)'; end if;
    raise notice 'PASS 6 · message thread isolation holds';
  end if;
end $$;

-- ── 7 · Document vault isolation (migration 020) ────────────────────────────
do $$
declare n int;
begin
  if to_regclass('public.documents') is null then
    raise notice 'SKIP 7 · documents table not present (run migration 020)';
  else
    -- Client A reads their own document; Advisor B (other firm) cannot.
    perform pg_temp.act_as('aaaa4444-0000-4000-8000-000000000001');
    select count(*) into n from documents where client_id = 'aaaa3333-0000-4000-8000-000000000001';
    if n < 1 then raise exception 'FAIL 7a: Client A cannot read their own document'; end if;
    perform pg_temp.act_as('bbbb2222-0000-4000-8000-000000000002');
    select count(*) into n from documents where client_id = 'aaaa3333-0000-4000-8000-000000000001';
    if n <> 0 then raise exception 'FAIL 7b: Advisor B can read Firm A''s documents (cross-tenant leak)'; end if;
    raise notice 'PASS 7 · document vault isolation holds';
  end if;
end $$;

-- ── 8 · Audit trail is not client-forgeable (migration 028) ─────────────────
do $$
declare affected int; n int;
begin
  if to_regprocedure('public.px_audit(text,text,text,uuid,text,jsonb,text)') is null then
    raise notice 'SKIP 8 · px_audit not present (run migration 028)';
  else
    perform pg_temp.act_as('aaaa2222-0000-4000-8000-000000000001');  -- Advisor A
    -- 8a · the permissive direct-insert policy is gone → a forged row is rejected.
    begin
      insert into audit_log (actor_id, actor_role, firm_id, action)
        values ('aaaa2222-0000-4000-8000-000000000001', 'admin',
                'bbbb0000-0000-4000-8000-000000000002', 'forged.event');
      get diagnostics affected = row_count;
      if affected <> 0 then raise exception 'FAIL 8a: advisor inserted an audit row directly (forgeable trail)'; end if;
    exception
      when insufficient_privilege then null;  -- RLS rejection is the pass path
    end;
    -- 8b · px_audit stamps the caller's REAL firm and drops a cross-firm client_id,
    --      so an audit row tagged to Firm B can never be produced by Advisor A.
    perform px_audit('client.update', 'client', null,
                     'bbbb3333-0000-4000-8000-000000000002'::uuid, 'attempt cross-firm', '{}'::jsonb, null);
    select count(*) into n from audit_log
      where actor_id = 'aaaa2222-0000-4000-8000-000000000001'
        and (firm_id = 'bbbb0000-0000-4000-8000-000000000002'
             or client_id = 'bbbb3333-0000-4000-8000-000000000002');
    if n <> 0 then raise exception 'FAIL 8b: px_audit accepted a foreign firm_id/client_id'; end if;
    raise notice 'PASS 8 · audit trail is not client-forgeable';
  end if;
end $$;

-- ── 9 · Firm CX playbook: firm-scoped read, admin-gated write (migration 045) ─
do $$
declare n int; affected int;
begin
  if to_regclass('public.firm_playbooks') is null then
    raise notice 'SKIP 9 · firm_playbooks not present (run migration 045)';
  else
    -- 9a · Advisor A reads only their own firm's playbook rows.
    perform pg_temp.act_as('aaaa2222-0000-4000-8000-000000000001');  -- Advisor A (Firm A)
    select count(*) into n from firm_playbooks;
    if n <> 1 then raise exception 'FAIL 9a: Advisor A sees % playbook rows, expected 1 (own firm)', n; end if;
    -- 9b · Advisor B cannot read Firm A's playbook (cross-tenant isolation).
    perform pg_temp.act_as('bbbb2222-0000-4000-8000-000000000002');  -- Advisor B (Firm B)
    select count(*) into n from firm_playbooks;
    if n <> 0 then raise exception 'FAIL 9b: Advisor B can read Firm A''s playbook (cross-tenant leak)'; end if;
    -- 9c · A non-admin advisor cannot author (write is admin-gated).
    perform pg_temp.act_as('aaaa2222-0000-4000-8000-000000000001');  -- Advisor A, role 'advisor'
    begin
      insert into firm_playbooks (firm_id, phase, cadence)
        values ('aaaa0000-0000-4000-8000-000000000001', 1, 'should be blocked');
      get diagnostics affected = row_count;
      if affected <> 0 then raise exception 'FAIL 9c: non-admin advisor authored a playbook (write not admin-gated)'; end if;
    exception
      when insufficient_privilege then null;  -- RLS rejection is the pass path
    end;
    raise notice 'PASS 9 · firm playbook: firm-scoped read, admin-gated write';
  end if;
end $$;

reset role;

do $$ begin raise notice '──────────────  RLS ISOLATION: ALL CHECKS PASSED  ──────────────'; end $$;

-- Leave no trace.
rollback;
