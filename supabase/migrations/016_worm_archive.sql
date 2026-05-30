-- ============================================================================
-- PRISM - Migration 016 - WORM compliance archive (SEC 17a-4 retention)
--   * private Storage bucket 'compliance-archive' (service-role only)
--   * daily pg_cron job → worm-export Edge Function
-- Run after 015_cron_billing.sql
-- ============================================================================

-- Private bucket; no storage.objects policies are added, so only the
-- service role (the Edge Function) can read/write it.
insert into storage.buckets (id, name, public)
values ('compliance-archive', 'compliance-archive', false)
on conflict (id) do nothing;

-- Daily export at 07:00 UTC
select cron.unschedule('prism-worm-export')
where exists (select 1 from cron.job where jobname = 'prism-worm-export');

select cron.schedule(
  'prism-worm-export',
  '0 7 * * *',
  $cmd$
    select net.http_post(
      url     := 'https://phabxcijbbphfxvjedfj.supabase.co/functions/v1/worm-export',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'pxcron_a93f17b6c0e24d59f1'),
      body    := '{}'::jsonb
    );
  $cmd$
);
