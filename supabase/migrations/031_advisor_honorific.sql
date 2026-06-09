-- 031 · Advisor honorific (display title)
--
-- Lets an advisor choose how they're addressed in CLIENT-FACING copy — e.g.
-- "Ms. Chen will tailor this with you" instead of "M. Chen". Optional; when
-- blank the app falls back to the advisor's first name (existing behaviour).
--
-- Stored as the literal prefix the client sees ('Ms.', 'Mr.', 'Mx.', 'Dr.', …)
-- so the UI never has to map an enum → label. Free-text but UI-constrained to a
-- short picker. Self-update is already permitted by the advisors_update_self
-- RLS policy (001), so no new policy or RPC is needed — the client writes the
-- column directly, scoped to its own row.

alter table advisors add column if not exists honorific text;

comment on column advisors.honorific is
  'Optional display title shown to clients (e.g. Ms., Mr., Mx., Dr.). Null → first name is used.';
