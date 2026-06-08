-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Migration 029 — Rebuild per-firm phase white-label (clean-room review M2)
--
-- Migration 001 shipped a per-firm phase override design (phase_library_platform
-- + phase_library_firm + a COALESCE resolving view). Migration 005 then DROPPED
-- and recreated `phase_library_resolved` to read a NEW global `phase_library`
-- table — silently orphaning the 001 override tables and disabling the documented
-- white-label feature (README: "Phase content can be FIRM-OVERRIDDEN"). The repo
-- was left with THREE phase tables where only the global one was read.
--
-- This restores white-label on top of 005's schema and removes the dual-schema
-- confusion:
--   1. `phase_overrides` — per-firm, per-phase nullable overrides aligned to the
--      005 `phase_library` columns (RLS: firm reads own; firm admin writes own).
--   2. `phase_library_resolved` rebuilt to COALESCE a firm's overrides over the
--      global defaults, scoped to px_current_firm_id(), keeping the exact shape the
--      app reads (camelCase metricLabel/metricKey, tasks jsonb).
--   3. The orphaned 001 tables (phase_library_platform / phase_library_firm) are
--      dropped.
-- The app reads only `phase_library_resolved`, so no frontend change is required to
-- pick this up; firms with no override rows see the platform defaults exactly as
-- before. Idempotent. Run after 028_audit_rpc.sql.
-- ════════════════════════════════════════════════════════════════════════════

-- 1 · Per-firm overrides (nullable columns = "inherit the platform default") ───
create table if not exists phase_overrides (
  firm_id      uuid not null references firms(id)         on delete cascade,
  phase_id     int  not null references phase_library(id) on delete cascade,
  num          text,
  title        text,
  tag          text,
  description  text,
  icon         text,
  rationale    text,
  calc         text,
  calc2        text,
  metric_label text,
  metric_key   text,
  tasks        jsonb,          -- full override of the phase's task list, when set
  updated_at   timestamptz default now(),
  primary key (firm_id, phase_id)
);

alter table phase_overrides enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'phase_overrides' and policyname = 'phase_overrides_read') then
    create policy phase_overrides_read on phase_overrides for select
      using (firm_id = px_current_firm_id());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'phase_overrides' and policyname = 'phase_overrides_write') then
    create policy phase_overrides_write on phase_overrides for all
      using      (firm_id = px_current_firm_id() and px_is_firm_admin())
      with check (firm_id = px_current_firm_id() and px_is_firm_admin());
  end if;
end $$;

-- 2 · Drop the orphaned 001 white-label tables (nothing reads them post-005).
--     `cascade` also clears their RLS policies; the view is recreated below in
--     case an environment is still on the 001 view that referenced these tables.
drop table if exists phase_library_firm     cascade;
drop table if exists phase_library_platform cascade;

-- 3 · Resolving view: firm override → platform default, scoped to the caller's firm.
--     Shape mirrors what the app consumes (db.jsx getPhases → mergePhasesWithDB):
--     id, num, title, tag, description, icon, rationale, calc, calc2,
--     "metricLabel", "metricKey", tasks.
drop view if exists phase_library_resolved;
create view phase_library_resolved as
with platform_tasks as (
  select pt.phase_id,
         coalesce(
           json_agg(json_build_object('id', pt.id, 'label', pt.label, 'tool', pt.tool)
                    order by pt.sort_order) filter (where pt.id is not null),
           '[]'::json
         )::jsonb as tasks
  from phase_tasks pt
  group by pt.phase_id
)
select
  pl.id,
  coalesce(o.num,          pl.num)           as num,
  coalesce(o.title,        pl.title)         as title,
  coalesce(o.tag,          pl.tag)           as tag,
  coalesce(o.description,  pl.description)   as description,
  coalesce(o.icon,         pl.icon)          as icon,
  coalesce(o.rationale,    pl.rationale)     as rationale,
  coalesce(o.calc,         pl.calc)          as calc,
  coalesce(o.calc2,        pl.calc2)         as calc2,
  coalesce(o.metric_label, pl.metric_label)  as "metricLabel",
  coalesce(o.metric_key,   pl.metric_key)    as "metricKey",
  coalesce(o.tasks, ptk.tasks, '[]'::jsonb)  as tasks,
  px_current_firm_id()                       as firm_id
from phase_library pl
left join platform_tasks ptk on ptk.phase_id = pl.id
left join phase_overrides o  on o.phase_id = pl.id and o.firm_id = px_current_firm_id()
order by pl.sort_order;

grant select on phase_library_resolved to authenticated;
