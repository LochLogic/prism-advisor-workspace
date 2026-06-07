-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Migration 023 — billing cron reads CRON_SECRET from Vault
--   Migration 015 scheduled the monthly invoice cron with the CRON_SECRET value
--   hard-coded in the SQL. This re-schedules the same job to read the secret from
--   Supabase Vault at run time (matching 022), so no plaintext secret lives in any
--   migration. After rotating CRON_SECRET you only update the Vault entry.
--
--   Prereq (one-time, done as part of TODO.md H2 secret rotation):
--     select vault.create_secret('<CRON_SECRET value>', 'cron_secret');
--   Run after 022_error_digest.sql.
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('prism-monthly-invoices')
where exists (select 1 from cron.job where jobname = 'prism-monthly-invoices');

select cron.schedule(
  'prism-monthly-invoices',
  '0 6 1 * *',
  $cmd$
    select net.http_post(
      url     := 'https://phabxcijbbphfxvjedfj.supabase.co/functions/v1/generate-invoices',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
      ),
      body    := '{}'::jsonb
    );
  $cmd$
);
