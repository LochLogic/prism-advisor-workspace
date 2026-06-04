// Prism Edge Function: log-error
// Public sink for the client error reporter. Writes a capped record to the
// client_errors table via the service role. Never returns an error to the
// client (always 204) so it can't itself break the page.
//
// Deploy WITHOUT JWT (the browser calls it pre/post auth):
//   supabase functions deploy log-error --no-verify-jwt --project-ref phabxcijbbphfxvjedfj

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const cap = (s: unknown, n: number) => (s == null ? null : String(s).slice(0, n));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(null, { status: 405, headers: corsHeaders });
  try {
    const b = await req.json().catch(() => ({}));
    const message = cap(b.message, 1000);
    if (message) {
      await admin.from("client_errors").insert({
        message,
        stack: cap(b.stack, 6000),
        url: cap(b.url, 1000),
        user_agent: cap(b.user_agent, 500),
        context: b.context ?? null,
      });
    }
  } catch (_) { /* swallow — never surface to the client */ }
  return new Response(null, { status: 204, headers: corsHeaders });
});
