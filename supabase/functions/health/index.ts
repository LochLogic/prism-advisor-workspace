// Prism Edge Function: health
// A do-nothing function whose only job is to prove the pipeline works:
//   CLI deploy  →  public HTTPS endpoint  →  callable from the Prism frontend.
//
// Deploy (no JWT required, so you can curl it):
//   supabase functions deploy health --no-verify-jwt --project-ref phabxcijbbphfxvjedfj
//
// Test:
//   curl https://phabxcijbbphfxvjedfj.supabase.co/functions/v1/health

import { corsHeaders } from "../_shared/cors.ts";

Deno.serve((req) => {
  // Answer the browser's CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const body = {
    ok: true,
    service: "prism-edge",
    message: "Edge Functions are live.",
    time: new Date().toISOString(),
  };

  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
