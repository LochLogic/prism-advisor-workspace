// Prism Edge Function: platform-admin
// Founder-only platform tier — a level ABOVE firm admin. The caller's auth uid
// is checked against the px_platform_owners allowlist (migration 035); every
// data action then runs on the SERVICE ROLE so no user-scoped RLS policy had
// to change. Safe shape per the 2026-06-10 founder ask.
//
// Body: { action: 'whoami' | 'overview' | 'firm_detail' | 'provision_firm'
//                | 'suspend_firm' | 'reactivate_firm' | 'set_plan', ...payload }
// verify_jwt = true in config.toml — the platform JWT gate stays on, and the
// allowlist check is the real authorization.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const PLANS = ["starter", "growth", "enterprise"];

function admin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

// Find an existing auth user by email (provisioning for someone who already
// signed up). Page through — platform scale is tens of firms, not thousands.
async function findUserByEmail(svc: ReturnType<typeof admin>, email: string) {
  const needle = email.trim().toLowerCase();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) return null;
    const hit = data.users.find((u) => (u.email || "").toLowerCase() === needle);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "firm";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return json({ error: "Not authenticated" }, 401);

    const svc = admin();
    // Allowlist check. If the table doesn't exist yet (migration 035 not
    // applied), treat everyone as not-an-owner rather than erroring.
    let owner = false;
    try {
      const { data } = await svc.from("px_platform_owners")
        .select("auth_user_id").eq("auth_user_id", user.id).maybeSingle();
      owner = !!data;
    } catch { owner = false; }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "whoami") return json({ owner });
    if (!owner) return json({ error: "Not authorized" }, 403);

    const audit = async (a: string, summary: string, metadata: Record<string, unknown> = {}) => {
      try {
        await svc.from("audit_log").insert({
          actor_id: user.id, actor_role: "platform_owner", actor_email: user.email ?? null,
          action: a, entity_type: "platform", summary, metadata,
        });
      } catch (e) { console.warn("platform-admin audit failed:", (e as Error).message); }
    };

    if (action === "overview") {
      const [{ data: firms, error: fe }, { data: advisors }, { data: clients }, { data: subs }] = await Promise.all([
        svc.from("firms").select("id, name, slug, plan, seats_purchased, status, created_at").order("created_at"),
        svc.from("advisors").select("id, firm_id, active"),
        svc.from("clients").select("id, firm_id, active"),
        svc.from("subscriptions").select("firm_id, plan, status, current_period_end"),
      ]);
      if (fe) throw fe;
      const subByFirm = Object.fromEntries((subs || []).map((s) => [s.firm_id, s]));
      const rows = (firms || []).map((f) => ({
        ...f,
        advisor_count: (advisors || []).filter((a) => a.firm_id === f.id && a.active !== false).length,
        client_count: (clients || []).filter((c) => c.firm_id === f.id && c.active !== false).length,
        subscription: subByFirm[f.id] || null,
      }));
      return json({ firms: rows });
    }

    if (action === "firm_detail") {
      const firmId = String(body.firm_id || "");
      const { data: advisors, error } = await svc.from("advisors")
        .select("id, full_name, email, role, active, created_at")
        .eq("firm_id", firmId).order("created_at");
      if (error) throw error;
      return json({ advisors: advisors || [] });
    }

    if (action === "provision_firm") {
      const name = String(body.name || "").trim();
      const ownerEmail = String(body.owner_email || "").trim().toLowerCase();
      const ownerName = String(body.owner_name || "").trim() || ownerEmail;
      const plan = PLANS.includes(body.plan) ? body.plan : "starter";
      if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ownerEmail)) {
        return json({ error: "Firm name and a valid owner email are required" }, 400);
      }
      // Resolve or invite the firm admin's auth user first — if their email is
      // already an advisor somewhere, refuse rather than double-seat them.
      let authUser = await findUserByEmail(svc, ownerEmail);
      if (authUser) {
        const { data: existing } = await svc.from("advisors")
          .select("id, firm_id").eq("auth_user_id", authUser.id).maybeSingle();
        if (existing) return json({ error: "That email already holds an advisor seat at another firm" }, 409);
      } else {
        const { data, error } = await svc.auth.admin.inviteUserByEmail(ownerEmail,
          { data: { full_name: ownerName, firm_name: name } });
        if (error || !data?.user) return json({ error: `Invite failed: ${error?.message || "unknown"}` }, 502);
        authUser = data.user;
      }
      // Unique slug: name-derived, numbered on collision.
      const base = slugify(name);
      let slug = base;
      for (let i = 2; i < 50; i++) {
        const { data: taken } = await svc.from("firms").select("id").eq("slug", slug).maybeSingle();
        if (!taken) break;
        slug = `${base}-${i}`;
      }
      const { data: firm, error: fe } = await svc.from("firms")
        .insert({ name, slug, plan, seats_purchased: 1 }).select().single();
      if (fe) throw fe;
      const { error: ae } = await svc.from("advisors").insert({
        auth_user_id: authUser.id, firm_id: firm.id, full_name: ownerName, email: ownerEmail, role: "admin",
      });
      if (ae) throw ae;
      await audit("platform.provision_firm", `Provisioned firm "${name}" (${plan}) for ${ownerEmail}`, { firm_id: firm.id });
      return json({ firm, invited: !authUser.last_sign_in_at });
    }

    if (action === "suspend_firm" || action === "reactivate_firm") {
      const firmId = String(body.firm_id || "");
      const status = action === "suspend_firm" ? "suspended" : "active";
      const { data, error } = await svc.from("firms")
        .update({ status }).eq("id", firmId).select("id, name, status").single();
      if (error) throw error;
      await audit(`platform.${action}`, `${status === "suspended" ? "Suspended" : "Reactivated"} firm "${data.name}"`, { firm_id: firmId });
      return json({ firm: data });
    }

    if (action === "set_plan") {
      const firmId = String(body.firm_id || "");
      const plan = String(body.plan || "");
      const seats = Math.max(1, Math.min(500, Number(body.seats) || 1));
      if (!PLANS.includes(plan)) return json({ error: "Unknown plan" }, 400);
      const { data, error } = await svc.from("firms")
        .update({ plan, seats_purchased: seats }).eq("id", firmId)
        .select("id, name, plan, seats_purchased").single();
      if (error) throw error;
      await audit("platform.set_plan", `Billing override: "${data.name}" → ${plan} · ${seats} seat${seats === 1 ? "" : "s"}`, { firm_id: firmId });
      return json({ firm: data });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
