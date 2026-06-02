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

reset role;

do $$ begin raise notice '──────────────  RLS ISOLATION: ALL CHECKS PASSED  ──────────────'; end $$;

-- Leave no trace.
rollback;
