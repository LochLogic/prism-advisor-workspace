-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Migration 033 — Calendar connections (Google / Microsoft OAuth)
--
-- Stores per-advisor OAuth tokens for two-way calendar sync. Tokens are
-- SECRETS: RLS is enabled with NO policies, so only the service role (the
-- calendar-oauth / calendar-events edge functions) can read or write rows.
-- The browser never sees a token — connection status flows back through the
-- calendar-oauth edge function ("status" action) only.
-- Idempotent. Run after 032.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists calendar_connections (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  provider      text not null check (provider in ('google', 'microsoft')),
  email         text,                      -- calendar account, for display in the UI
  access_token  text not null,
  refresh_token text,
  expires_at    timestamptz,               -- access-token expiry; refreshed server-side
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, provider)
);

-- RLS on, zero policies → service-role only. This is deliberate; do not add
-- client-facing policies here (tokens must never cross the API boundary).
alter table calendar_connections enable row level security;
