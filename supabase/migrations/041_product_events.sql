-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Migration 041 — First-party product analytics events
--
-- A small append-only events table for activation/engagement questions ("which
-- firms log in weekly?", "do invites convert?") without shipping client data to
-- a third-party tool. Event identity is stamped SERVER-SIDE by a SECURITY
-- DEFINER RPC (the px_audit pattern from migration 028) — the browser supplies
-- only the event name, an optional client_id (honoured only inside the caller's
-- own firm), and a small metadata blob.
--
-- Events instrumented in-app as of round 13: login, invite_created,
-- invite_claimed, message_sent, plan_updated, report_printed, push_subscribed.
-- 2026-06-21: + portal_opened (a client opened their portal; fires on EVERY open,
-- resumed sessions included, so client return-cadence is measurable where the
-- SIGNED_IN-only `login` event undercounts. See src/portal-app.jsx).
--
-- Reads: firm admins see their own firm's events (future in-app usage panel);
-- the founder reads cross-firm via the service role / SQL editor. No client
-- read access. No UPDATE/DELETE policies — append-only like audit_log.
-- Idempotent. Run after 040_security_advisor_hardening.sql.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists px_events (
  id          bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  firm_id     uuid,
  actor_id    uuid,
  actor_role  text,                          -- 'admin' | 'advisor' | 'client'
  event       text not null,                 -- snake_case, ≤64 chars (enforced in px_track)
  client_id   uuid,
  meta        jsonb not null default '{}'::jsonb
);

create index if not exists px_events_firm_time_idx  on px_events(firm_id, occurred_at desc);
create index if not exists px_events_event_time_idx on px_events(event, occurred_at desc);

alter table px_events enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'px_events' and policyname = 'px_events_admin_read') then
    create policy px_events_admin_read on px_events for select
      using (firm_id = px_current_firm_id() and px_is_firm_admin());
  end if;
end $$;

-- Writes go ONLY through this RPC: identity from the session, never the caller.
create or replace function px_track(
  p_event     text,
  p_client_id uuid  default null,
  p_meta      jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_role   text;
  v_firm   uuid;
  v_client uuid := null;
  v_meta   jsonb := coalesce(p_meta, '{}'::jsonb);
begin
  if v_uid is null then return; end if;                          -- demo / no session
  if p_event is null or p_event !~ '^[a-z0-9_.]{1,64}$' then return; end if;
  if pg_column_size(v_meta) > 8192 then v_meta := '{}'::jsonb; end if;

  select case when a.role = 'admin' then 'admin' else 'advisor' end, a.firm_id
    into v_role, v_firm from advisors a where a.auth_user_id = v_uid;
  if v_role is null then
    select 'client', c.firm_id, c.id
      into v_role, v_firm, v_client from clients c where c.auth_user_id = v_uid;
  end if;
  if v_role is null then return; end if;                         -- unprovisioned

  -- Honour a supplied client_id only inside the caller's own firm.
  if p_client_id is not null
     and exists (select 1 from clients c where c.id = p_client_id and c.firm_id = v_firm) then
    v_client := p_client_id;
  end if;

  insert into px_events (firm_id, actor_id, actor_role, event, client_id, meta)
  values (v_firm, v_uid, v_role, p_event, v_client, v_meta);
end $$;

revoke execute on function px_track(text, uuid, jsonb) from public, anon;
grant  execute on function px_track(text, uuid, jsonb) to authenticated;
