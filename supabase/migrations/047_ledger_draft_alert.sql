-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Migration 047 - Realtime nudge when a client submits ledger updates
-- Run in the Supabase SQL editor after 046_api_keys.sql
--
-- The advisor-approval ledger gate (migration 036) collects a client's Numbers
-- edits into one open draft row for review. Until now the advisor only saw the
-- draft on their next dashboard load. This adds a trigger that, the moment a
-- NEW draft opens, writes an alert for that household's advisor, reusing the
-- EXISTING alerts realtime pipeline (the advisor channel already subscribes to
-- alert INSERTs), so the notification bell + dashboard light up live with no new
-- realtime wiring and no new publication.
--
-- Fires on INSERT only. Repeated autosaves UPDATE the single open row (see
-- dbSubmitLedgerChange), so the advisor is nudged once per review cycle, never
-- per keystroke. No schema change beyond the trigger.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function px_ledger_draft_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_advisor uuid;
begin
  if new.status <> 'pending' then return new; end if;
  select advisor_id into v_advisor from clients where id = new.client_id;
  if v_advisor is null then return new; end if;
  insert into alerts (advisor_id, client_id, priority, category, headline, body)
  values (v_advisor, new.client_id, 'med', 'ledger',
          'A client updated their numbers',
          'They submitted Numbers changes for your review and approval.');
  return new;
end;
$$;

-- Trigger functions are invoked by the trigger, never called directly - strip
-- EXECUTE from every caller role (matches the 040 definer-hardening sweep).
revoke execute on function px_ledger_draft_alert() from public;
do $$ begin
  begin revoke execute on function px_ledger_draft_alert() from anon; exception when others then null; end;
  begin revoke execute on function px_ledger_draft_alert() from authenticated; exception when others then null; end;
end $$;

drop trigger if exists trg_ledger_draft_alert on pending_ledger_changes;
create trigger trg_ledger_draft_alert
  after insert on pending_ledger_changes
  for each row execute function px_ledger_draft_alert();
