-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Advisor Workspace — Multi-tenant schema with Row-Level Security
-- Migration: 001_prism_schema.sql
--
-- Tenancy model
-- ─────────────
--   firm          ─ a registered RIA (Prism SaaS tenant)
--    └─ advisor   ─ a user with an advisor seat at a firm
--        └─ client (household) ─ a relationship managed by one advisor
--            └─ profile (household ledger)
--            └─ task_state (which milestones are checked)
--            └─ flagged_question (Discuss-with-advisor)
--
-- A client also has an `auth_user_id` pointing to their own Supabase auth
-- record — that is how the Client Portal authenticates.
--
-- RLS guarantees
-- ──────────────
--   • Advisor A can ONLY see clients where clients.advisor_id = A.id
--   • Firm admins can see all clients where firm_id matches
--   • Client B can ONLY read/write their OWN profile row
--   • Phase content can be FIRM-OVERRIDDEN (white-label) but defaults
--     to the platform library
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── 1 · Firms (the SaaS tenant) ─────────────────────────────────────────────
create table if not exists firms (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text unique not null,
  brand_color     text default '#1c2e4a',
  logo_url        text,
  fiduciary_disclosure text,
  -- platform metadata
  plan            text default 'starter',         -- starter | growth | enterprise
  seats_purchased int  default 1,
  created_at      timestamptz default now()
);

-- ── 2 · Advisors (firm employees with a Prism seat) ─────────────────────────
create table if not exists advisors (
  id              uuid primary key default gen_random_uuid(),
  auth_user_id    uuid unique not null references auth.users(id) on delete cascade,
  firm_id         uuid not null references firms(id) on delete cascade,
  full_name       text not null,
  email           text not null,
  role            text not null default 'advisor',   -- advisor | admin | analyst
  credentials     text,                              -- e.g. 'CFP®, CFA'
  active          boolean default true,
  created_at      timestamptz default now()
);
create index if not exists advisors_firm_idx on advisors(firm_id);
create index if not exists advisors_user_idx on advisors(auth_user_id);

-- ── 3 · Clients (households the advisor manages) ────────────────────────────
create table if not exists clients (
  id              uuid primary key default gen_random_uuid(),
  firm_id         uuid not null references firms(id) on delete cascade,
  advisor_id      uuid not null references advisors(id) on delete restrict,
  auth_user_id    uuid unique references auth.users(id) on delete set null,
  household_name  text not null,
  short_name      text,
  household_tag   text,                              -- "Joint · age 62"
  current_phase   smallint not null default 0,
  notes           text,
  active          boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists clients_firm_idx     on clients(firm_id);
create index if not exists clients_advisor_idx  on clients(advisor_id);
create index if not exists clients_auth_idx     on clients(auth_user_id);

-- ── 4 · Profiles (household financial ledger) ───────────────────────────────
create table if not exists profiles (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid unique not null references clients(id) on delete cascade,
  data            jsonb not null default '{}'::jsonb,
  updated_at      timestamptz default now()
);
create index if not exists profiles_client_idx on profiles(client_id);

-- ── 5 · Task states (which milestones are checked) ──────────────────────────
create table if not exists task_states (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references clients(id) on delete cascade,
  phase_id        smallint not null,
  task_id         text not null,
  done            boolean not null default false,
  done_at         timestamptz,
  done_by         uuid references auth.users(id),
  unique (client_id, phase_id, task_id)
);

-- ── 6 · Flagged questions (Discuss-with-advisor) ────────────────────────────
create table if not exists flagged_questions (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references clients(id) on delete cascade,
  advisor_id      uuid not null references advisors(id),
  phase_id        smallint not null,
  task_id         text not null,
  question_text   text,                              -- optional free-text
  status          text default 'open',               -- open | resolved | snoozed
  created_at      timestamptz default now(),
  resolved_at     timestamptz
);
create index if not exists flagged_advisor_idx on flagged_questions(advisor_id, status);
create index if not exists flagged_client_idx  on flagged_questions(client_id);

-- ── 7 · Alerts (system-generated nudges for advisor) ────────────────────────
create table if not exists alerts (
  id              uuid primary key default gen_random_uuid(),
  advisor_id      uuid not null references advisors(id) on delete cascade,
  client_id       uuid not null references clients(id) on delete cascade,
  priority        text not null default 'med',       -- high | med | low
  category        text,                              -- cash_drag | tlh | roth_window | drift | ...
  headline        text not null,
  body            text,
  status          text default 'open',               -- open | snoozed | dismissed | done
  expires_at      timestamptz,
  created_at      timestamptz default now()
);
create index if not exists alerts_advisor_idx on alerts(advisor_id, status, priority);

-- ── 8 · Phase library (platform defaults + per-firm overrides) ──────────────
-- The PLATFORM ships a canonical 7-Phase library. A firm can override any
-- field per-phase to white-label the experience (rename phases, replace
-- rationale copy, edit tasks, etc.). Resolution at read-time is COALESCE:
-- firm override → platform default.

create table if not exists phase_library_platform (
  phase_id        smallint primary key,
  num             text not null,
  title           text not null,
  tag             text,
  description     text,
  rationale_html  text,
  icon            text,
  metric_label    text,
  metric_key      text,
  calc            text,
  tasks           jsonb not null default '[]'::jsonb -- [{id,label,tool}]
);

create table if not exists phase_library_firm (
  firm_id         uuid not null references firms(id) on delete cascade,
  phase_id        smallint not null,
  num             text,
  title           text,
  tag             text,
  description     text,
  rationale_html  text,
  metric_label    text,
  tasks           jsonb,
  primary key (firm_id, phase_id)
);

-- ════════════════════════════════════════════════════════════════════════════
-- ROW-LEVEL SECURITY
-- ════════════════════════════════════════════════════════════════════════════

-- Helper functions — the "who is this request" identifiers
create or replace function px_current_advisor_id() returns uuid
language sql security definer stable as $$
  select id from advisors where auth_user_id = auth.uid() limit 1;
$$;

create or replace function px_current_firm_id() returns uuid
language sql security definer stable as $$
  select firm_id from advisors where auth_user_id = auth.uid() limit 1;
$$;

create or replace function px_is_firm_admin() returns boolean
language sql security definer stable as $$
  select coalesce((select role = 'admin' from advisors where auth_user_id = auth.uid()), false);
$$;

create or replace function px_current_client_id() returns uuid
language sql security definer stable as $$
  select id from clients where auth_user_id = auth.uid() limit 1;
$$;

-- Enable RLS everywhere
alter table firms              enable row level security;
alter table advisors           enable row level security;
alter table clients            enable row level security;
alter table profiles           enable row level security;
alter table task_states        enable row level security;
alter table flagged_questions  enable row level security;
alter table alerts             enable row level security;
alter table phase_library_firm enable row level security;
alter table phase_library_platform enable row level security;

-- ── Firms · advisors see ONLY their own firm ────────────────────────────────
create policy firms_select_own on firms
  for select using (id = px_current_firm_id());
create policy firms_update_admin on firms
  for update using (id = px_current_firm_id() and px_is_firm_admin());

-- ── Advisors · members see firm roster; only self can update self ───────────
create policy advisors_select_firm on advisors
  for select using (firm_id = px_current_firm_id());
create policy advisors_update_self on advisors
  for update using (auth_user_id = auth.uid());
create policy advisors_insert_admin on advisors
  for insert with check (firm_id = px_current_firm_id() and px_is_firm_admin());

-- ── Clients · advisor sees own book; firm admin sees all in firm;
--             client sees themselves only
create policy clients_select_advisor on clients
  for select using (advisor_id = px_current_advisor_id());
create policy clients_select_firm_admin on clients
  for select using (firm_id = px_current_firm_id() and px_is_firm_admin());
create policy clients_select_self on clients
  for select using (auth_user_id = auth.uid());
create policy clients_modify_advisor on clients
  for all using (advisor_id = px_current_advisor_id())
        with check (advisor_id = px_current_advisor_id());

-- ── Profiles · client reads/writes own; their advisor reads/writes too ─────
create policy profiles_select_client on profiles
  for select using (
    client_id = px_current_client_id()
    or exists (select 1 from clients c where c.id = profiles.client_id and c.advisor_id = px_current_advisor_id())
  );
create policy profiles_update_client on profiles
  for update using (
    client_id = px_current_client_id()
    or exists (select 1 from clients c where c.id = profiles.client_id and c.advisor_id = px_current_advisor_id())
  );
create policy profiles_insert_client on profiles
  for insert with check (
    client_id = px_current_client_id()
    or exists (select 1 from clients c where c.id = profiles.client_id and c.advisor_id = px_current_advisor_id())
  );

-- ── Task states · same pattern as profiles
create policy tasks_select_pair on task_states
  for select using (
    client_id = px_current_client_id()
    or exists (select 1 from clients c where c.id = task_states.client_id and c.advisor_id = px_current_advisor_id())
  );
create policy tasks_write_pair on task_states
  for all using (
    client_id = px_current_client_id()
    or exists (select 1 from clients c where c.id = task_states.client_id and c.advisor_id = px_current_advisor_id())
  ) with check (
    client_id = px_current_client_id()
    or exists (select 1 from clients c where c.id = task_states.client_id and c.advisor_id = px_current_advisor_id())
  );

-- ── Flagged questions · client may create; advisor may read/resolve
create policy flagged_select_advisor on flagged_questions
  for select using (advisor_id = px_current_advisor_id());
create policy flagged_select_client on flagged_questions
  for select using (client_id = px_current_client_id());
create policy flagged_insert_client on flagged_questions
  for insert with check (client_id = px_current_client_id());
create policy flagged_update_advisor on flagged_questions
  for update using (advisor_id = px_current_advisor_id());

-- ── Alerts · advisor-only
create policy alerts_select_advisor on alerts
  for select using (advisor_id = px_current_advisor_id());
create policy alerts_write_advisor on alerts
  for all using (advisor_id = px_current_advisor_id())
        with check (advisor_id = px_current_advisor_id());

-- ── Phase library · platform is READABLE to all authed; firm overrides
--    visible to that firm only, writable by firm admin
create policy phaselib_platform_read on phase_library_platform
  for select using (true);
create policy phaselib_firm_read on phase_library_firm
  for select using (firm_id = px_current_firm_id());
create policy phaselib_firm_write on phase_library_firm
  for all using (firm_id = px_current_firm_id() and px_is_firm_admin())
        with check (firm_id = px_current_firm_id() and px_is_firm_admin());

-- ════════════════════════════════════════════════════════════════════════════
-- HELPER VIEW · resolved phase library (firm override falls back to platform)
-- ════════════════════════════════════════════════════════════════════════════
create or replace view phase_library_resolved as
  select
    p.phase_id,
    coalesce(f.num,             p.num)            as num,
    coalesce(f.title,           p.title)          as title,
    coalesce(f.tag,             p.tag)            as tag,
    coalesce(f.description,     p.description)    as description,
    coalesce(f.rationale_html,  p.rationale_html) as rationale_html,
                                p.icon            as icon,
    coalesce(f.metric_label,    p.metric_label)   as metric_label,
                                p.metric_key      as metric_key,
                                p.calc            as calc,
    coalesce(f.tasks,           p.tasks)          as tasks,
    px_current_firm_id()                          as firm_id
  from phase_library_platform p
  left join phase_library_firm f
    on f.phase_id = p.phase_id and f.firm_id = px_current_firm_id();

-- ════════════════════════════════════════════════════════════════════════════
-- TRIGGER · auto-create profile + task_state shell when a client is added
-- ════════════════════════════════════════════════════════════════════════════
create or replace function px_seed_client() returns trigger language plpgsql as $$
begin
  insert into profiles (client_id, data) values (new.id, '{}'::jsonb)
    on conflict (client_id) do nothing;
  return new;
end $$;

drop trigger if exists trg_px_seed_client on clients;
create trigger trg_px_seed_client after insert on clients
  for each row execute function px_seed_client();
