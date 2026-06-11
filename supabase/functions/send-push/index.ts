// Prism Edge Function: send-push
// Web-push fanout to a client's installed portal (PWA). An authenticated
// ADVISOR (or admin) in the client's firm posts a small notification payload;
// the function loads the client's push subscriptions and delivers via the Web
// Push protocol with the platform VAPID keys (server-side only). Dead
// endpoints (404/410 from the push service) are pruned.
//
// Body: { client_id: uuid, title?: string, body?: string, url?: string, tag?: string }
// Returns: { sent: number, pruned: number }
//
// Secrets: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (raw base64url, the standard
// web-push CLI format) / VAPID_SUBJECT (mailto:). Synced 2026-06-10.
// Deploy: gated deploy.yml workflow (verify_jwt = true in config.toml).

import { createClient } from "npm:@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush@0.3.0";
import { corsHeaders } from "../_shared/cors.ts";

function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// VAPID keys are stored in the standard raw base64url form (public = 65-byte
// uncompressed P-256 point, private = 32-byte scalar). WebCrypto wants JWK.
function b64uToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
function bytesToB64u(b: Uint8Array): string {
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function importVapid(): Promise<webpush.ApplicationServer> {
  const pub = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
  const priv = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
  if (!pub || !priv) throw new Error("VAPID keys not configured");
  const raw = b64uToBytes(pub); // 0x04 || x(32) || y(32)
  const x = bytesToB64u(raw.slice(1, 33));
  const y = bytesToB64u(raw.slice(33, 65));
  const vapidKeys = await webpush.importVapidKeys({
    publicKey:  { kty: "EC", crv: "P-256", x, y, ext: true, key_ops: ["verify"] },
    privateKey: { kty: "EC", crv: "P-256", x, y, d: priv, ext: true, key_ops: ["sign"] },
  }, { extractable: false });
  return await webpush.ApplicationServer.new({
    contactInformation: Deno.env.get("VAPID_SUBJECT") ?? "mailto:support@prismaw.com",
    vapidKeys,
  });
}
let appServerPromise: Promise<webpush.ApplicationServer> | null = null;
const appServer = () => (appServerPromise ??= importVapid());

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Caller must be an advisor/admin; the platform JWT gate (verify_jwt) is on,
  // this resolves WHO it is.
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: { user } = { user: null } } = await supa.auth.getUser(jwt);
  if (!user) return json({ error: "unauthorized" }, 401);
  const { data: advisor } = await supa.from("advisors")
    .select("id, firm_id").eq("auth_user_id", user.id).maybeSingle();
  if (!advisor) return json({ error: "advisors only" }, 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "invalid JSON" }, 400); }
  const clientId = String(body.client_id ?? "");
  if (!/^[0-9a-f-]{36}$/.test(clientId)) return json({ error: "client_id required" }, 400);

  // Tenant check: the target client must be in the caller's firm.
  const { data: client } = await supa.from("clients")
    .select("id, firm_id, auth_user_id").eq("id", clientId).maybeSingle();
  if (!client || client.firm_id !== advisor.firm_id) return json({ error: "not found" }, 404);
  if (!client.auth_user_id) return json({ sent: 0, pruned: 0 }); // never claimed the portal

  const { data: subs } = await supa.from("push_subscriptions")
    .select("id, endpoint, p256dh, auth").eq("auth_user_id", client.auth_user_id);
  if (!subs?.length) return json({ sent: 0, pruned: 0 });

  // Generic payload only — no PII beyond what the advisor typed; the SW deep-
  // links into the (auth-gated) portal for the substance.
  const payload = JSON.stringify({
    title: String(body.title ?? "Your advisor").slice(0, 80),
    body:  String(body.body ?? "You have new activity in your portal.").slice(0, 160),
    url:   String(body.url ?? "/portal").slice(0, 200),
    tag:   String(body.tag ?? "prism-portal").slice(0, 40),
  });

  const server = await appServer();
  let sent = 0, pruned = 0;
  for (const s of subs) {
    try {
      const subscriber = server.subscribe({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } });
      await subscriber.pushTextMessage(payload, {});
      sent++;
    } catch (err) {
      // 404/410 = endpoint gone (uninstalled / permission revoked) — prune it.
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404 || status === 410) {
        await supa.from("push_subscriptions").delete().eq("id", s.id);
        pruned++;
      } else {
        console.warn("[send-push] delivery failed:", (err as Error)?.message ?? err);
      }
    }
  }
  return json({ sent, pruned });
});
