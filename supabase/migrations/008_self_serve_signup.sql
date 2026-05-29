-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Migration 008 — Self-serve signup provisioning (Option B)
-- Run in the Supabase SQL editor after 007_versioning_crm.sql
--
-- A SECURITY DEFINER function lets a freshly-signed-up auth user create their
-- own firm + first advisor (admin) row WITHOUT a backend server. It is safe
-- because it only ever acts for auth.uid(), refuses if the user is already
-- provisioned, and binds the new advisor to the caller's auth id.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function px_provision_firm(p_firm_name text, p_full_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_email     text;
  v_firm_id   uuid;
  v_advisor_id uuid;
  v_slug      text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Idempotency / safety: never provision twice for the same auth user
  if exists (select 1 from advisors where auth_user_id = v_uid)
     or exists (select 1 from clients where auth_user_id = v_uid) then
    raise exception 'account already provisioned';
  end if;

  select email into v_email from auth.users where id = v_uid;

  -- Slugify the firm name and suffix with part of the uid to guarantee uniqueness
  v_slug := lower(regexp_replace(coalesce(nullif(trim(p_firm_name), ''), 'firm'), '[^a-zA-Z0-9]+', '-', 'g'))
            || '-' || substr(v_uid::text, 1, 8);

  insert into firms (name, slug)
    values (coalesce(nullif(trim(p_firm_name), ''), 'My Firm'), v_slug)
    returning id into v_firm_id;

  insert into advisors (auth_user_id, firm_id, full_name, email, role)
    values (v_uid, v_firm_id, coalesce(nullif(trim(p_full_name), ''), v_email), v_email, 'admin')
    returning id into v_advisor_id;

  -- Record the signup in the compliance audit trail
  insert into audit_log (actor_id, actor_role, actor_email, firm_id, action, entity_type, entity_id, summary)
    values (v_uid, 'admin', v_email, v_firm_id, 'firm.provision', 'firm', v_firm_id::text,
            'Self-serve firm + admin advisor created');

  return v_advisor_id;
end;
$$;

grant execute on function px_provision_firm(text, text) to authenticated;
