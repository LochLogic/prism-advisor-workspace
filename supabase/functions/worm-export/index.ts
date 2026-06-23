// Prism Edge Function: worm-export  (SEC 17a-4 retention pipeline)
// Exports the last 24h of the append-only audit_log plus any records archived
// in that window to a PRIVATE Storage bucket as a timestamped JSON file.
// Files are written with upsert:false (never overwritten) -> append-only.
//
// 17a-4-grade WORM: when the WORM_S3_* secrets are configured, the SAME archive
// is ALSO written to an object-lock (retention-locked) S3 bucket in COMPLIANCE
// mode, so the record cannot be altered or deleted by anyone - including the
// account owner - until retention expires. Dormant (Supabase-only, exactly as
// before) until those secrets are provisioned; the object-lock write is wrapped
// so it can never fail the primary private archive.
//
// To enable object-lock (provisioning is a human step): create an S3-compatible
// bucket with Object Lock enabled in COMPLIANCE mode + a default retention
// (~6 years), create scoped write-only credentials, then set the secrets:
//   WORM_S3_BUCKET, WORM_S3_KEY_ID, WORM_S3_SECRET
//   WORM_S3_REGION (default us-east-1), WORM_S3_ENDPOINT (non-AWS providers only),
//   WORM_S3_RETAIN_DAYS (default 2192 ~= 6 years), WORM_S3_RETAIN_MODE (default COMPLIANCE)
//
// Auth: x-cron-secret (CRON_SECRET) for the scheduled run, OR a firm-admin JWT
// for a manual trigger. Deploy: supabase functions deploy worm-export --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { safeEqual } from "../_shared/auth.ts";

function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Optional 17a-4 object-lock replication. Returns a short status string and
// NEVER throws - the primary private archive must not depend on it.
async function replicateToObjectLock(path: string, body: string): Promise<string> {
  const bucket = Deno.env.get("WORM_S3_BUCKET");
  const keyId = Deno.env.get("WORM_S3_KEY_ID");
  const secret = Deno.env.get("WORM_S3_SECRET");
  if (!bucket || !keyId || !secret) return "not_configured";
  try {
    const { S3Client, PutObjectCommand } = await import("npm:@aws-sdk/client-s3@3");
    const endpoint = Deno.env.get("WORM_S3_ENDPOINT") || undefined;
    const region = Deno.env.get("WORM_S3_REGION") || "us-east-1";
    const retainDays = parseInt(Deno.env.get("WORM_S3_RETAIN_DAYS") || "2192", 10);
    const mode = (Deno.env.get("WORM_S3_RETAIN_MODE") || "COMPLIANCE").toUpperCase();
    const s3 = new S3Client({
      region,
      endpoint,
      forcePathStyle: !!endpoint, // path-style for S3-compatible (non-AWS) providers
      credentials: { accessKeyId: keyId, secretAccessKey: secret },
    });
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: path,
      Body: body,
      ContentType: "application/json",
      ObjectLockMode: mode as "COMPLIANCE" | "GOVERNANCE",
      ObjectLockRetainUntilDate: new Date(Date.now() + retainDays * 86400 * 1000),
    }));
    return "written";
  } catch (e) {
    return `error:${(e as Error).message}`;
  }
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

    const body = JSON.stringify(payload, null, 2);
    const now = new Date();
    const path = `audit/${now.toISOString().slice(0, 10)}/${now.toISOString().replace(/[:.]/g, "-")}.json`;
    const { error } = await admin.storage.from("compliance-archive")
      .upload(path, body, { contentType: "application/json", upsert: false });
    if (error) return json({ error: `Upload failed: ${error.message}` }, 400);

    // Also write to an object-lock (retention-locked) bucket for full 17a-4 WORM.
    // Dormant until WORM_S3_* secrets are set; never fails this run.
    const objectLock = await replicateToObjectLock(path, body);

    await admin.from("audit_log").insert({
      actor_role: "system", action: "worm.export", entity_type: "archive", entity_id: path,
      summary: `Archived ${payload.counts.audit} audit row(s) to ${path}` + (objectLock === "written" ? " (+object-lock)" : ""),
    });

    return json({ ok: true, path, counts: payload.counts, objectLock });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
