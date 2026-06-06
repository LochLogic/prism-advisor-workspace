-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Two-way messaging (migration 019)
-- A persistent advisor ↔ client conversation thread per client (distinct from the
-- per-question flag_messages thread in 004). Realtime + RLS-scoped firm→advisor→
-- client. Audit is written app-side via dbAudit (no DB trigger needed).
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  firm_id         uuid references firms(id)   on delete cascade,
  client_id       uuid not null references clients(id) on delete cascade,
  author_id       uuid,                                  -- advisors.id or clients.id (best-effort)
  author_role     text not null check (author_role in ('advisor','client')),
  body            text not null,
  context         text,                                  -- optional, e.g. "Phase 07 · Roth ladder"
  created_at      timestamptz not null default now(),
  read_by_advisor boolean not null default false
);
create index if not exists messages_client_idx on messages(client_id, created_at);

-- Fill firm_id from the client when the caller omits it (clients don't carry it).
create or replace function px_messages_fill_firm()
returns trigger language plpgsql as $$
begin
  if new.firm_id is null then
    select firm_id into new.firm_id from clients where id = new.client_id;
  end if;
  return new;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'messages_fill_firm') then
    create trigger messages_fill_firm before insert on messages
      for each row execute function px_messages_fill_firm();
  end if;
end $$;

alter table messages enable row level security;

do $$ begin
  -- Advisor: full control over threads for clients they advise.
  if not exists (select 1 from pg_policies where tablename='messages' and policyname='messages_advisor') then
    create policy messages_advisor on messages for all
      using (exists (select 1 from clients c where c.id = messages.client_id and c.advisor_id = px_current_advisor_id()))
      with check (exists (select 1 from clients c where c.id = messages.client_id and c.advisor_id = px_current_advisor_id()));
  end if;
  -- Firm admin: read across the firm.
  if not exists (select 1 from pg_policies where tablename='messages' and policyname='messages_admin_read') then
    create policy messages_admin_read on messages for select
      using (firm_id = px_current_firm_id() and px_is_firm_admin());
  end if;
  -- Client: read their own thread.
  if not exists (select 1 from pg_policies where tablename='messages' and policyname='messages_client_read') then
    create policy messages_client_read on messages for select
      using (client_id = px_current_client_id());
  end if;
  -- Client: post only as themselves, into their own thread.
  if not exists (select 1 from pg_policies where tablename='messages' and policyname='messages_client_insert') then
    create policy messages_client_insert on messages for insert
      with check (client_id = px_current_client_id() and author_role = 'client');
  end if;
end $$;

-- Realtime so each side sees new messages live.
do $$ begin
  alter publication supabase_realtime add table messages;
exception when others then null; end $$;
