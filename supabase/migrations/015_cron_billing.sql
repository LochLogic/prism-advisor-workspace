-- ============================================================================
-- PRISM - Migration 015 - Auto quarterly invoicing via pg_cron
-- Schedules a call to the generate-invoices Edge Function (cron mode) at
-- 06:00 UTC on the 1st of Jan/Apr/Jul/Oct — billing the just-completed quarter.
-- The function self-authenticates the cron path via the x-cron-secret header.
-- Run after 014_polish.sql
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Replace any prior schedule of the same name (idempotent)
select cron.unschedule('prism-quarterly-invoices')
where exists (select 1 from cron.job where jobname = 'prism-quarterly-invoices');

select cron.schedule(
  'prism-quarterly-invoices',
  '0 6 1 1,4,7,10 *',
  $cmd$
    select net.http_post(
      url     := 'https://phabxcijbbphfxvjedfj.supabase.co/functions/v1/generate-invoices',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'pxcron_a93f17b6c0e24d59f1'),
      body    := '{}'::jsonb
    );
  $cmd$
);
