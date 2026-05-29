-- ============================================================================
-- PRISM - Migration 010 - Account aggregation foundation (Theme B)
--   * source + external_id on accounts (manual | plaid | custodian)
--   * balance_history time-series (16b) + auto-snapshot trigger
--   * aggregation_items (Plaid/Yodlee/Flinks linked institutions; backend-only)
-- Run after 009_billing.sql
-- ============================================================================

-- 1. Provenance columns on accounts
alter table accounts add column if not exists source text not null default 'manual';
alter table accounts add column if not exists external_id text;
create unique index if not exists accounts_client_external_idx
  on accounts(client_id, external_id) where external_id is not null;

-- 2. Balance history time-series (prerequisite for performance reporting, Theme D)
create table if not exists balance_history (
  id          bigint generated always as identity primary key,
  account_id  uuid references accounts(id) on delete cascade,
  client_id   uuid not null references clients(id) on delete cascade,
  as_of       date not null default current_date,
  balance     numeric not null default 0,
  cash        numeric not null default 0,
  source      text default 'manual',
  captured_at timestamptz not null default now()
);
create unique index if not exists balance_history_acct_day on balance_history(account_id, as_of);
create index if not exists balance_history_client_idx on balance_history(client_id, as_of);

alter table balance_history enable row level security;
do $pol$ begin
  if not exists (select 1 from pg_policies where tablename='balance_history' and policyname='bh_select_pair') then
    create policy bh_select_pair on balance_history for select using (
      client_id = px_current_client_id()
      or exists (select 1 from clients c where c.id = balance_history.client_id and c.advisor_id = px_current_advisor_id())
    );
  end if;
end $pol$;

-- 3. Snapshot a daily balance row whenever an account balance/cash changes
create or replace function snapshot_balance() returns trigger language plpgsql as $fn$
begin
  if (tg_op = 'INSERT')
     or (new.balance is distinct from old.balance)
     or (new.cash    is distinct from old.cash) then
    insert into balance_history (account_id, client_id, as_of, balance, cash, source)
    values (new.id, new.client_id, current_date,
            coalesce(new.balance, 0), coalesce(new.cash, 0), coalesce(new.source, 'manual'))
    on conflict (account_id, as_of) do update
      set balance = excluded.balance, cash = excluded.cash,
          source = excluded.source, captured_at = now();
  end if;
  return new;
end $fn$;

drop trigger if exists trg_snapshot_balance on accounts;
create trigger trg_snapshot_balance after insert or update on accounts
  for each row execute function snapshot_balance();

-- 4. Aggregation items (linked institutions + provider access tokens).
--    Backend-only: NO user RLS policy, so access tokens are never readable by
--    advisors/clients. Only the service role (Edge Functions) touches this.
--    NOTE for production: move access_token into Supabase Vault (pgsodium).
create table if not exists aggregation_items (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references clients(id) on delete cascade,
  provider         text not null default 'plaid',
  item_id          text,
  access_token     text,
  institution_name text,
  status           text default 'active',
  created_at       timestamptz not null default now()
);
create index if not exists aggregation_items_client_idx on aggregation_items(client_id);
alter table aggregation_items enable row level security;
-- (no policies on purpose)
