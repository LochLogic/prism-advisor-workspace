-- ============================================================================
-- PRISM - Migration 011 - Performance reporting (Theme D, 18a)
--   * cash_flows: dated contributions/withdrawals for time-weighted return
--   * backfill balance_history with current account balances (seed the series)
-- Run after 010_aggregation.sql
-- ============================================================================

create table if not exists cash_flows (
  id         bigint generated always as identity primary key,
  client_id  uuid not null references clients(id) on delete cascade,
  account_id uuid references accounts(id) on delete set null,
  flow_date  date not null default current_date,
  amount     numeric not null,            -- + deposit/contribution, - withdrawal
  kind       text default 'contribution', -- contribution | withdrawal | fee | dividend
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists cash_flows_client_idx on cash_flows(client_id, flow_date);

alter table cash_flows enable row level security;
do $pol$ begin
  if not exists (select 1 from pg_policies where tablename='cash_flows' and policyname='cf_all_pair') then
    create policy cf_all_pair on cash_flows for all using (
      client_id = px_current_client_id()
      or exists (select 1 from clients c where c.id = cash_flows.client_id and c.advisor_id = px_current_advisor_id())
    ) with check (
      client_id = px_current_client_id()
      or exists (select 1 from clients c where c.id = cash_flows.client_id and c.advisor_id = px_current_advisor_id())
    );
  end if;
end $pol$;

-- Seed balance_history from current account balances (the trigger only fires on
-- future changes, so without this existing clients would have an empty series).
insert into balance_history (account_id, client_id, as_of, balance, cash, source)
select id, client_id, current_date, coalesce(balance,0), coalesce(cash,0), coalesce(source,'manual')
from accounts where archived_at is null
on conflict (account_id, as_of) do nothing;
