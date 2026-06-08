-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Migration 028 — Tamper-resistant audit writes (clean-room review C2)
--
-- Before this, the only INSERT check on audit_log was `actor_id = auth.uid()`
-- (migration 006, policy `audit_insert_self`). Every other column — actor_role,
-- firm_id, client_id, action, summary, metadata — was supplied verbatim by the
-- browser via the anon key. So any authenticated user (including a portal client)
-- could forge audit rows: assert actor_role='admin', an arbitrary summary, or
-- another firm's firm_id (which then surfaces in THAT firm admin's compliance
-- feed via `audit_select_admin`). For a product whose value is a compliance-grade
-- append-only trail, that is a data-integrity hole.
--
-- Fix: route all client-side audit writes through a SECURITY DEFINER function
-- that stamps actor_id / actor_role / actor_email / firm_id from the session — never
-- from the request — and drops any client_id that isn't in the caller's own firm.
-- Then remove the permissive direct-insert policy. (Service-role edge-function
-- inserts and the existing SECURITY DEFINER functions bypass RLS and are unaffected;
-- the trail stays append-only — no UPDATE/DELETE policy is added.)
-- Idempotent — safe to re-run. Run after 027_docusign_envelope.sql.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function px_audit(
  p_action       text,
  p_entity_type  text  default null,
  p_entity_id    text  default null,
  p_client_id    uuid  default null,
  p_summary      text  default null,
  p_metadata     jsonb default '{}'::jsonb,
  p_user_agent   text  default null
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_role   text;
  v_email  text;
  v_firm   uuid;
  v_client uuid := null;
begin
  if v_uid is null then
    return;  -- no session (demo) — nothing to record, and no identity to trust
  end if;

  -- Identity is derived from the session, NEVER from the caller's input.
  select case when a.role = 'admin' then 'admin' else 'advisor' end, a.email, a.firm_id
    into v_role, v_email, v_firm
    from advisors a
   where a.auth_user_id = v_uid;

  if v_role is null then
    -- Not an advisor — try the client side (portal user).
    select 'client', c.firm_id, c.id
      into v_role, v_firm, v_client
      from clients c
     where c.auth_user_id = v_uid;
    if v_role is not null then
      select email into v_email from auth.users where id = v_uid;
    end if;
  end if;

  if v_role is null then
    return;  -- authenticated but unprovisioned — no audit identity to stamp
  end if;

  -- Only honour a supplied client_id if it belongs to the caller's OWN firm.
  -- Otherwise keep the derived value (a client's own id, or null for an advisor) —
  -- this is what blocks cross-tenant client_id injection into another firm's feed.
  if p_client_id is not null
     and exists (select 1 from clients c where c.id = p_client_id and c.firm_id = v_firm) then
    v_client := p_client_id;
  end if;

  insert into audit_log (actor_id, actor_role, actor_email, firm_id, action,
                         entity_type, entity_id, client_id, summary, metadata, user_agent)
  values (v_uid, v_role, v_email, v_firm, p_action,
          p_entity_type, p_entity_id, v_client, p_summary,
          coalesce(p_metadata, '{}'::jsonb), left(p_user_agent, 400));
end $$;

grant execute on function px_audit(text, text, text, uuid, text, jsonb, text) to authenticated;

-- Remove the permissive direct-insert policy: clients now write only through
-- px_audit (which stamps a trustworthy actor/firm). Existing rows are untouched,
-- and the trail remains append-only (no update/delete policy exists).
do $$ begin
  if exists (select 1 from pg_policies where tablename = 'audit_log' and policyname = 'audit_insert_self') then
    drop policy audit_insert_self on audit_log;
  end if;
end $$;
