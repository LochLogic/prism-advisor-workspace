-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Migration 035 — Platform-owner tier (founder ask 2026-06-10)
-- Run in the Supabase SQL editor after 034_bulk_create_clients.sql
--
-- A tier ABOVE firm admin: a founder-only allowlist that gates the
-- `platform-admin` edge function (service role). Every existing RLS policy is
-- left untouched — platform actions never ride a user-scoped policy.
--
-- ⚠ AFTER APPLYING, seed yourself (one row, by hand):
--   insert into px_platform_owners (auth_user_id, email)
--   values ('<your auth.users id>', '<your email>');
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1 · Founder allowlist ────────────────────────────────────────────────────
-- RLS enabled with NO policies: only the service role (the platform-admin edge
-- function) can read it. No browser path exists to this table.
create table if not exists px_platform_owners (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  created_at   timestamptz not null default now()
);
alter table px_platform_owners enable row level security;

-- ── 2 · Firm lifecycle status ────────────────────────────────────────────────
-- active | suspended. Written ONLY by the platform-admin edge function
-- (service role bypasses RLS; firms_update_admin's column reach is unchanged
-- in practice because the app's admin UI never writes this column).
-- Enforcement is app-level day-one: the advisor workspace shows a lock screen
-- when the signed-in advisor's firm is suspended (app.jsx).
alter table firms add column if not exists status text not null default 'active';

-- firms_update_admin (001) lets a firm admin update their own firm row, which
-- would otherwise let a suspended firm un-suspend itself from the browser.
-- Guard the column: only non-user contexts (service role / direct SQL) may
-- change it. auth.role() is 'authenticated' for every browser/JWT request.
create or replace function px_guard_firm_status() returns trigger
language plpgsql security definer as $$
begin
  if new.status is distinct from old.status and auth.role() = 'authenticated' then
    raise exception 'firms.status is managed by the platform';
  end if;
  return new;
end $$;

drop trigger if exists trg_px_guard_firm_status on firms;
create trigger trg_px_guard_firm_status before update on firms
  for each row execute function px_guard_firm_status();

