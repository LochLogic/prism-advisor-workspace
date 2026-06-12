// Prism Edge Function: client-identifiers
// Encrypted government-ID storage (SSN/ITIN/EIN) for household members -
// round 23, the key that unlocks custodian account-paperwork prefill.
//
// SECURITY MODEL (read before touching):
//   · The client_identifiers table (migration 044) has NO RLS policies and no
//     grants - only this function's service role touches it. Authorization
//     lives HERE: an advisor in the client's firm, or the client themself.
//   · Values are AES-256-GCM encrypted with IDENTIFIER_ENC_KEY (edge secret,
//     normalized to a 32-byte key via SHA-256). The database sees ciphertext
//     + last4 only. Without the secret the function reports `not_configured`
//     and the UI degrades to a "pending setup" hint.
//   · `reveal` (full value) is ADVISOR-ONLY and writes an audit_log entry on
//     every call - the value is for paperwork moments, not casual display.
//     `set` and `clear` are audited too. last4/list are not (masked data).
//   · verify_jwt = true in config.toml; the platform JWT gate runs in front.
//
// Body: { action: 'list' | 'set' | 'reveal' | 'clear',
//         client_id, member_id?, kind?, value? }

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const KINDS = ["ssn", "itin", "ein"];

// ── Crypto: AES-256-GCM, key derived from the secret via SHA-256 ───────────
async function getKey(): Promise<CryptoKey | null> {
  const raw = Deno.env.get("IDENTIFIER_ENC_KEY") || "";
  if (!raw) return null;
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}
const b64 = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf instanceof Uint8Array ? buf : new Uint8Array(buf))));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function encrypt(key: CryptoKey, value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value));
  return `${b64(iv)}.${b64(ct)}`;
}
async function decrypt(key: CryptoKey, packed: string): Promise<string> {
  const [ivB64, ctB64] = packed.split(".");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(ivB64) }, key, unb64(ctB64));
  return new TextDecoder().decode(pt);
}

// Light format validation - 9 digits for SSN/ITIN/EIN after stripping
// separators, and an SSN can't be all one digit or start with 000/666/9xx.
function normalizeId(kind: string, value: string): string | null {
  const digits = String(value || "").replace(/[^0-9]/g, "");
  if (digits.length !== 9) return null;
  if (kind === "ssn") {
    if (/^(\d)\1{8}$/.test(digits)) return null;
    const area = digits.slice(0, 3);
    if (area === "000" || area === "666" || area[0] === "9") return null;
    if (digits.slice(3, 5) === "00" || digits.slice(5) === "0000") return null;
  }
  return digits;
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

    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const clientId = String(body.client_id || "");
    const memberId = String(body.member_id || "primary");
    const kind = KINDS.includes(body.kind) ? body.kind : "ssn";
    if (!clientId) return json({ error: "client_id required" }, 400);

    // ── Caller resolution + tenancy ─────────────────────────────────────
    const { data: client } = await svc.from("clients")
      .select("id, firm_id, auth_user_id, household_name").eq("id", clientId).maybeSingle();
    if (!client) return json({ error: "Unknown client" }, 404);

    const { data: advisorRow } = await svc.from("advisors")
      .select("id, firm_id, full_name").eq("auth_user_id", user.id).maybeSingle();
    const isAdvisor = !!advisorRow && advisorRow.firm_id === client.firm_id;
    const isSelf = client.auth_user_id === user.id;
    if (!isAdvisor && !isSelf) return json({ error: "Not authorized" }, 403);

    const audit = async (a: string, summary: string, metadata: Record<string, unknown> = {}) => {
      try {
        await svc.from("audit_log").insert({
          actor_id: user.id, actor_role: isAdvisor ? "advisor" : "client", actor_email: user.email ?? null,
          action: a, entity_type: "client_identifier", entity_id: `${clientId}:${memberId}:${kind}`,
          client_id: clientId, summary, metadata,
        });
      } catch (e) { console.warn("client-identifiers audit failed:", (e as Error).message); }
    };

    // Missing table (migration 044 not applied) surfaces as not_configured so
    // the UI shows "pending setup" instead of an error toast.
    const notConfigured = (e: unknown) =>
      /client_identifiers|relation .* does not exist/i.test((e as Error)?.message || "")
        ? json({ error: "not_configured" }) : json({ error: (e as Error).message }, 500);

    if (action === "list") {
      try {
        const { data, error } = await svc.from("client_identifiers")
          .select("member_id, kind, last4, updated_at").eq("client_id", clientId);
        if (error) throw error;
        return json({ identifiers: data || [] });
      } catch (e) { return notConfigured(e); }
    }

    if (action === "set") {
      const key = await getKey();
      if (!key) return json({ error: "not_configured" });
      const normalized = normalizeId(kind, String(body.value || ""));
      if (!normalized) return json({ error: `That does not look like a valid ${kind.toUpperCase()} - check the digits and try again.` }, 400);
      try {
        const row = {
          client_id: clientId, firm_id: client.firm_id, member_id: memberId, kind,
          last4: normalized.slice(-4), ciphertext: await encrypt(key, normalized),
          updated_by: user.id, updated_at: new Date().toISOString(),
        };
        const { error } = await svc.from("client_identifiers")
          .upsert(row, { onConflict: "client_id,member_id,kind" });
        if (error) throw error;
        await audit("identifier.set", `${kind.toUpperCase()} stored for ${client.household_name || "client"} (member ${memberId}) - ending ${row.last4}`);
        return json({ ok: true, last4: row.last4 });
      } catch (e) { return notConfigured(e); }
    }

    if (action === "reveal") {
      if (!isAdvisor) return json({ error: "Reveal is advisor-only" }, 403);
      const key = await getKey();
      if (!key) return json({ error: "not_configured" });
      try {
        const { data, error } = await svc.from("client_identifiers")
          .select("ciphertext, last4").eq("client_id", clientId)
          .eq("member_id", memberId).eq("kind", kind).maybeSingle();
        if (error) throw error;
        if (!data) return json({ error: "Nothing on file" }, 404);
        const value = await decrypt(key, data.ciphertext);
        await audit("identifier.reveal", `${kind.toUpperCase()} revealed by ${advisorRow?.full_name || user.email} (member ${memberId}, ending ${data.last4})`);
        return json({ value });
      } catch (e) { return notConfigured(e); }
    }

    if (action === "clear") {
      try {
        const { error } = await svc.from("client_identifiers")
          .delete().eq("client_id", clientId).eq("member_id", memberId).eq("kind", kind);
        if (error) throw error;
        await audit("identifier.cleared", `${kind.toUpperCase()} removed (member ${memberId})`);
        return json({ ok: true });
      } catch (e) { return notConfigured(e); }
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
