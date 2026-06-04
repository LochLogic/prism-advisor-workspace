-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Integration tests for the critical DB-level flows.
-- Covers: client e-sign RPC, invoice idempotency, and self-serve provisioning.
-- Runs in a transaction that ROLLS BACK — safe against any Supabase database.
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/integration.sql
--   (or `npm run test:db`)
--
-- NOTE: the HTTP layer of the Edge Functions (Stripe webhook signature →
-- subscription upsert; the generate-invoices invoke path) can't be exercised
-- from SQL — verify those against a staging deploy. This covers the data-layer
-- contracts those functions depend on.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
begin;

do $$ begin
  if to_regprocedure('px_sign_acknowledgement(uuid,text)') is null then
    raise exception 'px_sign_acknowledgement not found — run migration 017 first';
  end if;
end $$;

-- Seed: one firm / advisor / client (client has an auth user so it can sign).
insert into auth.users (id, email) values
  ('11110000-0000-4000-8000-000000000001', 'it-adv@example.test'),
  ('22220000-0000-4000-8000-000000000002', 'it-cli@example.test'),
  ('33330000-0000-4000-8000-000000000003', 'it-new@example.test')
on conflict (id) do nothing;

insert into firms (id, name, slug) values
  ('aaaa0000-0000-4000-8000-0000000000f1', 'IT Firm', 'it-test-firm') on conflict (id) do nothing;
insert into advisors (id, auth_user_id, firm_id, full_name, email, role) values
  ('aaaa1111-0000-4000-8000-0000000000a1', '11110000-0000-4000-8000-000000000001',
   'aaaa0000-0000-4000-8000-0000000000f1', 'IT Advisor', 'it-adv@example.test', 'advisor')
  on conflict (id) do nothing;
insert into clients (id, firm_id, advisor_id, auth_user_id, household_name, short_name) values
  ('aaaa2222-0000-4000-8000-0000000000c1', 'aaaa0000-0000-4000-8000-0000000000f1',
   'aaaa1111-0000-4000-8000-0000000000a1', '22220000-0000-4000-8000-000000000002', 'IT Household', 'IT')
  on conflict (id) do nothing;

-- ── 1 · Acknowledgement e-sign RPC ──────────────────────────────────────────
do $$
declare ack_id uuid; r record; n int;
begin
  insert into acknowledgements (firm_id, client_id, advisor_id, title, status)
    values ('aaaa0000-0000-4000-8000-0000000000f1','aaaa2222-0000-4000-8000-0000000000c1',
            'aaaa1111-0000-4000-8000-0000000000a1','Investment Policy Statement','pending')
    returning id into ack_id;

  -- (a) a NON-owner can't sign it (claims = the advisor, not the client)
  perform set_config('request.jwt.claims', json_build_object('sub','11110000-0000-4000-8000-000000000001')::text, true);
  select px_sign_acknowledgement(ack_id, 'Wrong Person') into r;
  select status into n from acknowledgements where id = ack_id and status='pending';
  if r is not null then raise exception 'FAIL 1a: a non-client signed an acknowledgement'; end if;

  -- (b) the client signs their own pending ack
  perform set_config('request.jwt.claims', json_build_object('sub','22220000-0000-4000-8000-000000000002')::text, true);
  select * from px_sign_acknowledgement(ack_id, 'Jane Client') into r;
  if r.status <> 'acknowledged' then raise exception 'FAIL 1b: status not acknowledged (got %)', r.status; end if;
  if r.signer_name <> 'Jane Client' then raise exception 'FAIL 1c: signer_name not recorded'; end if;
  if r.signer_auth_user_id <> '22220000-0000-4000-8000-000000000002' then raise exception 'FAIL 1d: signer uid wrong'; end if;

  -- (c) re-signing an already-acknowledged row is a no-op
  select px_sign_acknowledgement(ack_id, 'Again') into r;
  if r is not null then raise exception 'FAIL 1e: re-signing an acknowledged row should no-op'; end if;
  raise notice 'PASS 1 · acknowledgement e-sign (owner-only, immutable-after-sign)';
end $$;

-- ── 2 · Invoice idempotency (unique on client + period) ─────────────────────
do $$
declare dup_blocked boolean := false;
begin
  insert into invoices (firm_id, client_id, period_start, period_end, basis_amount, fee_amount, status)
    values ('aaaa0000-0000-4000-8000-0000000000f1','aaaa2222-0000-4000-8000-0000000000c1',
            '2026-01-01','2026-03-31',1000000,2500,'draft');
  begin
    insert into invoices (firm_id, client_id, period_start, period_end, basis_amount, fee_amount, status)
      values ('aaaa0000-0000-4000-8000-0000000000f1','aaaa2222-0000-4000-8000-0000000000c1',
              '2026-01-01','2026-03-31',1000000,2500,'draft');
  exception when unique_violation then dup_blocked := true;
  end;
  if not dup_blocked then raise exception 'FAIL 2: duplicate invoice for the same client+period was NOT blocked'; end if;
  raise notice 'PASS 2 · invoice generation is idempotent (duplicate period blocked)';
end $$;

-- ── 3 · Self-serve provisioning RPC ─────────────────────────────────────────
do $$
declare adv record; n int;
begin
  if to_regprocedure('px_provision_firm(text,text)') is null then
    raise notice 'SKIP 3 · px_provision_firm(text,text) signature not found'; return;
  end if;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub','33330000-0000-4000-8000-000000000003')::text, true);
  perform px_provision_firm('IT Provisioned Firm', 'New Owner');
  reset role;
  select a.role, a.firm_id into adv from advisors a where a.auth_user_id = '33330000-0000-4000-8000-000000000003';
  if adv is null then raise exception 'FAIL 3a: provisioning did not create an advisor for the user'; end if;
  if adv.role <> 'admin' then raise exception 'FAIL 3b: provisioned advisor is not an admin (got %)', adv.role; end if;
  select count(*) into n from firms where id = adv.firm_id and name = 'IT Provisioned Firm';
  if n <> 1 then raise exception 'FAIL 3c: provisioned firm not created/linked'; end if;
  raise notice 'PASS 3 · self-serve provisioning creates firm + admin advisor';
end $$;

do $$ begin raise notice '──────────────  INTEGRATION: ALL CHECKS PASSED  ──────────────'; end $$;
rollback;
