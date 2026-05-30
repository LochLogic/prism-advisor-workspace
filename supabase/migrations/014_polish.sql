-- ============================================================================
-- PRISM - Migration 014 - Polish: task assignment + client invoice visibility
-- Run after 013_scheduling.sql
-- ============================================================================

-- CRM: cross-advisor task assignment
alter table crm_tasks add column if not exists assigned_to uuid references advisors(id) on delete set null;

do $p$ begin
  -- Assignee can see/manage tasks assigned to them (in addition to the owner)
  if not exists (select 1 from pg_policies where tablename='crm_tasks' and policyname='crm_tasks_assignee') then
    create policy crm_tasks_assignee on crm_tasks for all
      using (assigned_to = px_current_advisor_id())
      with check (advisor_id = px_current_advisor_id() or assigned_to = px_current_advisor_id());
  end if;

  -- Clients can read their own advisory-fee invoices
  if not exists (select 1 from pg_policies where tablename='invoices' and policyname='inv_client_read') then
    create policy inv_client_read on invoices for select using (client_id = px_current_client_id());
  end if;
end $p$;
