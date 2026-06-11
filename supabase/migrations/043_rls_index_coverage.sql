-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Migration 043 — RLS-predicate index coverage audit (round 13)
--
-- Every RLS policy predicate re-executes on each row a query touches, so the
-- tenant-scoping columns (firm_id / advisor_id / client_id / auth_user_id)
-- must be indexed or firm-admin reads degrade to sequential scans as data
-- grows. Audit method: every `create policy` predicate across migrations
-- 001–042 cross-checked against every `create index`.
--
-- Already covered (no action): advisors(firm_id, auth_user_id) ·
-- clients(firm_id, advisor_id, auth_user_id) · profiles/profile_versions/
-- accounts/cash_flows/balance_history/meetings/documents/messages/
-- acknowledgements(client_id…) · flagged_questions(advisor_id, client_id) ·
-- alerts(advisor_id) · crm_tasks(advisor_id, client_id) · audit_log(firm_id,
-- client_id, actor_id) · invoices(firm_id) · task_states via
-- unique(client_id, phase_id, task_id) · calendar_connections via
-- unique(user_id, provider) · phase_overrides via PK(firm_id, phase_id) ·
-- pending_ledger_changes(firm_id, status) · px_events / push_subscriptions
-- (created indexed in 041/042). The advisor-pair predicates
-- (`exists (select 1 from clients c where c.id = X.client_id …)`) probe
-- clients by PRIMARY KEY — covered by definition.
--
-- Gaps closed below — all are live policy predicates with NO index today.
-- The firm_id ones are exactly the "firm-admin cross-firm read" paths the
-- roadmap item called out (messages_admin_read, documents_admin_read,
-- ack_admin_read, crm_tasks_admin_read, fs_read_firm, subs read).
-- Idempotent. Run after 042_push_subscriptions.sql.
-- ════════════════════════════════════════════════════════════════════════════

-- Firm-admin cross-firm reads (policy: firm_id = px_current_firm_id() [+ admin])
create index if not exists messages_firm_idx      on messages(firm_id);
create index if not exists documents_firm_idx     on documents(firm_id);
create index if not exists ack_firm_idx           on acknowledgements(firm_id);
create index if not exists crm_tasks_firm_idx     on crm_tasks(firm_id);
create index if not exists fee_schedules_firm_idx on fee_schedules(firm_id);
create index if not exists subscriptions_firm_idx on subscriptions(firm_id);

-- Client-scoped reads (policy: client_id = px_current_client_id())
create index if not exists invoices_client_idx on invoices(client_id);
create index if not exists plc_client_idx      on pending_ledger_changes(client_id, status);

-- crm_tasks assignment view (014 policy: assigned_to = px_current_advisor_id())
create index if not exists crm_tasks_assigned_idx on crm_tasks(assigned_to, status);
