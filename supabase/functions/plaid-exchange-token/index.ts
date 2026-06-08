// Prism Edge Function: plaid-exchange-token
// Exchanges a Plaid public_token (from a successful Link) for an access token,
// stores the item, pulls account balances, and imports them into the accounts
// table (source='plaid'). Recomputes the client's AUM/cash. JWT-verified.
//
// Requires secrets: PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV
// Deploy: supabase functions deploy plaid-exchange-token --project-ref phabxcijbbphfxvjedfj

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const PLAID_ENV = Deno.env.get("PLAID_ENV") || "sandbox";
const PLAID_BASE = PLAID_ENV === "production" ? "https://production.plaid.com"
  : PLAID_ENV === "development" ? "https://development.plaid.com"
  : "https://sandbox.plaid.com";

function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Map Plaid account type/subtype to Prism's account types
function mapType(type: string, subtype: string | null): string {
  const s = (subtype || "").toLowerCase();
  if (type === "investment") {
    if (s === "401k" || s === "403b") return "401k";
    if (s.includes("roth")) return "ira_roth";
    if (s === "ira" || s.includes("ira")) return "ira_traditional";
    if (s === "hsa") return "hsa";
    return "taxable";
  }
  return "other"; // depository / other
}

async function plaid(path: string, body: Record<string, unknown>) {
  const r = await fetch(`${PLAID_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: Deno.env.get("PLAID_CLIENT_ID"),
      secret: Deno.env.get("PLAID_SECRET"),
      ...body,
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error_message || `Plaid ${path} failed`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return json({ error: "Not authenticated" }, 401);

    const { clientId, publicToken, institutionName } = await req.json().catch(() => ({}));
    if (!clientId || !publicToken) return json({ error: "clientId and publicToken required" }, 400);

    // Verify the caller actually advises this client (defense in depth beyond RLS)
    const { data: advised } = await supa.from("clients").select("id").eq("id", clientId).maybeSingle();
    if (!advised) return json({ error: "Not authorized for this client" }, 403);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1. Exchange public token
    const ex = await plaid("/item/public_token/exchange", { public_token: publicToken });
    const accessToken = ex.access_token;
    const itemId = ex.item_id;

    // 2. Store the item. The Plaid access_token is a long-lived credential — never
    // persist it in plaintext. Stash it in Supabase Vault and keep only the secret id
    // (migration 030). Balances are pulled below from the in-memory token regardless,
    // and there's no read-back path yet, so on a Vault failure we omit the stored
    // token rather than ever falling back to plaintext.
    let secretId: string | null = null;
    try {
      const { data: sid, error: vErr } = await admin.rpc("px_vault_store_token", {
        p_secret: accessToken,
        p_label: `plaid:${itemId}`,
      });
      if (vErr) throw vErr;
      secretId = (sid as string) ?? null;
    } catch (e) {
      console.error("[plaid-exchange-token] vault store failed:", (e as Error).message);
    }
    await admin.from("aggregation_items").insert({
      client_id: clientId, provider: "plaid", item_id: itemId,
      access_token_secret_id: secretId, institution_name: institutionName || null,
    });

    // 3. Pull balances and import accounts
    const bal = await plaid("/accounts/balance/get", { access_token: accessToken });
    let imported = 0;
    for (const a of (bal.accounts || [])) {
      if (a.type === "credit" || a.type === "loan") continue; // skip liabilities
      const current = Number(a.balances?.current ?? 0);
      const available = Number(a.balances?.available ?? 0);
      const isCashLike = a.type === "depository";
      const row = {
        client_id: clientId,
        source: "plaid",
        external_id: a.account_id,
        type: mapType(a.type, a.subtype),
        custodian: institutionName || "Linked institution",
        name: a.name || a.official_name || null,
        balance: current,
        cash: isCashLike ? current : 0, // brokerage cash split needs holdings; 0 for now
        updated_at: new Date().toISOString(),
      };
      const { data: existing } = await admin.from("accounts")
        .select("id").eq("client_id", clientId).eq("external_id", a.account_id).maybeSingle();
      if (existing) await admin.from("accounts").update(row).eq("id", existing.id);
      else await admin.from("accounts").insert(row);
      imported++;
    }

    // 4. Recompute the client's denormalized totals
    const { data: accts } = await admin.from("accounts")
      .select("balance, cash").eq("client_id", clientId).is("archived_at", null);
    const aum = (accts || []).reduce((s, x) => s + Number(x.balance || 0), 0);
    const cash = (accts || []).reduce((s, x) => s + Number(x.cash || 0), 0);
    await admin.from("clients")
      .update({ aum, uninvested_cash: cash, updated_at: new Date().toISOString() })
      .eq("id", clientId);

    // 5. Audit
    await admin.from("audit_log").insert({
      actor_id: user.id, actor_role: "advisor", actor_email: user.email,
      action: "account.link", entity_type: "aggregation", entity_id: itemId, client_id: clientId,
      summary: `Linked ${institutionName || "institution"} via Plaid (${imported} account${imported !== 1 ? "s" : ""})`,
    });

    return json({ imported, totalAccounts: (bal.accounts || []).length, aum, cash });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
