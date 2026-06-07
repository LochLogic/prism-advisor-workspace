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
    // Rate-limit before doing any work. Per-IP + global token buckets (migration
    // 021) blunt a flood of this unauthenticated public write. Cloudflare fronts
    // the app, so cf-connecting-ip is the real client; x-forwarded-for is the
    // fallback. Throttled requests are dropped silently (still 204) — we never
    // signal success/failure to the caller.
    const ip = (req.headers.get("cf-connecting-ip")
      || (req.headers.get("x-forwarded-for") || "").split(",")[0]
      || "").trim();
    const { data: allowed } = await admin.rpc("px_log_error_allowed", { p_ip: ip });
    if (allowed === false) return new Response(null, { status: 204, headers: corsHeaders });

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
