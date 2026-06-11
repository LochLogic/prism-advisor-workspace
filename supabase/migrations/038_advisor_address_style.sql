-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Migration 038 — Advisor client-facing address style
-- Run in the Supabase SQL editor after 037_firm_status_guard_fix.sql
--
-- Separates two concepts that previously shared the honorific column:
--   honorific      = the advisor's name prefix (Ms. / Mr. / Dr. …) — identity
--   address_style  = how the CLIENT PORTAL refers to them:
--                    'first'  → "Jane"
--                    'last'   → "Smith"
--                    'formal' → "Ms. Smith" (honorific + last name)
-- NULL preserves the legacy derivation (honorific set → formal, else first),
-- so nothing changes for existing advisors until they pick a style.
-- advisors_update_self (001) already covers the write; no RLS change.
-- ════════════════════════════════════════════════════════════════════════════

alter table advisors add column if not exists address_style text
  check (address_style in ('first', 'last', 'formal'));

-- ── Client-safe advisor lookup ───────────────────────────────────────────────
-- Clients cannot read the advisors table (advisors_select_firm is
-- advisor-scoped), so the real client portal had no way to learn its advisor's
-- name and fell back to the demo mock ("Madeline Chen") — founder-era latent
-- bug, surfaced while wiring address_style. This security-definer RPC exposes
-- exactly the display fields a client needs about THEIR OWN advisor, nothing
-- else, leaving the table's RLS untouched.
create or replace function px_my_advisor()
returns table(full_name text, honorific text, credentials text, address_style text)
language sql security definer stable as $$
  select a.full_name, a.honorific, a.credentials, a.address_style
  from advisors a
  join clients c on c.advisor_id = a.id
  where c.auth_user_id = auth.uid()
  limit 1;
$$;
grant execute on function px_my_advisor() to authenticated;
