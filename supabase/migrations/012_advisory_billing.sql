-- ============================================================================
-- PRISM - Migration 012 - Advisory-fee billing (Theme D: 18c/18d/18e)
--   * fee_schedules: tiered/flat bps templates per firm
--   * clients.fee_schedule_id: assign a schedule to a household
--   * invoices: generated advisory-fee bills (draft -> approved -> paid)
-- This is ADVISORY billing (charging clients AUM fees), distinct from the
-- SaaS subscription billing in migration 009.
-- Run after 011_performance.sql
-- ============================================================================

create table if not exists fee_schedules (
  id         uuid primary key default gen_random_uuid(),
  firm_id    uuid not null references firms(id) on delete cascade,
  name       text not null,
  frequency  text not null default 'quarterly',  -- quarterly | monthly | annually
  basis      text not null default 'avg_daily',  -- avg_daily | period_end
  tiers      jsonb not null default '[]'::jsonb,  -- [{ up_to: number|null, annual_bps: number }]
  active     boolean default true,
  created_at timestamptz default now()
);
alter table fee_schedules enable row level security;
do $p$ begin
  if not exists (select 1 from pg_policies where tablename='fee_schedules' and policyname='fs_read_firm') then
    create policy fs_read_firm on fee_schedules for select using (firm_id = px_current_firm_id());
  end if;
  if not exists (select 1 from pg_policies where tablename='fee_schedules' and policyname='fs_write_admin') then
    create policy fs_write_admin on fee_schedules for all
      using (firm_id = px_current_firm_id() and px_is_firm_admin())
      with check (firm_id = px_current_firm_id() and px_is_firm_admin());
  end if;
end $p$;

alter table clients add column if not exists fee_schedule_id uuid references fee_schedules(id) on delete set null;

create table if not exists invoices (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid not null references firms(id) on delete cascade,
  client_id    uuid not null references clients(id) on delete cascade,
  period_start date not null,
  period_end   date not null,
  basis_amount numeric not null default 0,
  fee_amount   numeric not null default 0,
  status       text not null default 'draft',  -- draft | approved | paid | void
  notes        text,
  created_at   timestamptz default now(),
  approved_at  timestamptz,
  approved_by  uuid,
  unique (client_id, period_start, period_end)
);
create index if not exists invoices_firm_idx on invoices(firm_id, status);
alter table invoices enable row level security;
do $p$ begin
  if not exists (select 1 from pg_policies where tablename='invoices' and policyname='inv_advisor') then
    create policy inv_advisor on invoices for all using (
      exists (select 1 from clients c where c.id = invoices.client_id and c.advisor_id = px_current_advisor_id())
    ) with check (
      exists (select 1 from clients c where c.id = invoices.client_id and c.advisor_id = px_current_advisor_id())
    );
  end if;
  if not exists (select 1 from pg_policies where tablename='invoices' and policyname='inv_admin') then
    create policy inv_admin on invoices for all
      using (firm_id = px_current_firm_id() and px_is_firm_admin())
      with check (firm_id = px_current_firm_id() and px_is_firm_admin());
  end if;
end $p$;
