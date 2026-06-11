-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Migration 042 — Web-push subscriptions (client PWA)
--
-- Stores browser PushSubscription endpoints so the `send-push` edge function
-- can notify a client's installed portal (new advisor message, document
-- request, acknowledgement to sign). One row per browser endpoint; a user can
-- hold several (phone + desktop).
--
-- Identity (auth_user_id / client_id / firm_id) is stamped by a BEFORE INSERT
-- trigger from the session — the browser supplies only the endpoint + keys
-- (the px_messages_fill_firm pattern). RLS: owners manage their own rows; the
-- edge function reads with the service role.
-- Idempotent. Run after 041_product_events.sql.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  client_id    uuid references clients(id) on delete cascade,
  firm_id      uuid,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz not null default now()
);

create index if not exists push_subs_user_idx   on push_subscriptions(auth_user_id);
create index if not exists push_subs_client_idx on push_subscriptions(client_id);

alter table push_subscriptions enable row level security;

-- Stamp identity from the session on every insert (never trust the row).
create or replace function px_push_fill_identity() returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.auth_user_id := auth.uid();
  select c.id, c.firm_id into new.client_id, new.firm_id
    from clients c where c.auth_user_id = auth.uid() limit 1;
  if new.firm_id is null then
    select a.firm_id into new.firm_id
      from advisors a where a.auth_user_id = auth.uid() limit 1;
  end if;
  return new;
end $$;
revoke execute on function px_push_fill_identity() from public, anon, authenticated;

drop trigger if exists push_fill_identity on push_subscriptions;
create trigger push_fill_identity
  before insert on push_subscriptions
  for each row execute function px_push_fill_identity();

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'push_subscriptions' and policyname = 'push_subs_own') then
    create policy push_subs_own on push_subscriptions for all
      using      (auth_user_id = auth.uid())
      with check (auth_user_id = auth.uid());
  end if;
end $$;
