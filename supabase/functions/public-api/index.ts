// Prism Edge Function: public-api
// The firm-scoped public REST API behind Zapier / Make / n8n / custom integrations
// (migration 046). Authenticated by an API key a firm admin minted via `api-keys`,
// NOT by a Supabase user JWT - so config.toml sets verify_jwt = false and this
// function self-enforces auth (the stripe-webhook / worm-export pattern).
//
// SECURITY MODEL (read before touching):
//   · The presented key is SHA-256 hashed and looked up in api_keys (service role).
//     A missing/revoked key → 401. The matched row's firm_id scopes EVERY query; a key
//     can only ever see and write its own firm's data. There is no cross-firm path.
//   · 'read' scope gates the GET triggers, 'write' scope the POST actions.
//   · Writes are audit-logged (api.client.create / api.task.create). Reads are not
//     (high-volume polling; the data is masked-free but firm-scoped).
//
// Routes (under /functions/v1/public-api):
//   GET  /ping                      → connection test (Zapier "Test")
//   GET  /clients   ?since=&limit=  → households, newest first
//   GET  /meetings  ?since=&limit=  → logged/scheduled meetings, newest first
//   GET  /tasks     ?since=&limit=  → CRM tasks, newest first
//   POST /clients   { household_name, short_name?, household_tag?, current_phase? }
//   POST /tasks     { title, detail?, priority?, due_at?, client_id? }

import { createClient } from "npm:@supabase/supabase-js@2";
import { sha256Hex, readPresentedKey } from "../_shared/apikey.ts";

// Public API → permissive CORS (bearer/key auth, no cookies). Distinct from the
// browser-locked _shared/cors.ts on purpose: callers are external servers, not prismaw.com.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
}

function svc() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

// limit: default 25, clamp 1..100. since: a valid ISO timestamp or null.
function readQuery(url: URL) {
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit")) || 25));
  const sinceRaw = url.searchParams.get("since");
  const since = sinceRaw && !Number.isNaN(Date.parse(sinceRaw)) ? new Date(sinceRaw).toISOString() : null;
  return { limit, since };
}

const clientOut = (c: Record<string, unknown>) => ({
  id: c.id, household_name: c.household_name, short_name: c.short_name,
  tag: c.household_tag || null, phase: c.current_phase ?? 0, aum: Number(c.aum) || 0,
  created_at: c.created_at, updated_at: c.updated_at,
});
const meetingOut = (m: Record<string, unknown>) => ({
  id: m.id, client_id: m.client_id, met_at: m.met_at, duration_min: m.duration_min ?? null,
  status: m.status || "logged", notes: m.notes || null, created_at: m.created_at,
});
const taskOut = (t: Record<string, unknown>) => ({
  id: t.id, client_id: t.client_id || null, title: t.title, detail: t.detail || null,
  priority: t.priority || "normal", status: t.status || "open", due_at: t.due_at || null,
  created_at: t.created_at,
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const db = svc();
    const url = new URL(req.url);
    // Path after the function name: "/public-api/clients" → "/clients".
    const sub = (url.pathname.split("/public-api")[1] || "/").replace(/\/+$/, "") || "/";
    const resource = sub.split("/").filter(Boolean)[0] || "";

    // ── Authenticate the API key ────────────────────────────────────────────
    const presented = readPresentedKey(req);
    if (!presented) {
      return json({ error: "Missing API key. Send 'Authorization: Bearer <key>' or 'X-Api-Key: <key>'." }, 401);
    }
    let keyRow: { id: string; firm_id: string; created_by: string | null; scopes: string[] } | null = null;
    try {
      const hash = await sha256Hex(presented);
      const { data, error } = await db.from("api_keys")
        .select("id, firm_id, created_by, scopes").eq("key_hash", hash).is("revoked_at", null).maybeSingle();
      if (error) throw error;
      keyRow = data;
    } catch (e) {
      if (/api_keys|does not exist/i.test((e as Error).message)) return json({ error: "not_configured" }, 503);
      throw e;
    }
    if (!keyRow) return json({ error: "Invalid or revoked API key" }, 401);
    const firmId = keyRow.firm_id;
    const scopes: string[] = keyRow.scopes || [];
    const canWrite = scopes.includes("write");
    // Touch last_used_at (best-effort; never blocks the response on failure).
    db.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id)
      .then(() => {}, () => {});

    if (resource === "" || resource === "ping") {
      const { data: firm } = await db.from("firms").select("name").eq("id", firmId).maybeSingle();
      return json({ ok: true, firm: firm?.name || null, scopes });
    }

    const audit = async (action: string, summary: string, clientId: string | null, metadata: Record<string, unknown> = {}) => {
      try {
        await db.from("audit_log").insert({
          actor_id: null, actor_role: "api", actor_email: null,
          action, entity_type: action.startsWith("api.client") ? "client" : "task",
          client_id: clientId, summary, metadata: { firm_id: firmId, api_key_id: keyRow!.id, ...metadata },
        });
      } catch (e) { console.warn("public-api audit failed:", (e as Error).message); }
    };

    // The advisor that API-created rows are owned by: the key's creator if still
    // active, else the firm's first active admin, else any active advisor.
    const ownerAdvisor = async (): Promise<string | null> => {
      if (keyRow!.created_by) {
        const { data } = await db.from("advisors").select("id").eq("id", keyRow!.created_by).eq("active", true).maybeSingle();
        if (data) return data.id;
      }
      const { data } = await db.from("advisors").select("id, role")
        .eq("firm_id", firmId).eq("active", true).order("role", { ascending: true }).limit(1);
      return data?.[0]?.id || null;
    };

    // ── GET triggers (read scope) ───────────────────────────────────────────
    if (req.method === "GET") {
      if (!scopes.includes("read")) return json({ error: "This key lacks 'read' scope" }, 403);
      const { limit, since } = readQuery(url);

      if (resource === "clients") {
        let q = db.from("clients")
          .select("id, household_name, short_name, household_tag, current_phase, aum, created_at, updated_at")
          .eq("firm_id", firmId).eq("active", true)
          .order("created_at", { ascending: false }).limit(limit);
        if (since) q = q.gte("created_at", since);
        const { data, error } = await q;
        if (error) throw error;
        return json({ clients: (data || []).map(clientOut) });
      }

      if (resource === "tasks") {
        let q = db.from("crm_tasks")
          .select("id, client_id, title, detail, priority, status, due_at, created_at")
          .eq("firm_id", firmId)
          .order("created_at", { ascending: false }).limit(limit);
        if (since) q = q.gte("created_at", since);
        const { data, error } = await q;
        if (error) throw error;
        return json({ tasks: (data || []).map(taskOut) });
      }

      if (resource === "meetings") {
        // meetings has no firm_id - scope through the firm's clients.
        const { data: cids } = await db.from("clients").select("id").eq("firm_id", firmId);
        const ids = (cids || []).map((c) => c.id);
        if (!ids.length) return json({ meetings: [] });
        let q = db.from("meetings")
          .select("id, client_id, met_at, duration_min, status, notes, created_at")
          .in("client_id", ids).is("archived_at", null)
          .order("met_at", { ascending: false }).limit(limit);
        if (since) q = q.gte("met_at", since);
        const { data, error } = await q;
        if (error) throw error;
        return json({ meetings: (data || []).map(meetingOut) });
      }

      return json({ error: `Unknown resource: ${resource}` }, 404);
    }

    // ── POST actions (write scope) ──────────────────────────────────────────
    if (req.method === "POST") {
      if (!canWrite) return json({ error: "This key lacks 'write' scope" }, 403);
      const body = await req.json().catch(() => ({}));

      if (resource === "clients") {
        const householdName = String(body.household_name || "").trim();
        if (!householdName) return json({ error: "household_name is required" }, 400);
        const advisorId = await ownerAdvisor();
        if (!advisorId) return json({ error: "No active advisor in this firm to own the client" }, 409);
        const phase = Math.max(0, Math.min(6, Number(body.current_phase) || 0));
        const { data, error } = await db.from("clients").insert({
          firm_id: firmId, advisor_id: advisorId,
          household_name: householdName,
          short_name: String(body.short_name || householdName).slice(0, 120),
          household_tag: String(body.household_tag || "").slice(0, 60),
          current_phase: phase, active: true,
        }).select("id, household_name, short_name, household_tag, current_phase, aum, created_at, updated_at").single();
        if (error) throw error;
        await audit("api.client.create", `API created client ${data.household_name}`, data.id);
        return json({ client: clientOut(data) }, 201);
      }

      if (resource === "tasks") {
        const title = String(body.title || "").trim();
        if (!title) return json({ error: "title is required" }, 400);
        const advisorId = await ownerAdvisor();
        if (!advisorId) return json({ error: "No active advisor in this firm to own the task" }, 409);
        // A supplied client_id must belong to this firm - never trust it blindly.
        let clientId: string | null = null;
        if (body.client_id) {
          const { data: c } = await db.from("clients").select("id").eq("id", String(body.client_id)).eq("firm_id", firmId).maybeSingle();
          if (!c) return json({ error: "client_id not found in this firm" }, 400);
          clientId = c.id;
        }
        const priority = ["low", "normal", "high"].includes(String(body.priority)) ? String(body.priority) : "normal";
        const dueAt = body.due_at && !Number.isNaN(Date.parse(String(body.due_at))) ? new Date(String(body.due_at)).toISOString() : null;
        const { data, error } = await db.from("crm_tasks").insert({
          firm_id: firmId, advisor_id: advisorId, assigned_to: advisorId, client_id: clientId,
          title: title.slice(0, 200), detail: body.detail ? String(body.detail).slice(0, 2000) : null,
          priority, due_at: dueAt, status: "open",
        }).select("id, client_id, title, detail, priority, status, due_at, created_at").single();
        if (error) throw error;
        await audit("api.task.create", `API created task: ${data.title}`, clientId);
        return json({ task: taskOut(data) }, 201);
      }

      return json({ error: `Unknown resource: ${resource}` }, 404);
    }

    return json({ error: `Method ${req.method} not allowed` }, 405);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
