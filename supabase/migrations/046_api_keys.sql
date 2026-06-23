-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Migration 046 - Public API keys (Zapier / integrations)
-- Run in the Supabase SQL editor after 045_firm_playbooks.sql
--
-- Backs the firm-scoped public REST API (the `public-api` edge function) that lets a
-- firm wire Prism into Zapier / Make / n8n / custom tooling. A firm admin mints a key
-- in Firm admin → "API & integrations"; the key carries that firm's identity.
--
-- SECURITY MODEL (read before touching), mirrors client_identifiers (migration 044):
--   · This table has NO RLS policies and no grants - only the edge functions' service
--     role touches it. Authorization lives in code: the `api-keys` function (advisor
--     JWT, firm-admin-gated) manages keys; the `public-api` function authenticates the
--     presented key and scopes every query to its firm_id.
--   · The full key is NEVER stored. We keep only a SHA-256 hash (`key_hash`) for lookup
--     and a short, non-secret `prefix` for display ("which key is this?"). The plaintext
--     is shown to the admin exactly once, at creation.
--   · `scopes` gates capability: 'read' (GET triggers) and 'write' (POST actions).
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists api_keys (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid not null references firms(id) on delete cascade,
  created_by   uuid references advisors(id) on delete set null,
  name         text not null,
  prefix       text not null,                       -- non-secret, for display (e.g. prism_sk_Ab12Cd34)
  key_hash     text not null,                       -- SHA-256 hex of the full key; the only stored form
  scopes       text[] not null default '{read,write}',
  last_used_at timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);

-- Lookup is by hash on every public-api call; only live keys matter there.
create index if not exists api_keys_hash_idx on api_keys (key_hash) where revoked_at is null;
create index if not exists api_keys_firm_idx on api_keys (firm_id);

alter table api_keys enable row level security;
-- No policies on purpose: service-role-only, managed via the api-keys / public-api
-- edge functions. authenticated/anon callers get zero rows (proved by rls_isolation
-- check 10). Do NOT add client-facing policies - the hash must never reach a browser.
