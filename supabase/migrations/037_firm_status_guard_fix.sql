-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Migration 037 — Defensive rewrite of the firms.status guard
-- Run in the Supabase SQL editor after 036_ledger_approvals.sql
--
-- 035's px_guard_firm_status called auth.role() on EVERY firms update (the
-- AND short-circuit isn't guaranteed), so any environment where auth.role()
-- errors breaks every firm update — founder-reported as "save branding stopped
-- working" right after applying 035. Rewrite: only inspect the JWT when the
-- status column actually changes, and read the role straight from
-- request.jwt.claims (plain current_setting, available on any Postgres) so
-- there is no dependency on the auth helper at all.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function px_guard_firm_status() returns trigger
language plpgsql security definer as $$
declare jwt_role text;
begin
  if new.status is distinct from old.status then
    -- 'authenticated' = a browser/JWT request. Service role and direct SQL
    -- (no claims set) pass through.
    begin
      jwt_role := coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '');
    exception when others then
      jwt_role := '';
    end;
    if jwt_role = 'authenticated' then
      raise exception 'firms.status is managed by the platform';
    end if;
  end if;
  return new;
end $$;

-- (trg_px_guard_firm_status from 035 keeps pointing at this function.)
