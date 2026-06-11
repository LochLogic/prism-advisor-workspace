-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Migration 040 — Security Advisor warning sweep (2026-06-10)
--
-- Clears the actionable WARN-level findings from the Supabase Security Advisor:
--
--  1 · function_search_path_mutable — pin search_path on the 8 functions that
--      slipped past migration 018's hardcoded list (trigger functions created
--      before/after it, plus the security-definer RPCs from 036/038). The two
--      definer RPCs are the ones that matter: a mutable search_path on
--      elevated-privilege code is the textbook escalation vector.
--
--  2 · anon_security_definer_function_executable — Postgres grants EXECUTE to
--      PUBLIC on every new function, so `anon` could reach every definer RPC
--      at /rest/v1/rpc/* even though all of them no-op on a null auth.uid().
--      Revoke anon everywhere except px_brand_for_slug (intentionally anon:
--      brand-boot.js paints the firm-branded login screen pre-auth). Trigger
--      functions lose EXECUTE entirely — triggers don't check caller EXECUTE.
--
--  3 · Default privileges — future functions created by this role no longer
--      auto-grant EXECUTE to PUBLIC/anon; migrations keep granting explicitly
--      to `authenticated` (the repo already does).
--
-- Lint findings that remain BY DESIGN after this migration:
--   • 0029 (authenticated can execute definer fns) on the px_* RPCs — that is
--     their contract; identity comes from auth.uid(), never the caller.
--   • 0028 on px_brand_for_slug — intentional pre-auth branding lookup.
--   • pg_net in public — the extension doesn't support SET SCHEMA; accepted.
--   • Leaked-password protection — dashboard toggle, not SQL (your queue).
--
-- Idempotent. Run after 039_security_invoker_view.sql.
-- ════════════════════════════════════════════════════════════════════════════

-- 1 · Pin search_path (signature-agnostic, same mechanism as migration 018,
--     but matching ALL flagged functions regardless of prosecdef so trigger
--     functions are covered too).
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'set_profile_version','px_seed_client','snapshot_balance',
        'px_documents_fill_firm','px_messages_fill_firm',
        'px_guard_firm_status','px_ledger_gate','px_my_advisor'
      )
  loop
    execute format('alter function %s set search_path = public, pg_temp', r.sig);
  end loop;
end $$;

-- 2a · RPCs that stay authenticated-only: revoke PUBLIC + anon, re-grant
--      authenticated explicitly (idempotent) so the surviving grant is visible
--      in the catalog rather than inherited.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'px_audit','px_claim_client','px_create_client_invite',
        'px_current_advisor_id','px_current_client_id','px_current_firm_id',
        'px_is_firm_admin','px_ledger_gate','px_my_advisor',
        'px_provision_firm','px_sign_acknowledgement'
      )
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end $$;

-- NOTE px_brand_for_slug is deliberately NOT in the list above: anon access is
-- the feature (pre-login white-label paint on {slug} portals).

-- 2b · Trigger / internal functions: not RPC surface at all. Triggers execute
--      without checking the invoking user's EXECUTE privilege, so stripping
--      every role (incl. authenticated) is safe and removes them from
--      /rest/v1/rpc/*. rls_auto_enable exists only in the live DB (early
--      SQL-editor helper, not in the repo's migrations) — handled when present.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'px_guard_firm_status','update_client_last_meeting','rls_auto_enable',
        'set_profile_version','px_seed_client','snapshot_balance',
        'px_documents_fill_firm','px_messages_fill_firm'
      )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;

-- 3 · Stop the auto-grant for functions this role creates in future. New RPCs
--     must (and already do) `grant execute … to authenticated` explicitly.
alter default privileges in schema public revoke execute on functions from public;
do $$ begin
  execute 'alter default privileges in schema public revoke execute on functions from anon';
exception when undefined_object then null;  -- role absent in bare-postgres test envs
end $$;
