// Prism Edge Function: plaid-create-link-token
// Returns a short-lived Plaid Link token so the browser can open Plaid Link
// for a given client. JWT-verified (only signed-in advisors call it).
//
// Requires secrets: PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV (sandbox|development|production)
// Deploy: supabase functions deploy plaid-create-link-token --project-ref phabxcijbbphfxvjedfj

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const PLAID_ENV = Deno.env.get("PLAID_ENV") || "sandbox";
const PLAID_BASE = PLAID_ENV === "production" ? "https://production.plaid.com"
  : PLAID_ENV === "development" ? "https://development.plaid.com"
  : "https://sandbox.plaid.com";

function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

    const { clientId } = await req.json().catch(() => ({}));
    if (!clientId) return json({ error: "clientId required" }, 400);

    // Verify the caller actually advises this client (RLS-scoped read) before
    // minting a Link token for them — matches plaid-exchange-token's check.
    const { data: advised } = await supa.from("clients").select("id").eq("id", clientId).maybeSingle();
    if (!advised) return json({ error: "Not authorized for this client" }, 403);

    const r = await fetch(`${PLAID_BASE}/link/token/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: Deno.env.get("PLAID_CLIENT_ID"),
        secret: Deno.env.get("PLAID_SECRET"),
        client_name: "Prism Advisor Workspace",
        user: { client_user_id: clientId },
        products: ["transactions"], // balances available; add "investments" for held-away brokerage holdings
        country_codes: ["US"],
        language: "en",
      }),
    });
    const data = await r.json();
    if (!r.ok) return json({ error: data.error_message || "Plaid link token failed", plaid: data }, 400);
    return json({ link_token: data.link_token });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
