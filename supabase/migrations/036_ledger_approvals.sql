-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Migration 036 — Advisor-approval commit gate for client ledger edits
-- Run in the Supabase SQL editor after 035_platform_owner.sql
--
-- Opt-in, per-firm, default OFF. When ON, a CLIENT's Numbers-drawer edits no
-- longer write profiles directly: they accumulate in ONE open draft row here
-- (full proposed profile snapshot), the advisor reviews and approves/declines,
-- and approval writes the profile through the advisor's own RLS-scoped path
-- (so profile_versions + audit_log keep their existing shape). Advisor edits
-- are never gated — advisors are the approvers.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1 · Per-firm toggle ──────────────────────────────────────────────────────
-- Writable by the firm admin via the existing firms_update_admin policy (001).
alter table firms add column if not exists ledger_approval_required boolean not null default false;

-- ── 2 · Pending changesets ───────────────────────────────────────────────────
-- One OPEN draft per client (partial unique index): repeated autosaves update
-- the same row instead of flooding. Closed rows (approved/rejected/withdrawn)
-- are retained as history — there is no delete policy.
create table if not exists pending_ledger_changes (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references clients(id) on delete cascade,
  firm_id        uuid references firms(id) on delete cascade,
  author_auth_id uuid references auth.users(id) on delete set null,
  payload        jsonb not null,                     -- full proposed profile snapshot
  status         text not null default 'pending',    -- pending | approved | rejected | withdrawn
  review_note    text,                               -- advisor's note on decline
  reviewed_by    uuid references advisors(id),
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists plc_one_open_per_client
  on pending_ledger_changes(client_id) where status = 'pending';
create index if not exists plc_firm_status_idx on pending_ledger_changes(firm_id, status);

alter table pending_ledger_changes enable row level security;

do $$ begin
  -- Read: the client themselves, their advisor, or a firm admin.
  if not exists (select 1 from pg_policies where tablename='pending_ledger_changes' and policyname='plc_select_pair') then
    create policy plc_select_pair on pending_ledger_changes for select using (
      client_id = px_current_client_id()
      or exists (select 1 from clients c where c.id = pending_ledger_changes.client_id and c.advisor_id = px_current_advisor_id())
      or (firm_id = px_current_firm_id() and px_is_firm_admin())
    );
  end if;
  -- Client may open a draft for their own household only, and only as 'pending'.
  if not exists (select 1 from pg_policies where tablename='pending_ledger_changes' and policyname='plc_insert_client') then
    create policy plc_insert_client on pending_ledger_changes for insert with check (
      client_id = px_current_client_id() and status = 'pending'
    );
  end if;
  -- Client may keep editing their open draft, or withdraw it — never approve it.
  if not exists (select 1 from pg_policies where tablename='pending_ledger_changes' and policyname='plc_update_client') then
    create policy plc_update_client on pending_ledger_changes for update
      using (client_id = px_current_client_id() and status = 'pending')
      with check (client_id = px_current_client_id() and status in ('pending', 'withdrawn'));
  end if;
  -- The client's advisor reviews (approve / reject).
  if not exists (select 1 from pg_policies where tablename='pending_ledger_changes' and policyname='plc_update_advisor') then
    create policy plc_update_advisor on pending_ledger_changes for update
      using (exists (select 1 from clients c where c.id = pending_ledger_changes.client_id and c.advisor_id = px_current_advisor_id()))
      with check (exists (select 1 from clients c where c.id = pending_ledger_changes.client_id and c.advisor_id = px_current_advisor_id()));
  end if;
end $$;

-- ── 3 · Gate lookup for the signed-in user ───────────────────────────────────
-- Clients cannot read the firms table (firms_select_own is advisor-scoped), so
-- the portal asks through a security-definer RPC: "is MY firm's gate on?"
-- Works for both roles; false when unknown.
create or replace function px_ledger_gate() returns boolean
language sql security definer stable as $$
  select coalesce(
    (select f.ledger_approval_required from firms f
       join clients c on c.firm_id = f.id
      where c.auth_user_id = auth.uid() limit 1),
    (select f.ledger_approval_required from firms f
       join advisors a on a.firm_id = f.id
      where a.auth_user_id = auth.uid() limit 1),
    false);
$$;
grant execute on function px_ledger_gate() to authenticated;
