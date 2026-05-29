// Prism Edge Function: create-checkout-session
// Called by a signed-in advisor/admin. Identifies their firm, finds-or-creates
// a Stripe customer for that firm, opens a subscription Checkout Session, and
// returns the URL for the browser to redirect to.
//
// JWT verification is ON (default) — the caller's login token tells us who they
// are. The frontend sends it automatically via supabase.functions.invoke.
//
// Deploy:
//   supabase functions deploy create-checkout-session --project-ref phabxcijbbphfxvjedfj

import Stripe from "npm:stripe@17.7.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  httpClient: Stripe.createFetchHttpClient(),
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);

    // Client bound to the caller's JWT — resolves the logged-in advisor
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Not authenticated" }, 401);

    const { data: advisor } = await userClient
      .from("advisors")
      .select("firm_id, email, firms(name)")
      .eq("auth_user_id", user.id)
      .single();
    if (!advisor?.firm_id) return json({ error: "No firm linked to this user" }, 403);

    // Service-role client to read/write the per-firm subscriptions row (bypasses RLS)
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Reuse an existing Stripe customer for the firm, or create one
    const { data: existing } = await admin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("firm_id", advisor.firm_id)
      .maybeSingle();

    let customerId = existing?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: advisor.email ?? user.email ?? undefined,
        name: advisor.firms?.name ?? undefined,
        metadata: { firm_id: advisor.firm_id },
      });
      customerId = customer.id;
      await admin.from("subscriptions").upsert(
        { firm_id: advisor.firm_id, stripe_customer_id: customerId, updated_at: new Date().toISOString() },
        { onConflict: "firm_id" },
      );
    }

    const reqBody = await req.json().catch(() => ({}));
    const origin = reqBody.origin || req.headers.get("origin") || "https://example.com";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: Deno.env.get("STRIPE_PRICE_GROWTH")!, quantity: 1 }],
      client_reference_id: advisor.firm_id,
      subscription_data: { metadata: { firm_id: advisor.firm_id } },
      allow_promotion_codes: true,
      success_url: `${origin}/index.html?billing=success`,
      cancel_url: `${origin}/index.html?billing=cancel`,
    });

    return json({ url: session.url });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
