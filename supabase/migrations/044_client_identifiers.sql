-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Migration 044 - Encrypted client identifiers (SSN capture, round 23)
--
-- Government identifiers (SSN/ITIN/EIN) for household members, captured for
-- custodian account paperwork (Schwab/Fidelity prefill track). DESIGN RULES:
--   · The identifier value NEVER enters the profile JSON blob, profile_versions,
--     prints, exports, or AI-assist contexts. It lives ONLY here, encrypted.
--   · Encryption happens in the `client-identifiers` edge function
--     (AES-256-GCM, key = IDENTIFIER_ENC_KEY edge secret). The database holds
--     ciphertext + the last four digits for masked display.
--   · NO RLS policies on purpose: deny-by-default for anon/authenticated.
--     Only the service role (inside the edge function) reads or writes, and
--     the function enforces tenancy + roles itself and audits set/reveal/clear.
--   · One row per (client, household member, kind) - members are the profile
--     JSON members[].id values ('m1', ...), since paperwork needs EACH owner.
--
-- Idempotent. Run after 043_rls_index_coverage.sql.
-- Companion setup (human queue): set IDENTIFIER_ENC_KEY in Supabase edge
-- secrets, then deploy the `client-identifiers` function via deploy.yml.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists client_identifiers (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  firm_id     uuid not null,
  member_id   text not null default 'primary',
  kind        text not null default 'ssn' check (kind in ('ssn', 'itin', 'ein')),
  last4       text not null check (last4 ~ '^[0-9]{4}$'),
  ciphertext  text not null,                 -- base64(iv).base64(AES-256-GCM ct)
  updated_by  uuid,                          -- auth uid that last wrote it
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (client_id, member_id, kind)
);

create index if not exists client_identifiers_firm_idx on client_identifiers(firm_id);

alter table client_identifiers enable row level security;
-- Deny-by-default is the policy: no GRANTs, no RLS policies. Service role only.
revoke all on client_identifiers from public, anon, authenticated;
