-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Migration 034 — Bulk client import RPC
--
-- The CSV importer previously issued N sequential round-trips per file
-- (client insert + profile save + account insert + totals sync per row),
-- non-transactionally. px_bulk_create_clients does one round-trip per batch:
-- inserts clients (profile shell auto-seeds via trg_px_seed_client), writes
-- the imported profile JSON, creates the placeholder AUM account, syncs the
-- client totals, and audit-logs each creation — all in one transaction.
--
-- SECURITY INVOKER on purpose: every insert/update runs under the caller's
-- RLS (clients_advisor_rw etc.), so the function adds no privilege — it only
-- batches. advisor_id/firm_id come from the session, never the payload.
-- Idempotent. Run after 033.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function px_bulk_create_clients(p_rows jsonb)
returns setof clients
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  r   jsonb;
  c   clients;
  v_aum numeric;
begin
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'p_rows must be a JSON array';
  end if;
  if jsonb_array_length(p_rows) > 500 then
    raise exception 'p_rows is limited to 500 rows per call';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    continue when coalesce(trim(r->>'household_name'), '') = '';

    insert into clients (advisor_id, firm_id, household_name, short_name, household_tag, current_phase, active)
    values (
      px_current_advisor_id(),
      px_current_firm_id(),
      trim(r->>'household_name'),
      coalesce(nullif(trim(coalesce(r->>'short_name', '')), ''), trim(r->>'household_name')),
      coalesce(r->>'household_tag', ''),
      0,
      true
    )
    returning * into c;

    -- Imported profile fields (the seed trigger created an empty shell).
    if r ? 'profile' and jsonb_typeof(r->'profile') = 'object' then
      update profiles set data = r->'profile', updated_at = now()
       where client_id = c.id;
    end if;

    -- Placeholder AUM account + totals, mirroring the per-row importer path.
    v_aum := nullif(r->>'aum', '')::numeric;
    if v_aum is not null and v_aum > 0 then
      insert into accounts (client_id, type, custodian, balance, cash, as_of)
      values (c.id, 'taxable', 'Imported — update', v_aum, 0, current_date);
      update clients set aum = v_aum, uninvested_cash = 0, updated_at = now()
       where id = c.id
      returning * into c;
    end if;

    perform px_audit(
      p_action      => 'client.create',
      p_entity_type => 'client',
      p_entity_id   => c.id::text,
      p_client_id   => c.id,
      p_summary     => 'Created client ' || c.household_name || ' (bulk import)'
    );

    return next c;
  end loop;
end $$;

revoke all on function px_bulk_create_clients(jsonb) from public, anon;
grant execute on function px_bulk_create_clients(jsonb) to authenticated;
