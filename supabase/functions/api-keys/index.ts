// Prism Edge Function: api-keys
// Firm-admin management of the firm's public API keys (migration 046). This is the
// MINT/LIST/REVOKE surface, called from the browser by a signed-in firm admin; the
// keys it issues are then used against the separate `public-api` function.
//
// SECURITY MODEL (read before touching):
//   · api_keys has NO RLS policies - only this function's service role touches it.
//     Authorization lives HERE: the caller must be an *admin*-role advisor, and every
//     query is scoped to that advisor's own firm_id. A plain advisor cannot mint keys
//     (a firm-wide data key is a firm-admin decision).
//   · The plaintext key is returned exactly once, by `create`. We persist only its
//     SHA-256 hash + a short non-secret prefix. `list` never returns the hash.
//   · create + revoke are audit-logged. verify_jwt = true (config.toml) gates in front.
//
// Body: { action: 'list' | 'create' | 'revoke', name?, scopes?, id? }

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { generateKey, KEY_SCOPES } from "../_shared/apikey.ts";

function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const notConfigured = (e: unknown) =>
  /api_keys|relation .* does not exist/i.test((e as Error)?.message || "")
    ? json({ error: "not_configured" }) : json({ error: (e as Error).message }, 500);

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

    // Caller must be an admin-role advisor; everything is scoped to their firm.
    const { data: advisor } = await svc.from("advisors")
      .select("id, firm_id, role, full_name").eq("auth_user_id", user.id).maybeSingle();
    if (!advisor) return json({ error: "Not authorized" }, 403);
    if (advisor.role !== "admin") return json({ error: "Only a firm admin can manage API keys" }, 403);
    const firmId = advisor.firm_id;

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    const audit = async (a: string, summary: string, metadata: Record<string, unknown> = {}) => {
      try {
        await svc.from("audit_log").insert({
          actor_id: user.id, actor_role: "admin", actor_email: user.email ?? null,
          action: a, entity_type: "api_key", summary, metadata: { firm_id: firmId, ...metadata },
        });
      } catch (e) { console.warn("api-keys audit failed:", (e as Error).message); }
    };

    if (action === "list") {
      try {
        const { data, error } = await svc.from("api_keys")
          .select("id, name, prefix, scopes, last_used_at, revoked_at, created_at")
          .eq("firm_id", firmId).order("created_at", { ascending: false });
        if (error) throw error;
        return json({ keys: data || [] });
      } catch (e) { return notConfigured(e); }
    }

    if (action === "create") {
      const name = String(body.name || "").trim().slice(0, 80);
      if (!name) return json({ error: "Name the key (e.g. \"Zapier\") so you can tell them apart" }, 400);
      // Scopes: keep only known values; always at least read.
      let scopes = Array.isArray(body.scopes)
        ? body.scopes.filter((s: unknown) => (KEY_SCOPES as readonly string[]).includes(String(s)))
        : ["read", "write"];
      if (!scopes.includes("read")) scopes = ["read", ...scopes];
      try {
        // Soft cap: 25 live keys per firm keeps abuse and clutter down.
        const { count } = await svc.from("api_keys")
          .select("id", { count: "exact", head: true }).eq("firm_id", firmId).is("revoked_at", null);
        if ((count || 0) >= 25) return json({ error: "Key limit reached (25 active). Revoke an unused key first." }, 409);

        const { key, prefix, hash } = await generateKey();
        const { data, error } = await svc.from("api_keys").insert({
          firm_id: firmId, created_by: advisor.id, name, prefix, key_hash: hash, scopes,
        }).select("id, name, prefix, scopes, last_used_at, revoked_at, created_at").single();
        if (error) throw error;
        await audit("api_key.create", `Created API key "${name}" (${prefix}…)`, { key_id: data.id, scopes });
        // The full key travels back to the browser ONCE - never stored, never shown again.
        return json({ key, row: data });
      } catch (e) { return notConfigured(e); }
    }

    if (action === "revoke") {
      const id = String(body.id || "");
      if (!id) return json({ error: "id required" }, 400);
      try {
        const { data, error } = await svc.from("api_keys")
          .update({ revoked_at: new Date().toISOString() })
          .eq("id", id).eq("firm_id", firmId).is("revoked_at", null)
          .select("id, name, prefix").maybeSingle();
        if (error) throw error;
        if (!data) return json({ error: "Key not found or already revoked" }, 404);
        await audit("api_key.revoke", `Revoked API key "${data.name}" (${data.prefix}…)`, { key_id: data.id });
        return json({ ok: true });
      } catch (e) { return notConfigured(e); }
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
