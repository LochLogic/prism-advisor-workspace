-- Migration 005 — Phase library + last_meeting_at
-- Stores the 7-horizon phase definitions in Supabase so they can be
-- customised per-firm in the future. Also adds last_meeting_at to the
-- clients table so the roster can show "last reviewed" without a JOIN.

-- ────────────────────────────────────────────────────────────────────
-- 1. Add last_meeting_at to clients
-- ────────────────────────────────────────────────────────────────────
alter table clients
  add column if not exists last_meeting_at timestamptz;

-- Trigger: keep last_meeting_at current whenever a meeting is inserted
create or replace function update_client_last_meeting()
returns trigger language plpgsql security definer as $$
begin
  update clients
  set last_meeting_at = new.met_at
  where id = new.client_id
    and (last_meeting_at is null or new.met_at > last_meeting_at);
  return new;
end;
$$;

drop trigger if exists trg_client_last_meeting on meetings;
create trigger trg_client_last_meeting
  after insert on meetings
  for each row execute function update_client_last_meeting();

-- Back-fill from existing meetings
update clients c
set last_meeting_at = m.met_at
from (
  select distinct on (client_id) client_id, met_at
  from meetings
  order by client_id, met_at desc
) m
where c.id = m.client_id
  and (c.last_meeting_at is null or m.met_at > c.last_meeting_at);

-- ────────────────────────────────────────────────────────────────────
-- 2. Phase library tables
-- ────────────────────────────────────────────────────────────────────
create table if not exists phase_library (
  id           int  primary key,          -- 0-6, matches phasesData[].id
  num          text not null,             -- '01' … '07'
  title        text not null,
  tag          text not null,
  description  text not null,
  icon         text not null,
  rationale    text not null,
  calc         text,
  calc2        text,
  metric_label text,
  metric_key   text,
  sort_order   int  not null default 0
);

create table if not exists phase_tasks (
  id         text primary key,            -- 'p0t1', 'p0t2', …
  phase_id   int  not null references phase_library(id) on delete cascade,
  label      text not null,
  tool       text check (tool in ('discuss', 'advanced')),
  sort_order int  not null default 0
);

-- RLS: global config — every authenticated user may read
alter table phase_library enable row level security;
alter table phase_tasks    enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'phase_library' and policyname = 'authenticated read'
  ) then
    create policy "authenticated read" on phase_library for select using (true);
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'phase_tasks' and policyname = 'authenticated read'
  ) then
    create policy "authenticated read" on phase_tasks for select using (true);
  end if;
end $$;

-- ────────────────────────────────────────────────────────────────────
-- 3. Resolved view — mirrors the JS phasesData shape
-- ────────────────────────────────────────────────────────────────────
create or replace view phase_library_resolved as
select
  pl.id,
  pl.num,
  pl.title,
  pl.tag,
  pl.description,
  pl.icon,
  pl.rationale,
  pl.calc,
  pl.calc2,
  pl.metric_label  as "metricLabel",
  pl.metric_key    as "metricKey",
  coalesce(
    json_agg(
      json_build_object('id', pt.id, 'label', pt.label, 'tool', pt.tool)
      order by pt.sort_order
    ) filter (where pt.id is not null),
    '[]'::json
  ) as tasks
from  phase_library pl
left join phase_tasks pt on pt.phase_id = pl.id
group by pl.id
order by pl.sort_order;

grant select on phase_library_resolved to authenticated;

-- ────────────────────────────────────────────────────────────────────
-- 4. Seed: 7 phases
-- ────────────────────────────────────────────────────────────────────
insert into phase_library
  (id, num, title, tag, description, icon, rationale, calc, calc2, metric_label, metric_key, sort_order)
values
(0, '01', 'Foundation', 'Stabilization',
 'Establish the operational base — predictable cash flow, current obligations, and a disciplined household ledger.',
 'Shield',
 'Before optimization, stabilization. <b>Cash flow precedes capital allocation.</b> A clear monthly accounting — every dollar in, every dollar out — is the prerequisite for every subsequent decision. We map the household ledger together in onboarding, then refresh quarterly.',
 'cashflow', null, 'Monthly outflow', 'totalExpenses', 0),

(1, '02', 'Liquidity Reserve', 'Protection',
 'Build the operating cushion — six months of essential outflow held in laddered cash equivalents, isolated from market risk.',
 'Umbrella',
 'The reserve is not a return vehicle. Its function is to <b>prevent forced liquidation of long-horizon assets during a drawdown</b>. Six months is standard for stable W-2 income; we extend to twelve for variable compensation, equity-heavy households, or pre-retirees.',
 'reserve', null, 'Six-month target', 'reserveTarget', 1),

(2, '03', 'Liability Optimization', 'Velocity',
 'Retire high-cost debt at a rate that exceeds plausible after-tax investment returns. Apply the avalanche method against APRs above 6%.',
 'TrendDown',
 'Debt servicing above ~7% APR produces a <b>guaranteed, tax-free negative return</b> that no reasonable portfolio can systematically beat after fees, taxes, and sequence risk. We attack the highest-APR balance first, hold minimums on the rest, and roll the freed payment forward. Balance transfers and rate negotiations are the first move, not the last.',
 'avalanche', null, 'High-cost balance', 'toxicDebt', 2),

(3, '04', 'Tax-Advantaged Foundations', 'Shelter',
 'Fund the triple-advantaged HSA in full. The most efficient single vehicle in the US tax code when the household qualifies.',
 'Heart',
 'The HSA is the only US account with <b>three-axis tax advantage</b>: deductible contributions, tax-free growth, and tax-free qualified withdrawals. We treat it as a stealth retirement bucket — invest the balance, pay current medical costs from cash flow, and retain receipts for tax-free reimbursement decades hence.',
 'hsa', null, 'Annual tax savings', 'hsaTaxSavings', 3),

(4, '05', 'Retirement Sleeve Construction', 'Long Horizon',
 'Layer Roth/Traditional IRA contributions and complete employer plan deferrals. Establish target asset allocation by location.',
 'Briefcase',
 'Sleeve construction is a tax-location problem more than a security-selection problem. The household holds the same total equity exposure across accounts — but <b>tax-inefficient assets (corporate bonds, REITs, active funds) live in tax-deferred space</b>, while broad equity index funds anchor taxable and Roth. We model the optimal placement annually in the Asset Location tool.',
 'assetlocation', null, 'Retirement assets', 'retirementAssets', 4),

(5, '06', 'Capital Deployment', 'Velocity',
 'Extend the portfolio into taxable space with disciplined dollar-cost averaging, tax-loss harvesting, and broad index exposure.',
 'TrendUp',
 'Taxable capital is the lever that compresses time-to-independence. <b>Systematic tax-loss harvesting adds an estimated 0.50–1.50% in annualized after-tax return</b> across full market cycles — the engine our discretionary management runs on. We coordinate concentrated equity, 10b5-1 plans, and Roth conversion windows from this base.',
 'montecarlo', null, 'Taxable assets', 'taxableBalance', 5),

(6, '07', 'Legacy & Drawdown', 'Stewardship',
 'Sequence withdrawals tax-efficiently, optimize Roth conversion ladder, and structure the estate for intergenerational transfer.',
 'Anchor',
 'The accumulation problem and the distribution problem are different problems. <b>Withdrawal sequencing — taxable, then tax-deferred, then Roth — combined with Roth conversions during low-income years can preserve six- to seven-figure value across the lifecycle.</b> Estate structuring (revocable trust, beneficiary designations, basis step-up) is non-negotiable above HNW thresholds.',
 'rothladder', 'estate', 'Projected legacy', 'legacyValue', 6)

on conflict (id) do nothing;

-- ────────────────────────────────────────────────────────────────────
-- 5. Seed: 34 tasks
-- ────────────────────────────────────────────────────────────────────
insert into phase_tasks (id, phase_id, label, tool, sort_order) values
-- Phase 0 — Foundation
('p0t1', 0, 'Complete household cash-flow worksheet', 'discuss', 0),
('p0t2', 0, 'Confirm essential expenses are current',  null,      1),
('p0t3', 0, 'Establish autopay across recurring obligations', null, 2),
('p0t4', 0, 'Review and acknowledge fiduciary disclosure', 'discuss', 3),
('p0t5', 0, 'Sign Investment Policy Statement (draft)', 'discuss', 4),
-- Phase 1 — Liquidity Reserve
('p1t1', 1, 'Open laddered HYSA / Treasury MMF (4-tier)', null, 0),
('p1t2', 1, 'Fund Month 1–3 reserve from working cash',  null, 1),
('p1t3', 1, 'Capture full employer 401(k) match (parallel)', 'discuss', 2),
('p1t4', 1, 'Document recurring obligations + minimums', null, 3),
('p1t5', 1, 'Build to six-month target — review semi-annually', 'discuss', 4),
-- Phase 2 — Liability Optimization
('p2t1', 2, 'Compile complete liability schedule',          null,      0),
('p2t2', 2, 'Negotiate rate reductions on revolving credit', 'discuss', 1),
('p2t3', 2, 'Execute balance transfers where economical',    'discuss', 2),
('p2t4', 2, 'Apply avalanche payoff above 6% APR',          null,      3),
('p2t5', 2, 'Quarterly debt schedule review',               null,      4),
-- Phase 3 — Tax-Advantaged Foundations
('p3t1', 3, 'Confirm HDHP eligibility for current plan year', 'discuss', 0),
('p3t2', 3, 'Fund annual HSA limit ($4,400 / $8,750)',        null,      1),
('p3t3', 3, 'Migrate cash balance to invested HSA assets',    'discuss', 2),
('p3t4', 3, 'Establish receipt archive for future reimbursement', null,  3),
-- Phase 4 — Retirement Sleeve Construction
('p4t1', 4, 'Confirm Roth vs. Traditional split for current year', 'discuss',  0),
('p4t2', 4, 'Execute backdoor Roth if above phase-out',             'discuss',  1),
('p4t3', 4, 'Complete employee 401(k)/403(b) deferral ($23,500)',   null,       2),
('p4t4', 4, 'Review asset allocation across all sleeves',           'discuss',  3),
('p4t5', 4, 'Run Asset Location optimizer (annual)',                'advanced', 4),
-- Phase 5 — Capital Deployment
('p5t1', 5, 'Open jointly-titled taxable brokerage',            null,       0),
('p5t2', 5, 'Set automated monthly deployment',                  null,       1),
('p5t3', 5, 'Enable systematic tax-loss harvesting',             'discuss',  2),
('p5t4', 5, 'Run Monte Carlo retirement projection',             'advanced', 3),
('p5t5', 5, 'Quarterly portfolio review with advisor',           'discuss',  4),
-- Phase 6 — Legacy & Drawdown
('p6t1', 6, 'Build 5-year Roth conversion ladder',               'advanced', 0),
('p6t2', 6, 'Model RMD impact at age 73',                        'advanced', 1),
('p6t3', 6, 'Bridge ACA coverage to Medicare (if applicable)',   'discuss',  2),
('p6t4', 6, 'Execute revocable trust + beneficiary review',      'discuss',  3),
('p6t5', 6, 'Run Estate & Generational Wealth model',            'advanced', 4)

on conflict (id) do nothing;
