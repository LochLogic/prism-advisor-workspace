-- ============================================================================
-- PRISM - Migration 015 - Auto invoicing via pg_cron (MONTHLY driver)
-- Runs generate-invoices at 06:00 UTC on the 1st of every month. The function
-- bills each client for the most-recent completed period of THEIR fee-schedule
-- frequency (monthly/quarterly/annually); the unique(client,period) constraint
-- de-dupes, so monthly runs safely re-touch quarterly/annual schedules.
-- The function self-authenticates the cron path via the x-cron-secret header.
-- Run after 014_polish.sql
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Replace any prior schedule(s) (idempotent)
select cron.unschedule('prism-quarterly-invoices')
where exists (select 1 from cron.job where jobname = 'prism-quarterly-invoices');
select cron.unschedule('prism-monthly-invoices')
where exists (select 1 from cron.job where jobname = 'prism-monthly-invoices');

select cron.schedule(
  'prism-monthly-invoices',
  '0 6 1 * *',
  $cmd$
    select net.http_post(
      url     := 'https://phabxcijbbphfxvjedfj.supabase.co/functions/v1/generate-invoices',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'pxcron_a93f17b6c0e24d59f1'),
      body    := '{}'::jsonb
    );
  $cmd$
);
