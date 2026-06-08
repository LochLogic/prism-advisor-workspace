-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Migration 027 — DocuSign real e-sign on acknowledgements
--   Migration 017 gave us in-portal "type your name" acknowledgements (provider
--   'prism'). This adds optional legally-binding e-signature via DocuSign: the
--   advisor escalates a pending acknowledgement to a DocuSign envelope, the
--   client signs in DocuSign (email ceremony), and the `docusign-connect`
--   webhook marks the row signed when the envelope completes.
--
--   No new RLS is needed: the existing select policies (ack_advisor / ack_admin_read
--   / ack_client_read) already cover the new columns (select *). All writes here
--   are performed by the edge functions with the service role:
--     • docusign-envelope (advisor-triggered, JWT-verified) sets provider/envelope_*
--     • docusign-connect  (DocuSign webhook, HMAC-verified) completes the row
--   Run after 026_retention_rollup.sql. See docs/docusign-setup.md to activate.
-- ════════════════════════════════════════════════════════════════════════════

alter table acknowledgements
  add column if not exists provider        text not null default 'prism',  -- prism | docusign
  add column if not exists envelope_id     text,                           -- DocuSign envelope id
  add column if not exists envelope_status text,                           -- sent | delivered | completed | declined | voided
  add column if not exists sent_at         timestamptz;                    -- when the DocuSign envelope was sent

-- Looked up by the Connect webhook to resolve which row an envelope event belongs to.
create unique index if not exists ack_envelope_idx
  on acknowledgements(envelope_id) where envelope_id is not null;

-- Defence in depth: the column is written only by service-role functions, but
-- constrain the value so a stray write can't store an unknown provider.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ack_provider_chk') then
    alter table acknowledgements
      add constraint ack_provider_chk check (provider in ('prism', 'docusign'));
  end if;
end $$;
