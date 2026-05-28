-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Migration 002 — Accounts table + denormalized AUM on clients
-- Run this in the Supabase SQL editor after 001_prism_schema.sql
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Denormalized totals on clients (updated whenever accounts change)
alter table clients add column if not exists aum            numeric default 0;
alter table clients add column if not exists uninvested_cash numeric default 0;

-- 2. Accounts table — one row per custodial account
create table if not exists accounts (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients(id) on delete cascade,
  type          text not null default 'other',
                -- taxable | ira_traditional | ira_roth | hsa | 401k | other
  custodian     text,          -- e.g. "Fidelity", "Schwab"
  name          text,          -- optional label override
  balance       numeric not null default 0,
  cash          numeric not null default 0,  -- uninvested cash within this account
  as_of         date default current_date,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index if not exists accounts_client_idx on accounts(client_id);

-- 3. RLS — advisor can manage accounts for their clients; client can read their own
alter table accounts enable row level security;

create policy accounts_advisor on accounts
  for all
  using (
    exists (
      select 1 from clients c
      where c.id = accounts.client_id
        and c.advisor_id = px_current_advisor_id()
    )
  )
  with check (
    exists (
      select 1 from clients c
      where c.id = accounts.client_id
        and c.advisor_id = px_current_advisor_id()
    )
  );

create policy accounts_client_read on accounts
  for select
  using (client_id = px_current_client_id());
