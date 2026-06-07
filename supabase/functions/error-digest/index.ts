// Prism Edge Function: error-digest
// Clusters NEW rows from client_errors (since a stored cursor) and posts a
// digest to ALERT_WEBHOOK_URL (Slack-compatible { text }). This is the
// "nobody is told" fix from the 2026-06 review: capture already existed.
//
// Cron-only: pg_cron (migration 022) calls it hourly with x-cron-secret.
// Inert until ALERT_WEBHOOK_URL is set — and it does NOT advance the cursor
// while inert, so no errors are lost before the webhook is configured.
//
// Deploy: supabase functions deploy error-digest --project-ref phabxcijbbphfxvjedfj

import { createClient } from "npm:@supabase/supabase-js@2";
import { safeEqual } from "../_shared/auth.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
}

const MAX_BATCH = 1000;     // cap a single digest so a flood can't blow up the post
const MAX_CLUSTERS = 15;    // only the loudest N message clusters in the digest

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");

  // Cron-only. No JWT path: this is an operator/system concern, not tenant-facing.
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || !safeEqual(req.headers.get("x-cron-secret") || "", cronSecret)) {
    return json({ error: "Not authorized" }, 401);
  }

  const webhook = Deno.env.get("ALERT_WEBHOOK_URL");
  // Inert until the webhook is wired (H3). Don't advance the cursor, so the
  // backlog is delivered on the first run after it's configured.
  if (!webhook) return json({ configured: false });

  try {
    const { data: state } = await admin.from("telemetry_digest_state")
      .select("last_seen_id").eq("key", "client_errors").single();
    const lastSeen = state?.last_seen_id ?? 0;

    const { data: rows } = await admin.from("client_errors")
      .select("id, occurred_at, message, url")
      .gt("id", lastSeen).order("id", { ascending: true }).limit(MAX_BATCH);

    if (!rows || rows.length === 0) {
      await admin.from("telemetry_digest_state")
        .update({ last_run: new Date().toISOString() }).eq("key", "client_errors");
      return json({ new: 0 });
    }

    // Cluster by the message head so repeated errors collapse to one line.
    const clusters = new Map<string, { count: number; url: string | null; last: string }>();
    for (const r of rows) {
      const key = String(r.message ?? "(no message)").slice(0, 120);
      const c = clusters.get(key) ?? { count: 0, url: r.url, last: r.occurred_at };
      c.count++; c.last = r.occurred_at;
      clusters.set(key, c);
    }
    const top = [...clusters.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, MAX_CLUSTERS);
    const maxId = rows[rows.length - 1].id;

    const lines = top.map(([msg, c]) =>
      `• *${c.count}×* ${msg}${c.url ? `  _(${c.url})_` : ""}`);
    const extra = clusters.size > MAX_CLUSTERS ? `\n…and ${clusters.size - MAX_CLUSTERS} more error type(s).` : "";
    const text =
      `:rotating_light: *Prism — ${rows.length} new client error(s)* in the last hour `
      + `(${clusters.size} distinct):\n` + lines.join("\n") + extra;

    let delivered = false;
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      delivered = res.ok;
    } catch (_) { delivered = false; }

    // Only advance the cursor once the digest was actually delivered, so a
    // transient webhook failure re-sends next hour instead of dropping errors.
    if (delivered) {
      await admin.from("telemetry_digest_state")
        .update({ last_seen_id: maxId, last_run: new Date().toISOString() })
        .eq("key", "client_errors");
    }

    return json({ new: rows.length, clusters: clusters.size, delivered });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
