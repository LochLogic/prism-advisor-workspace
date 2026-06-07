-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Migration 022 — error alerting (the "nobody is told" fix)
--   client_errors captures uncaught client errors but nothing surfaces them, so
--   an advisor could hit a wall and we'd never know (2026-06 review, Monitoring).
--   This adds a cursor table + an hourly cron that calls the `error-digest` Edge
--   Function, which clusters NEW errors and posts a digest to ALERT_WEBHOOK_URL.
--   No platform-operator role exists and client_errors is cross-tenant, so the
--   alert is a webhook to the operator — NOT an in-app view exposed to firm admins.
--   Run after 021_log_error_ratelimit_retention.sql.
-- ════════════════════════════════════════════════════════════════════════════

-- Cursor so each digest only reports errors newer than the last delivered one.
create table if not exists telemetry_digest_state (
  key          text primary key,
  last_seen_id bigint not null default 0,
  last_run     timestamptz
);
insert into telemetry_digest_state (key) values ('client_errors')
  on conflict (key) do nothing;

-- RLS deny-all (service role only, like client_errors).
alter table telemetry_digest_state enable row level security;

-- Hourly digest. The function self-authenticates via x-cron-secret and no-ops if
-- ALERT_WEBHOOK_URL is unset (so it's inert until H3 wires the webhook — and it
-- won't advance the cursor while inert, so no errors are lost in the meantime).
--
-- The cron secret is read from Supabase Vault at run time rather than embedded in
-- this file (no plaintext secret in the repo). Before this job can authenticate,
-- store the secret once:
--   select vault.create_secret('<CRON_SECRET value>', 'cron_secret');
-- Rotating CRON_SECRET then means updating the vault entry, not editing SQL.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('prism-error-digest')
where exists (select 1 from cron.job where jobname = 'prism-error-digest');

select cron.schedule(
  'prism-error-digest',
  '0 * * * *',
  $cmd$
    select net.http_post(
      url     := 'https://phabxcijbbphfxvjedfj.supabase.co/functions/v1/error-digest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
      ),
      body    := '{}'::jsonb
    );
  $cmd$
);
