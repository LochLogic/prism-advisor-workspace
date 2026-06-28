// Prism Edge Function: platform-admin
// Founder-only platform tier — a level ABOVE firm admin. The caller's auth uid
// is checked against the px_platform_owners allowlist (migration 035); every
// data action then runs on the SERVICE ROLE so no user-scoped RLS policy had
// to change. Safe shape per the 2026-06-10 founder ask.
//
// Body: { action: 'whoami' | 'overview' | 'funnel' | 'firm_detail' | 'firm_clients'
//                | 'provision_firm' | 'suspend_firm' | 'reactivate_firm'
//                | 'set_advisor_role' | 'reset_mfa' | 'set_plan'
//                | 'set_subscription', ...payload }
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
      // Platform-level usage stats from px_events (migration 041). Tolerant of
      // the table not existing yet — usage simply stays null until it lands.
      // 30-day window; the roster cap is generous at platform scale (tens of
      // firms · 7 instrumented event types).
      const usageByFirm: Record<string, { events_30d: number; last_event_at: string | null }> = {};
      try {
        const since = new Date(Date.now() - 30 * 86400000).toISOString();
        const { data: ev, error: ee } = await svc.from("px_events")
          .select("firm_id, occurred_at").gte("occurred_at", since)
          .order("occurred_at", { ascending: false }).limit(50000);
        if (!ee) for (const e of ev || []) {
          if (!e.firm_id) continue;
          const u = usageByFirm[e.firm_id] || (usageByFirm[e.firm_id] = { events_30d: 0, last_event_at: e.occurred_at });
          u.events_30d++;
        }
      } catch { /* px_events not applied yet */ }
      // Last login per firm: most recent 'login' px_event, no time window (a firm
      // idle for months should still show when it was last seen, not "quiet").
      const lastLoginByFirm: Record<string, string> = {};
      try {
        const { data: lg, error: le } = await svc.from("px_events")
          .select("firm_id, occurred_at").eq("name", "login")
          .order("occurred_at", { ascending: false }).limit(20000);
        if (!le) for (const e of lg || []) {
          if (e.firm_id && !lastLoginByFirm[e.firm_id]) lastLoginByFirm[e.firm_id] = e.occurred_at;
        }
      } catch { /* px_events not applied yet */ }
      const subByFirm = Object.fromEntries((subs || []).map((s) => [s.firm_id, s]));
      const rows = (firms || []).map((f) => ({
        ...f,
        advisor_count: (advisors || []).filter((a) => a.firm_id === f.id && a.active !== false).length,
        client_count: (clients || []).filter((c) => c.firm_id === f.id && c.active !== false).length,
        subscription: subByFirm[f.id] || null,
        usage: usageByFirm[f.id] || null,
        last_login_at: lastLoginByFirm[f.id] || null,
      }));
      return json({ firms: rows });
    }

    // Cross-firm activation funnel + retention over 30 days, from px_events
    // (migration 041). Tolerant of the table not existing → funnel: null.
    if (action === "funnel") {
      const now = Date.now();
      const since30 = new Date(now - 30 * 86400000).toISOString();
      const since7 = now - 7 * 86400000;
      let ev: Array<{ name: string; occurred_at: string; client_id: string | null }> = [];
      try {
        const { data, error } = await svc.from("px_events")
          .select("name, occurred_at, client_id").gte("occurred_at", since30).limit(100000);
        if (error) throw error;
        ev = data || [];
      } catch { return json({ funnel: null }); }
      const counts: Record<string, number> = {};
      const portal7 = new Set<string>(), portal30 = new Set<string>();
      for (const e of ev) {
        counts[e.name] = (counts[e.name] || 0) + 1;
        if (e.name === "portal_opened" && e.client_id) {
          portal30.add(e.client_id);
          if (new Date(e.occurred_at).getTime() >= since7) portal7.add(e.client_id);
        }
      }
      return json({ funnel: {
        window_days: 30, total: ev.length, counts,
        portal_clients_7d: portal7.size, portal_clients_30d: portal30.size,
      } });
    }

    if (action === "firm_detail") {
      const firmId = String(body.firm_id || "");
      const { data: advisors, error } = await svc.from("advisors")
        .select("id, full_name, email, role, active, created_at")
        .eq("firm_id", firmId).order("created_at");
      if (error) throw error;
      return json({ advisors: advisors || [] });
    }

    // Read-only client roster for one firm — household name, phase, advisor,
    // activity. Deliberately NO financial data (no balances, no profile): the
    // founder can see WHO a firm serves and HOW recently, not their numbers.
    if (action === "firm_clients") {
      const firmId = String(body.firm_id || "");
      const { data: clients, error } = await svc.from("clients")
        .select("id, household_name, short_name, current_phase, active, advisor_id, created_at, last_meeting_at")
        .eq("firm_id", firmId).order("created_at");
      if (error) throw error;
      const { data: advs } = await svc.from("advisors").select("id, full_name").eq("firm_id", firmId);
      const nameById = Object.fromEntries((advs || []).map((a) => [a.id, a.full_name]));
      const rows = (clients || []).map((c) => ({
        id: c.id,
        name: c.short_name || c.household_name || "Client",
        phase: c.current_phase ?? null,
        active: c.active !== false,
        advisor: nameById[c.advisor_id] || null,
        created_at: c.created_at,
        last_meeting_at: c.last_meeting_at || null,
      }));
      return json({ clients: rows });
    }

    // Recovery path for a locked-out advisor: a verified TOTP factor forces the
    // account to aal2, so losing the authenticator is a hard lockout. Deleting
    // the factor on the service role lets them sign in with their password again
    // and re-enroll. The genuine "recovery" half of advisor MFA.
    if (action === "reset_mfa") {
      const advisorId = String(body.advisor_id || "");
      const { data: adv, error } = await svc.from("advisors")
        .select("id, full_name, email, auth_user_id, firm_id").eq("id", advisorId).maybeSingle();
      if (error) throw error;
      if (!adv?.auth_user_id) return json({ error: "That advisor has no linked login" }, 404);
      let removed = 0;
      try {
        // getUserById returns the user with its `factors` array (more portable
        // across SDK versions than admin.mfa.listFactors); delete each.
        const { data: u, error: ue } = await svc.auth.admin.getUserById(adv.auth_user_id);
        if (ue) throw ue;
        const factors = (u?.user as { factors?: Array<{ id: string }> })?.factors || [];
        for (const fac of factors) {
          await svc.auth.admin.mfa.deleteFactor({ id: fac.id, userId: adv.auth_user_id });
          removed++;
        }
      } catch (e) {
        return json({ error: `Could not reset two-factor: ${(e as Error).message}` }, 502);
      }
      await audit("platform.reset_mfa",
        `Reset two-factor for ${adv.email} (${removed} factor${removed === 1 ? "" : "s"} removed)`,
        { advisor_id: advisorId, firm_id: adv.firm_id });
      return json({ removed, advisor: { id: adv.id, full_name: adv.full_name, email: adv.email } });
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

    // Promote/demote an advisor seat (admin ⇄ advisor) — e.g. granting a firm
    // its first admin, or the founder upgrading their own early-test seat.
    if (action === "set_advisor_role") {
      const advisorId = String(body.advisor_id || "");
      const role = body.role === "admin" ? "admin" : "advisor";
      const { data, error } = await svc.from("advisors")
        .update({ role }).eq("id", advisorId)
        .select("id, full_name, email, role, firm_id").single();
      if (error) throw error;
      await audit("platform.set_advisor_role", `Set ${data.email} → ${role}`, { advisor_id: advisorId, firm_id: data.firm_id });
      return json({ advisor: data });
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

    // Manual subscription override — comp a design partner to "active" without a
    // Stripe round trip, or correct a stuck status. Writes the same
    // subscriptions row the stripe-webhook owns, so a later live Stripe event
    // can supersede this; that's intended for a manual/comp override.
    if (action === "set_subscription") {
      const firmId = String(body.firm_id || "");
      const status = String(body.status || "");
      const SUB_STATUS = ["active", "trialing", "past_due", "canceled", "incomplete"];
      if (!SUB_STATUS.includes(status)) return json({ error: "Unknown subscription status" }, 400);
      const plan = PLANS.includes(body.plan) ? body.plan : null;
      const periodEnd = body.period_end ? new Date(body.period_end) : null;
      const patch: Record<string, unknown> = { firm_id: firmId, status, updated_at: new Date().toISOString() };
      if (plan) patch.plan = plan;
      if (periodEnd && !isNaN(periodEnd.getTime())) patch.current_period_end = periodEnd.toISOString();
      const { data, error } = await svc.from("subscriptions")
        .upsert(patch, { onConflict: "firm_id" })
        .select("firm_id, plan, status, current_period_end").single();
      if (error) throw error;
      await audit("platform.set_subscription",
        `Subscription override: firm ${firmId} → ${plan || "(plan unchanged)"} · ${status}`, { firm_id: firmId });
      return json({ subscription: data });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
