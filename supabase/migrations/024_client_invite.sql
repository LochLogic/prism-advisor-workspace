-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Migration 024 — Client connect / invite flow
-- Run in the Supabase SQL editor after 023_billing_cron_vault_secret.sql
--
-- Gap (surfaced 2026-06-07): an advisor-created `clients` row has a NULL
-- auth_user_id, so nothing links a client's own sign-in to their household —
-- the client portal was only reachable through the advisor's "Client view."
--
-- This adds an invite/claim handshake (mirror of px_provision_firm):
--   1. The advisor (or a firm admin) calls px_create_client_invite(client, email)
--      → a single-use, unguessable claim code is stored on the client row.
--   2. The advisor shares  /login.html?claim=<code>  with the client.
--   3. The client signs in (magic link / password) and calls px_claim_client(code)
--      → clients.auth_user_id is bound to auth.uid() and the code is consumed.
--
-- Both RPCs are SECURITY DEFINER: the advisor path so a firm admin can invite a
-- client outside their own book (the RLS modify policy is advisor-scoped), and
-- the claim path because the claiming user has no client row to satisfy RLS yet.
-- Each function enforces its own authorization explicitly.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Invite columns on clients ───────────────────────────────────────────────
alter table clients add column if not exists invite_code  text;
alter table clients add column if not exists invite_email text;
alter table clients add column if not exists invited_at   timestamptz;
alter table clients add column if not exists claimed_at   timestamptz;

-- A live (unclaimed) code must be unique; consumed codes are nulled out, so the
-- partial unique index only constrains outstanding invites.
create unique index if not exists clients_invite_code_uidx
  on clients(invite_code) where invite_code is not null;

-- ── Advisor/admin: create (or rotate) a client's invite code ────────────────
create or replace function px_create_client_invite(p_client_id uuid, p_email text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_advisor  advisors%rowtype;
  v_client   clients%rowtype;
  v_code     text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_advisor from advisors where auth_user_id = v_uid;
  if v_advisor.id is null then
    raise exception 'only an advisor can invite a client';
  end if;

  select * into v_client from clients where id = p_client_id;
  if v_client.id is null then
    raise exception 'client not found';
  end if;

  -- Authorization: the client's own advisor, or a firm admin in the same firm.
  if not (v_client.advisor_id = v_advisor.id
          or (v_advisor.role = 'admin' and v_client.firm_id = v_advisor.firm_id)) then
    raise exception 'not authorized to invite this client';
  end if;

  if v_client.auth_user_id is not null then
    raise exception 'this client has already connected their portal';
  end if;

  -- 32 hex chars (~122 bits) — unguessable, URL-safe.
  v_code := replace(gen_random_uuid()::text, '-', '');

  update clients
     set invite_code  = v_code,
         invite_email = nullif(trim(p_email), ''),
         invited_at   = now()
   where id = p_client_id;

  insert into audit_log (actor_id, actor_role, actor_email, firm_id, action, entity_type, entity_id, client_id, summary)
    values (v_uid, case when v_advisor.role = 'admin' then 'admin' else 'advisor' end,
            v_advisor.email, v_client.firm_id, 'client.invite', 'client', p_client_id::text, p_client_id,
            'Generated client portal invite');

  return v_code;
end;
$$;

grant execute on function px_create_client_invite(uuid, text) to authenticated;

-- ── Client: claim a household with an invite code ───────────────────────────
create or replace function px_claim_client(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_email   text;
  v_client  clients%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Never re-bind an already-provisioned auth user (advisor or client).
  if exists (select 1 from advisors where auth_user_id = v_uid)
     or exists (select 1 from clients where auth_user_id = v_uid) then
    raise exception 'account already provisioned';
  end if;

  select email into v_email from auth.users where id = v_uid;

  select * into v_client
    from clients
   where invite_code = nullif(trim(p_code), '')
     and auth_user_id is null;
  if v_client.id is null then
    raise exception 'invalid or already-used invite code';
  end if;

  -- If the advisor scoped the invite to an email, the claimer must match it.
  if v_client.invite_email is not null
     and lower(v_client.invite_email) <> lower(coalesce(v_email, '')) then
    raise exception 'this invite was issued to a different email address';
  end if;

  update clients
     set auth_user_id = v_uid,
         claimed_at   = now(),
         invite_code  = null   -- single-use: consume on claim
   where id = v_client.id;

  insert into audit_log (actor_id, actor_role, actor_email, firm_id, action, entity_type, entity_id, client_id, summary)
    values (v_uid, 'client', v_email, v_client.firm_id, 'client.claim', 'client', v_client.id::text, v_client.id,
            'Client connected their portal via invite');

  return v_client.id;
end;
$$;

grant execute on function px_claim_client(text) to authenticated;
