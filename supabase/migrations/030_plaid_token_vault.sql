-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Migration 030 — Encrypt Plaid access tokens at rest (clean-room M3)
--
-- plaid-exchange-token stored the Plaid access_token (a long-lived credential that
-- reads a household's linked bank/brokerage balances) in plaintext in
-- aggregation_items.access_token. Any read of that table or a DB backup would yield
-- live aggregation credentials. This moves the secret into Supabase Vault and keeps
-- only the secret id on the row. (Plaid is still in sandbox, so the table holds no
-- real tokens yet — this lands the control before production keys arrive.)
--
-- There is currently no token read-back path in the codebase (no refresh job), so
-- this is a write-path change only. Idempotent. Run after 029_phase_whitelabel_rebuild.sql.
-- ════════════════════════════════════════════════════════════════════════════

-- Vault is already used by this project (CRON_SECRET); ensure the extension exists.
create extension if not exists supabase_vault with schema vault;

-- Keep the secret id, not the token. The legacy access_token column stays for
-- back-compat but is no longer written (it should always be null going forward).
alter table aggregation_items
  add column if not exists access_token_secret_id uuid;

-- Service-role-only wrapper: store a token in Vault, return its secret id. The
-- token is passed as the secret value and a non-unique label as the description
-- (Vault enforces uniqueness on name, not description, so retries can't collide).
create or replace function px_vault_store_token(p_secret text, p_label text default null)
returns uuid
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare v_id uuid;
begin
  if coalesce(p_secret, '') = '' then
    return null;
  end if;
  select vault.create_secret(p_secret, null, p_label) into v_id;
  return v_id;
end $$;

-- Only the service role (the plaid-exchange-token edge function) may call this;
-- never the browser. Revoke the implicit PUBLIC execute, then grant service_role.
revoke all on function px_vault_store_token(text, text) from public, anon, authenticated;
grant execute on function px_vault_store_token(text, text) to service_role;
