// Prism Edge Function: worm-export  (SEC 17a-4 retention pipeline)
// Exports the last 24h of the append-only audit_log plus any records archived
// in that window to a PRIVATE Storage bucket as a timestamped JSON file.
// Files are written with upsert:false (never overwritten) → append-only.
//
// NOTE on "storage-grade WORM": Supabase Storage is private + never-overwritten
// here, but does not enforce object-lock immutability. For full 17a-4 WORM,
// point/replicate this bucket to object-lock storage (e.g. S3 Object Lock).
//
// Auth: x-cron-secret (CRON_SECRET) for the scheduled run, OR a firm-admin JWT
// for a manual trigger. Deploy: supabase functions deploy worm-export --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { safeEqual } from "../_shared/auth.ts";

function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const cronSecret = Deno.env.get("CRON_SECRET");
    const isCron = !!cronSecret && safeEqual(req.headers.get("x-cron-secret") || "", cronSecret);

    if (!isCron) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return json({ error: "Not authenticated" }, 401);
      const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await supa.auth.getUser();
      if (!user) return json({ error: "Not authenticated" }, 401);
      const { data: adv } = await supa.from("advisors").select("role").eq("auth_user_id", user.id).single();
      if (!adv || adv.role !== "admin") return json({ error: "Firm admin only" }, 403);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    const [audit, accounts, meetings] = await Promise.all([
      admin.from("audit_log").select("*").gte("occurred_at", since).order("occurred_at"),
      admin.from("accounts").select("*").gte("archived_at", since),
      admin.from("meetings").select("*").gte("archived_at", since),
    ]);

    const payload = {
      exported_at: new Date().toISOString(),
      window_since: since,
      counts: {
        audit: audit.data?.length || 0,
        archived_accounts: accounts.data?.length || 0,
        archived_meetings: meetings.data?.length || 0,
      },
      audit_log: audit.data || [],
      archived_accounts: accounts.data || [],
      archived_meetings: meetings.data || [],
    };

    const now = new Date();
    const path = `audit/${now.toISOString().slice(0, 10)}/${now.toISOString().replace(/[:.]/g, "-")}.json`;
    const { error } = await admin.storage.from("compliance-archive")
      .upload(path, JSON.stringify(payload, null, 2), { contentType: "application/json", upsert: false });
    if (error) return json({ error: `Upload failed: ${error.message}` }, 400);

    await admin.from("audit_log").insert({
      actor_role: "system", action: "worm.export", entity_type: "archive", entity_id: path,
      summary: `Archived ${payload.counts.audit} audit row(s) to ${path}`,
    });

    return json({ ok: true, path, counts: payload.counts });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
