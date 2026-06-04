-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Pre-pilot hardening (migration 018)
--   1. Pin search_path on the SECURITY DEFINER functions that were missing it
--      (defense against search_path manipulation of elevated-privilege code).
--   2. client_errors sink for the lightweight error reporter (service-role only).
-- ════════════════════════════════════════════════════════════════════════════

-- 1 · search_path on SECURITY DEFINER functions (by name, signature-agnostic) ──
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and p.proname in (
        'px_current_advisor_id','px_current_client_id','px_current_firm_id',
        'px_is_firm_admin','px_sign_acknowledgement','update_client_last_meeting'
      )
  loop
    execute format('alter function %s set search_path = public, pg_temp', r.sig);
  end loop;
end $$;

-- 2 · Client error sink ───────────────────────────────────────────────────────
create table if not exists client_errors (
  id          bigint generated always as identity primary key,
  occurred_at timestamptz default now(),
  message     text,
  stack       text,
  url         text,
  user_agent  text,
  context     jsonb
);
create index if not exists client_errors_time_idx on client_errors(occurred_at desc);

-- RLS on with NO policies → deny-all to anon/authenticated. Only the service role
-- (the log-error Edge Function) writes; you read it in the Supabase dashboard.
alter table client_errors enable row level security;
