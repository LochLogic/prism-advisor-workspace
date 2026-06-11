-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Migration 039 — phase_library_resolved → security_invoker
--
-- Supabase Security Advisor (ERROR level): plain views run with the view
-- OWNER's permissions, so RLS on the underlying tables is evaluated as the
-- owner (effectively bypassed) rather than as the querying user. The view's
-- own px_current_firm_id() join already scoped overrides correctly, so this
-- was defense-in-depth, not a live leak — but flipping to security_invoker
-- restores RLS as the backstop with zero behavioral change:
--   • phase_library / phase_tasks policies are `using (true)` for authenticated;
--   • phase_overrides' read policy (firm_id = px_current_firm_id()) is exactly
--     the view's join predicate, so results are identical.
--
-- APPLIED LIVE 2026-06-10 (hand-run in the SQL editor before this file landed;
-- committed for the record so fresh environments match production).
-- ════════════════════════════════════════════════════════════════════════════

alter view phase_library_resolved set (security_invoker = true);
