-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Migration 021 — log-error rate limiting + retention
--   The public `log-error` Edge Function is an unauthenticated service-role
--   write (it must work pre-auth). Length caps already exist; this adds the two
--   missing pieces from the 2026-06 clean-room review:
--     1. A reusable token-bucket rate limiter (per-IP + global) so a script
--        can't flood `client_errors` indefinitely.
--     2. A daily retention job that prunes `client_errors` (and stale rate-limit
--        buckets) so the table can't grow without bound.
--   Run after 020_documents.sql.
-- ════════════════════════════════════════════════════════════════════════════

-- 1 · Token-bucket rate limiter ───────────────────────────────────────────────
-- One row per bucket key (e.g. 'log-error:global', 'log-error:ip:1.2.3.4').
-- A fixed-window counter: when the window expires the tokens refill. Good enough
-- to blunt a flood without the complexity of a true sliding window.
create table if not exists rate_limit_buckets (
  bucket_key   text primary key,
  window_start timestamptz not null default now(),
  tokens       int not null
);

-- px_rate_take: consume one token from a bucket. Returns true if allowed.
-- Atomic via a single upsert so concurrent calls can't both pass the limit.
create or replace function px_rate_take(p_key text, p_limit int, p_window_secs int)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now     timestamptz := now();
  v_expired boolean;
  v_tokens  int;
begin
  insert into rate_limit_buckets as b (bucket_key, window_start, tokens)
    values (p_key, v_now, p_limit - 1)
  on conflict (bucket_key) do update
    set window_start = case when b.window_start < v_now - make_interval(secs => p_window_secs)
                            then v_now else b.window_start end,
        tokens       = case when b.window_start < v_now - make_interval(secs => p_window_secs)
                            then p_limit - 1            -- window rolled over → refill
                            else b.tokens - 1 end       -- same window → spend one
  returning tokens into v_tokens;
  return v_tokens >= 0;
end $$;

-- px_log_error_allowed: the policy for the log-error sink. Per-IP cap blunts a
-- single abuser; the global cap is a backstop against a distributed flood.
create or replace function px_log_error_allowed(p_ip text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Check the per-IP bucket first so an abusing IP is denied without spending a
  -- global token. 20 errors / IP / minute, 600 / minute across all IPs.
  if not px_rate_take('log-error:ip:' || coalesce(nullif(p_ip, ''), 'unknown'), 20, 60) then
    return false;
  end if;
  return px_rate_take('log-error:global', 600, 60);
end $$;

-- Only the service role (the Edge Function) ever calls these.
revoke all on function px_rate_take(text, int, int)   from public, anon, authenticated;
revoke all on function px_log_error_allowed(text)      from public, anon, authenticated;

-- 2 · Daily retention ─────────────────────────────────────────────────────────
-- pg_cron is already enabled by migration 015. Prune error records older than
-- 30 days and rate-limit buckets idle for more than a day (they self-refill, so
-- old rows are just garbage). 04:30 UTC, off the billing-run hour.
create extension if not exists pg_cron;

select cron.unschedule('prism-prune-telemetry')
where exists (select 1 from cron.job where jobname = 'prism-prune-telemetry');

select cron.schedule(
  'prism-prune-telemetry',
  '30 4 * * *',
  $cmd$
    delete from client_errors      where occurred_at  < now() - interval '30 days';
    delete from rate_limit_buckets where window_start < now() - interval '1 day';
  $cmd$
);
