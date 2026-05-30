-- ============================================================================
-- PRISM - Migration 013 - Scheduling (meeting requests + status)
--   * meetings.status: logged | requested | confirmed | canceled
--   * clients can request + view their own meetings (RLS)
--   * last_meeting_at trigger only counts actually-logged (past) meetings
-- Run after 012_advisory_billing.sql
-- ============================================================================

alter table meetings add column if not exists status text not null default 'logged';

-- Only real (logged) meetings advance last_meeting_at — not future/requested ones
create or replace function update_client_last_meeting()
returns trigger language plpgsql security definer as $fn$
begin
  if coalesce(new.status, 'logged') = 'logged' then
    update clients set last_meeting_at = new.met_at
    where id = new.client_id and (last_meeting_at is null or new.met_at > last_meeting_at);
  end if;
  return new;
end;
$fn$;

do $p$ begin
  if not exists (select 1 from pg_policies where tablename='meetings' and policyname='meetings_client_select') then
    create policy meetings_client_select on meetings for select
      using (client_id = px_current_client_id());
  end if;
  if not exists (select 1 from pg_policies where tablename='meetings' and policyname='meetings_client_request') then
    create policy meetings_client_request on meetings for insert with check (
      client_id = px_current_client_id()
      and status = 'requested'
      and advisor_id = (select advisor_id from clients where id = px_current_client_id())
    );
  end if;
end $p$;
