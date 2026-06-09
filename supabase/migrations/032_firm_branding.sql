-- ════════════════════════════════════════════════════════════════════════════
-- PRISM · Migration 032 — White-label firm branding (Tier A)
--
-- The firms table has carried brand_color / logo_url / slug since 001, but
-- nothing could write them (firms had only a SELECT policy) and nothing could
-- read them pre-auth for subdomain → brand resolution. This closes both gaps:
--   1. show_powered_by — optional "powered by Prism" attribution toggle.
--   2. firms_update_admin — a firm admin may update their OWN firm row
--      (branding, disclosure). id is immutable via with check (same firm).
--   3. px_brand_for_slug(slug) — SECURITY DEFINER lookup of the public brand
--      surface (name, colors, logo, attribution) by subdomain slug, executable
--      by anon so {slug}.prismaw.com can paint the firm's brand before sign-in.
--      Exposes ONLY public-by-nature branding columns, never plan/seat data.
-- Idempotent. Run after 031.
-- ════════════════════════════════════════════════════════════════════════════

alter table firms add column if not exists show_powered_by boolean not null default true;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'firms' and policyname = 'firms_update_admin') then
    create policy firms_update_admin on firms for update
      using      (id = px_current_firm_id() and px_is_firm_admin())
      with check (id = px_current_firm_id() and px_is_firm_admin());
  end if;
end $$;

create or replace function px_brand_for_slug(p_slug text)
returns table (name text, slug text, brand_color text, logo_url text, show_powered_by boolean)
language sql stable security definer set search_path = public as $$
  select f.name, f.slug, f.brand_color, f.logo_url, f.show_powered_by
  from firms f
  where f.slug = lower(trim(p_slug))
  limit 1;
$$;

revoke all on function px_brand_for_slug(text) from public;
grant execute on function px_brand_for_slug(text) to anon, authenticated;
