// Prism Edge Function: stripe-webhook
// Receives Stripe events, verifies the signature, and writes subscription
// status to the per-firm subscriptions table using the service-role key.
//
// Deploy WITHOUT JWT verification (Stripe is not a Supabase user):
//   supabase functions deploy stripe-webhook --no-verify-jwt --project-ref phabxcijbbphfxvjedfj
//
// Register the endpoint in Stripe (Developers -> Webhooks):
//   https://phabxcijbbphfxvjedfj.supabase.co/functions/v1/stripe-webhook
//   events: checkout.session.completed, customer.subscription.updated,
//           customer.subscription.deleted
// Then set the signing secret:  supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...

import Stripe from "npm:stripe@17.7.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  httpClient: Stripe.createFetchHttpClient(),
});
// Deno's crypto is async-only — the SubtleCrypto provider is required for
// webhook signature verification (the sync constructEvent will not work).
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function upsertSub(firmId: string | null | undefined, customer: unknown, subscription: any) {
  if (!firmId) return;
  const price = subscription.items?.data?.[0]?.price;
  await admin.from("subscriptions").upsert({
    firm_id: firmId,
    stripe_customer_id: typeof customer === "string" ? customer : (customer as any)?.id,
    stripe_subscription_id: subscription.id,
    plan: price?.nickname || "growth",
    status: subscription.status,
    current_period_end: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "firm_id" });
}

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      raw, sig!, Deno.env.get("STRIPE_WEBHOOK_SECRET")!, undefined, cryptoProvider,
    );
  } catch (e) {
    return new Response(`Signature verification failed: ${(e as Error).message}`, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const firmId = session.client_reference_id || (session.metadata?.firm_id ?? null);
      if (session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        await upsertSub(firmId, session.customer, subscription);
      }
    } else if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object as any;
      await upsertSub(subscription.metadata?.firm_id ?? null, subscription.customer, subscription);
    }
    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(`Handler error: ${(e as Error).message}`, { status: 400 });
  }
});
