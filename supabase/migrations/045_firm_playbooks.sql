-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Migration 045 — Firm-authored CX playbook (advisor playbook phase 2)
-- Run in the Supabase SQL editor after 044_client_identifiers.sql
--
-- Phase 1 (round 23) shipped a DEFAULT advisor playbook (data.jsx `advisorPlaybook`)
-- rendered as an advisor-only per-phase card in the client quick-view. Phase 2 lets a
-- firm AUTHOR its own per-phase script. Each row is a firm's override for one of the
-- seven phases; the frontend deep-merges it over the data.jsx default (an absent row, or
-- an absent/empty field, falls back to the default), so a firm can rewrite just the
-- questions for one phase and inherit everything else.
--
-- Read: any advisor in the firm (the quick-view card is advisor-bundle only, so clients
-- never see it; px_current_firm_id() is null for a client, so RLS excludes them too).
-- Author: firm admins only, within their own firm.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists firm_playbooks (
  firm_id      uuid     not null references firms(id) on delete cascade,
  phase        smallint not null check (phase >= 0 and phase <= 6),
  questions    text[],                       -- null/empty = inherit the data.jsx default
  expectations text,
  gather       text[],
  cadence      text,
  updated_by   uuid references advisors(id),
  updated_at   timestamptz not null default now(),
  primary key (firm_id, phase)
);

alter table firm_playbooks enable row level security;

do $$ begin
  -- Read: any advisor in the firm.
  if not exists (select 1 from pg_policies where tablename='firm_playbooks' and policyname='fpb_select_firm') then
    create policy fpb_select_firm on firm_playbooks for select using (
      firm_id = px_current_firm_id()
    );
  end if;
  -- Author (insert): firm admins, own firm only.
  if not exists (select 1 from pg_policies where tablename='firm_playbooks' and policyname='fpb_insert_admin') then
    create policy fpb_insert_admin on firm_playbooks for insert with check (
      firm_id = px_current_firm_id() and px_is_firm_admin()
    );
  end if;
  -- Author (update): firm admins, own firm only.
  if not exists (select 1 from pg_policies where tablename='firm_playbooks' and policyname='fpb_update_admin') then
    create policy fpb_update_admin on firm_playbooks for update
      using      (firm_id = px_current_firm_id() and px_is_firm_admin())
      with check (firm_id = px_current_firm_id() and px_is_firm_admin());
  end if;
  -- Author (delete = revert one phase to default): firm admins, own firm only.
  if not exists (select 1 from pg_policies where tablename='firm_playbooks' and policyname='fpb_delete_admin') then
    create policy fpb_delete_admin on firm_playbooks for delete using (
      firm_id = px_current_firm_id() and px_is_firm_admin()
    );
  end if;
end $$;
