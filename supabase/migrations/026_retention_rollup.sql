-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Migration 026 — retention / rollup for the unbounded tables
--   `audit_log`, `balance_history` (and already `client_errors`, handled by 021)
--   only ever grow. Before a firm with real history loads in, give the two
--   remaining tables a bounded-growth policy.
--
--   Approach — retention + rollup, NOT native partitioning. Partitioning is the
--   textbook answer, but converting a live table to a partitioned one is a
--   rebuild-and-swap (PK must include the partition key) that can't be exercised
--   without a real Postgres and is risky to apply blind. A retention/rollup
--   policy achieves the actual goal (growth stays bounded) with plain, reviewable
--   SQL that's safe to apply. If per-firm volumes ever justify it, native monthly
--   partitioning is the follow-on optimization.
--
--     • audit_log       — compliance trail (SEC 17a-4 books-&-records, 6-year
--                         retention). Prune only rows older than 7 YEARS (margin
--                         over the rule). Append-only, so this is the sole writer
--                         of deletes and it touches nothing within the window.
--     • balance_history — roll up: keep daily points for 24 months, then collapse
--                         older history to ONE row per account per calendar month
--                         (the month-end / latest as_of). The performance chart
--                         keeps full long-range shape at monthly granularity.
--
--   pg_cron is already enabled (migration 015). Fully idempotent. Run after
--   025_client_document_upload.sql.
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists pg_cron;

-- 1 · Audit retention — 7-year floor (> SEC 17a-4's 6-year requirement) ────────
create or replace function px_prune_audit_log()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from audit_log where occurred_at < now() - interval '7 years';
$$;

-- 2 · Balance-history rollup — daily for 24 months, monthly thereafter ─────────
-- Deletes any pre-cutoff row that has a LATER row in the same account+month, so
-- exactly the latest (month-end) point per account per month survives. The
-- (account_id, as_of) unique index backs the correlated lookup.
create or replace function px_rollup_balance_history()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cutoff date := (date_trunc('month', now()) - interval '24 months')::date;
begin
  delete from balance_history bh
  where bh.as_of < cutoff
    and exists (
      select 1 from balance_history o
      where o.account_id is not distinct from bh.account_id
        and date_trunc('month', o.as_of) = date_trunc('month', bh.as_of)
        and o.as_of > bh.as_of
    );
end $$;

-- Only the scheduler/service role runs these.
revoke all on function px_prune_audit_log()        from public, anon, authenticated;
revoke all on function px_rollup_balance_history()  from public, anon, authenticated;

-- 3 · Monthly schedule — 04:20 UTC on the 1st, off the billing/telemetry hours ─
select cron.unschedule('prism-retention-rollup')
where exists (select 1 from cron.job where jobname = 'prism-retention-rollup');

select cron.schedule(
  'prism-retention-rollup',
  '20 4 1 * *',
  $cmd$
    select px_prune_audit_log();
    select px_rollup_balance_history();
  $cmd$
);
