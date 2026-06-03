-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Client acknowledgements / e-sign  (migration 017)
-- An advisor requests a client acknowledgement (e.g. IPS, ADV, fee disclosure);
-- the client reviews it in their portal and signs (types their name). The signed
-- record is immutable from the client side and captured in the audit trail.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists acknowledgements (
  id                   uuid primary key default gen_random_uuid(),
  firm_id              uuid not null references firms(id)   on delete cascade,
  client_id            uuid not null references clients(id) on delete cascade,
  advisor_id           uuid references advisors(id)         on delete set null,
  title                text not null,                 -- e.g. "Investment Policy Statement"
  body                 text,                          -- statement text shown to the client
  status               text not null default 'pending', -- pending | acknowledged
  requested_at         timestamptz default now(),
  acknowledged_at      timestamptz,
  signer_name          text,                          -- typed name at signing
  signer_auth_user_id  uuid references auth.users(id)
);
create index if not exists ack_client_idx on acknowledgements(client_id, status);

alter table acknowledgements enable row level security;

do $$ begin
  -- Advisor: full control over acknowledgements for clients they advise.
  if not exists (select 1 from pg_policies where tablename='acknowledgements' and policyname='ack_advisor') then
    create policy ack_advisor on acknowledgements for all
      using (exists (select 1 from clients c where c.id = acknowledgements.client_id and c.advisor_id = px_current_advisor_id()))
      with check (exists (select 1 from clients c where c.id = acknowledgements.client_id and c.advisor_id = px_current_advisor_id()));
  end if;
  -- Firm admin: read across the firm.
  if not exists (select 1 from pg_policies where tablename='acknowledgements' and policyname='ack_admin_read') then
    create policy ack_admin_read on acknowledgements for select
      using (firm_id = px_current_firm_id() and px_is_firm_admin());
  end if;
  -- Client: read their own (signing is done via the SECURITY DEFINER RPC below,
  -- so clients get no direct UPDATE — they can't alter the title/body/advisor).
  if not exists (select 1 from pg_policies where tablename='acknowledgements' and policyname='ack_client_read') then
    create policy ack_client_read on acknowledgements for select
      using (client_id = px_current_client_id());
  end if;
end $$;

-- Client signs their own pending acknowledgement. Sets only the signing fields,
-- only on a row that belongs to the caller and is still pending.
create or replace function px_sign_acknowledgement(p_id uuid, p_signer_name text)
returns acknowledgements
language plpgsql security definer as $$
declare r acknowledgements;
begin
  update acknowledgements
     set status = 'acknowledged',
         acknowledged_at = now(),
         signer_name = nullif(trim(p_signer_name), ''),
         signer_auth_user_id = auth.uid()
   where id = p_id
     and client_id = (select id from clients where auth_user_id = auth.uid())
     and status = 'pending'
   returning * into r;
  return r;
end $$;
