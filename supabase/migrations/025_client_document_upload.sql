-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Migration 025 — client-initiated document uploads
--   migration 020 created the document vault but only granted CLIENTS read/
--   download (documents_client_read + client_documents_client_read). The
--   `uploaded_by_role` column already allows the value 'client', but no RLS
--   policy let a client actually INSERT — so client uploads were impossible.
--   This adds the missing insert path, scoped tightly:
--     • metadata: a client may insert only rows for THEIR OWN client_id and only
--       with uploaded_by_role='client' (can't impersonate an advisor upload).
--     • storage:  a client may insert objects only under their own <client_id>/
--       prefix.
--   Deliberately NO client UPDATE/DELETE: advisor-shared files live under the
--   same <client_id>/ prefix, so a delete scoped by prefix alone would let a
--   client remove advisor documents. Advisors keep full management (020).
--   Fully idempotent — safe to re-run. Run after 024_client_invite.sql.
-- ════════════════════════════════════════════════════════════════════════════

do $$ begin
  -- Client: insert metadata for their own household, marked as a client upload.
  if not exists (select 1 from pg_policies where tablename='documents' and policyname='documents_client_insert') then
    create policy documents_client_insert on documents for insert
      with check (
        client_id = px_current_client_id()
        and uploaded_by_role = 'client'
      );
  end if;
end $$;

-- Storage object insert — scoped by first path segment = client_id (mirrors the
-- read policy from 020). Lets the client write the binary under their own prefix.
do $$ begin
  if not exists (select 1 from pg_policies
                 where schemaname='storage' and tablename='objects' and policyname='client_documents_client_insert') then
    create policy client_documents_client_insert on storage.objects for insert
      with check (
        bucket_id = 'client-documents'
        and ((storage.foldername(name))[1])::uuid = px_current_client_id()
      );
  end if;
end $$;
