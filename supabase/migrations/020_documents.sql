-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Document vault  (migration 020)
-- A private Storage bucket + a `documents` metadata table so the signed IPS /
-- statements / tax / estate docs actually live somewhere. Advisor uploads; client
-- reviews + downloads (via short-lived signed URLs). An acknowledgement can point
-- at a stored document, so an e-sign attaches to a real file.
--
-- RLS mirrors the firm→advisor→client pattern used by acknowledgements (017) and
-- messages (019). Storage object access is scoped by the FIRST path segment being
-- the client_id, so a download is only possible for the owning client or advisor.
-- Fully idempotent — safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1 · documents metadata table ────────────────────────────────────────────
create table if not exists documents (
  id              uuid primary key default gen_random_uuid(),
  firm_id         uuid references firms(id)   on delete cascade,
  client_id       uuid not null references clients(id) on delete cascade,
  advisor_id      uuid references advisors(id) on delete set null,
  category        text not null default 'other'
                    check (category in ('ips','statement','tax','estate','disclosure','other')),
  title           text not null,
  file_name       text not null,
  storage_path    text not null,            -- path within the client-documents bucket
  mime_type       text,
  size_bytes      bigint,
  uploaded_by_role text not null default 'advisor' check (uploaded_by_role in ('advisor','client')),
  uploaded_at     timestamptz not null default now()
);
create index if not exists documents_client_idx on documents(client_id, uploaded_at desc);

-- Fill firm_id from the client when omitted (mirrors the messages trigger).
create or replace function px_documents_fill_firm()
returns trigger language plpgsql as $$
begin
  if new.firm_id is null then
    select firm_id into new.firm_id from clients where id = new.client_id;
  end if;
  return new;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'documents_fill_firm') then
    create trigger documents_fill_firm before insert on documents
      for each row execute function px_documents_fill_firm();
  end if;
end $$;

alter table documents enable row level security;

do $$ begin
  -- Advisor: full control over documents for clients they advise.
  if not exists (select 1 from pg_policies where tablename='documents' and policyname='documents_advisor') then
    create policy documents_advisor on documents for all
      using (exists (select 1 from clients c where c.id = documents.client_id and c.advisor_id = px_current_advisor_id()))
      with check (exists (select 1 from clients c where c.id = documents.client_id and c.advisor_id = px_current_advisor_id()));
  end if;
  -- Firm admin: read across the firm.
  if not exists (select 1 from pg_policies where tablename='documents' and policyname='documents_admin_read') then
    create policy documents_admin_read on documents for select
      using (firm_id = px_current_firm_id() and px_is_firm_admin());
  end if;
  -- Client: read their own documents.
  if not exists (select 1 from pg_policies where tablename='documents' and policyname='documents_client_read') then
    create policy documents_client_read on documents for select
      using (client_id = px_current_client_id());
  end if;
end $$;

-- ── 2 · link an acknowledgement to a stored document (e-sign on a real file) ──
alter table acknowledgements add column if not exists document_id uuid references documents(id) on delete set null;

-- ── 3 · private Storage bucket ───────────────────────────────────────────────
insert into storage.buckets (id, name, public)
  values ('client-documents', 'client-documents', false)
  on conflict (id) do nothing;

-- ── 4 · Storage object RLS — scoped by first path segment = client_id ─────────
-- Paths are stored as  <client_id>/<document_id>-<filename>  so (storage.foldername(name))[1]
-- is the owning client's id. Advisors get full control over their clients' objects;
-- clients can read (download) their own.
do $$ begin
  if not exists (select 1 from pg_policies
                 where schemaname='storage' and tablename='objects' and policyname='client_documents_advisor') then
    create policy client_documents_advisor on storage.objects for all
      using (
        bucket_id = 'client-documents'
        and exists (select 1 from clients c
                    where c.id = ((storage.foldername(name))[1])::uuid
                      and c.advisor_id = px_current_advisor_id())
      )
      with check (
        bucket_id = 'client-documents'
        and exists (select 1 from clients c
                    where c.id = ((storage.foldername(name))[1])::uuid
                      and c.advisor_id = px_current_advisor_id())
      );
  end if;
  if not exists (select 1 from pg_policies
                 where schemaname='storage' and tablename='objects' and policyname='client_documents_client_read') then
    create policy client_documents_client_read on storage.objects for select
      using (
        bucket_id = 'client-documents'
        and ((storage.foldername(name))[1])::uuid = px_current_client_id()
      );
  end if;
end $$;
