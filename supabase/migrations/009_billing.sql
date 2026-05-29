-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Migration 009 — Billing (Stripe subscriptions, per firm)
-- Run after 008_self_serve_signup.sql
--
-- One subscription row per firm (the tenant pays). Only the Stripe webhook
-- (service-role key, bypasses RLS) writes here; advisors may read their own
-- firm's row. No insert/update/delete policy for normal users.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists subscriptions (
  firm_id                uuid primary key references firms(id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text,
  plan                   text,          -- e.g. 'growth'
  status                 text,          -- trialing | active | past_due | canceled | incomplete
  current_period_end     timestamptz,
  updated_at             timestamptz not null default now()
);

create index if not exists subscriptions_customer_idx on subscriptions(stripe_customer_id);

alter table subscriptions enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='subscriptions' and policyname='subs_select_firm') then
    create policy subs_select_firm on subscriptions
      for select using (firm_id = px_current_firm_id());
  end if;
end $$;
