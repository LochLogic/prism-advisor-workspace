// Prism Edge Function: webhooks
// Firm management of outbound webhook endpoints (migration 048) PLUS the
// browser-triggered `emit` used to fire client-originated events (e.g. an
// advisor approving an invoice). The server-side events (acknowledgement
// signed, API-created client/task) call the shared dispatcher directly.
//
// SECURITY MODEL (mirrors api-keys):
//   · webhooks has NO RLS policies - only this function's service role touches
//     it. CRUD (list/create/delete) requires an *admin*-role advisor; `emit` is
//     allowed for any advisor in the firm (it can only fire that firm's own
//     configured endpoints). Every query is scoped to the caller's firm_id.
//   · The signing secret is returned once by `create`, masked in `list`.
//   · create + delete are audit-logged. verify_jwt = true (config.toml).
//
// Body: { action: 'list' | 'create' | 'delete' | 'emit',
//         url?, events?, id?, event?, data? }

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { WEBHOOK_EVENTS, WebhookEvent, generateSecret, emitWebhooks } from "../_shared/webhooks.ts";

function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const notConfigured = (e: unknown) =>
  /webhooks|relation .* does not exist/i.test((e as Error)?.message || "")
    ? json({ error: "not_configured" }) : json({ error: (e as Error).message }, 500);

// Mask a stored secret for display: prefix + last 4 ("whsec_…aB3x").
const maskSecret = (s: string) => (s && s.length > 10 ? `${s.slice(0, 7)}…${s.slice(-4)}` : "whsec_…");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return json({ error: "Not authenticated" }, 401);

    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: advisor } = await svc.from("advisors")
      .select("id, firm_id, role").eq("auth_user_id", user.id).maybeSingle();
    if (!advisor) return json({ error: "Not authorized" }, 403);
    const firmId = advisor.firm_id;
    const isAdmin = advisor.role === "admin";

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    const audit = async (a: string, summary: string, metadata: Record<string, unknown> = {}) => {
      try {
        await svc.from("audit_log").insert({
          actor_id: user.id, actor_role: advisor.role || "advisor", actor_email: user.email ?? null,
          action: a, entity_type: "webhook", summary, metadata: { firm_id: firmId, ...metadata },
        });
      } catch (e) { console.warn("webhooks audit failed:", (e as Error).message); }
    };

    // ── emit: any advisor in the firm fires a known event to their endpoints ──
    if (action === "emit") {
      const event = String(body.event || "");
      if (!(WEBHOOK_EVENTS as readonly string[]).includes(event)) return json({ error: "Unknown event" }, 400);
      // Cap the client-supplied payload so a browser can't push something huge.
      let data: unknown = body.data ?? {};
      try { if (JSON.stringify(data).length > 16000) data = { truncated: true }; } catch { data = {}; }
      const delivered = await emitWebhooks(svc, firmId, event as WebhookEvent, data);
      return json({ delivered });
    }

    // ── CRUD: firm-admin only ─────────────────────────────────────────────────
    if (action === "list") {
      if (!isAdmin) return json({ error: "Only a firm admin can manage webhooks" }, 403);
      try {
        const { data, error } = await svc.from("webhooks")
          .select("id, url, events, active, last_status, last_event_at, secret, created_at")
          .eq("firm_id", firmId).order("created_at", { ascending: false });
        if (error) throw error;
        const rows = (data || []).map((w) => ({ ...w, secret: maskSecret(w.secret) }));
        return json({ webhooks: rows, events: WEBHOOK_EVENTS });
      } catch (e) { return notConfigured(e); }
    }

    if (action === "create") {
      if (!isAdmin) return json({ error: "Only a firm admin can manage webhooks" }, 403);
      const url = String(body.url || "").trim();
      if (!/^https?:\/\/.+/i.test(url) || url.length > 500) return json({ error: "Enter a valid https URL for the endpoint" }, 400);
      const events = Array.isArray(body.events)
        ? [...new Set(body.events.map(String).filter((e: string) => (WEBHOOK_EVENTS as readonly string[]).includes(e)))]
        : [];
      if (!events.length) return json({ error: "Pick at least one event to send" }, 400);
      try {
        const { count } = await svc.from("webhooks")
          .select("id", { count: "exact", head: true }).eq("firm_id", firmId).eq("active", true);
        if ((count || 0) >= 20) return json({ error: "Endpoint limit reached (20). Remove one first." }, 409);

        const secret = generateSecret();
        const { data, error } = await svc.from("webhooks").insert({
          firm_id: firmId, created_by: advisor.id, url, secret, events, active: true,
        }).select("id, url, events, active, last_status, last_event_at, created_at").single();
        if (error) throw error;
        await audit("webhook.create", `Registered webhook ${url}`, { webhook_id: data.id, events });
        // The full secret travels back ONCE so the receiver can verify signatures.
        return json({ secret, row: data });
      } catch (e) { return notConfigured(e); }
    }

    if (action === "delete") {
      if (!isAdmin) return json({ error: "Only a firm admin can manage webhooks" }, 403);
      const id = String(body.id || "");
      if (!id) return json({ error: "id required" }, 400);
      try {
        const { data, error } = await svc.from("webhooks")
          .delete().eq("id", id).eq("firm_id", firmId).select("id, url").maybeSingle();
        if (error) throw error;
        if (!data) return json({ error: "Endpoint not found" }, 404);
        await audit("webhook.delete", `Removed webhook ${data.url}`, { webhook_id: data.id });
        return json({ ok: true });
      } catch (e) { return notConfigured(e); }
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
