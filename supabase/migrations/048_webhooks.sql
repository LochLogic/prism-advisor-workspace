-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Migration 048 - Outbound webhooks (events push instead of poll)
-- Run in the Supabase SQL editor after 047_ledger_draft_alert.sql
--
-- The complement to the public API (migration 046): instead of a firm polling
-- GET /clients on a timer, Prism POSTs to the firm's endpoint the moment
-- something happens (a client is created, a task is created, an acknowledgement
-- is signed, an invoice is approved). A firm admin registers an endpoint in
-- Firm admin → "API & integrations"; deliveries are HMAC-signed with the
-- endpoint's secret so the receiver can verify authenticity.
--
-- SECURITY MODEL (read before touching), mirrors api_keys (046):
--   · NO RLS policies, no grants - only the edge functions' service role touches
--     this table. The `webhooks` function (advisor JWT, admin-gated for CRUD)
--     manages endpoints; the shared dispatcher signs + delivers on the service
--     role from inside other functions.
--   · `secret` is the HMAC signing key. It is shown to the admin once at
--     creation and masked thereafter (lost = recreate the endpoint), the same
--     once-only posture as an API key.
--   · `events` is the subscribed event list; a delivery fires only for endpoints
--     subscribed to that event.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists webhooks (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references firms(id) on delete cascade,
  created_by    uuid references advisors(id) on delete set null,
  url           text not null,
  secret        text not null,                       -- HMAC signing key (whsec_…)
  events        text[] not null default '{}',        -- subscribed event types
  active        boolean not null default true,
  last_status   int,                                 -- last delivery HTTP status (0 = network error)
  last_event_at timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists webhooks_firm_idx on webhooks (firm_id) where active;

alter table webhooks enable row level security;
-- No policies on purpose: service-role-only, managed via the `webhooks` edge
-- function. authenticated/anon callers get zero rows. Do NOT add client-facing
-- policies - the signing secret must never reach a browser un-gated.
