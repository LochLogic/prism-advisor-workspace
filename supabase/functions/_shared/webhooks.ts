// Shared outbound-webhook dispatch for Prism (migration 048).
// Used by the `webhooks` management function (CRUD + the browser-triggered
// `emit`) and by other edge functions that fire server-side events
// (docusign-connect → acknowledgement.signed, public-api → client/task.created).
// Keep the event list here as the single source of truth.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// The events a firm can subscribe an endpoint to. Add here + document in the
// Integrations guide; the management function validates against this list.
export const WEBHOOK_EVENTS = [
  "client.created",
  "task.created",
  "acknowledgement.signed",
  "invoice.approved",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const WEBHOOK_SECRET_PREFIX = "whsec_";

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// A signing secret with ~190 bits of entropy. Shown to the admin once.
export function generateSecret(): string {
  return WEBHOOK_SECRET_PREFIX + b64url(crypto.getRandomValues(new Uint8Array(24)));
}

// HMAC-SHA256 of the body under the endpoint secret, hex. Sent as
// `X-Prism-Signature: sha256=<hex>` so the receiver can verify the payload.
export async function signBody(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Deliver one event to every active endpoint in the firm subscribed to it.
// Best-effort: a slow or failing endpoint never throws into the caller, and
// each delivery is bounded by a 5s timeout. Returns the count attempted.
export async function emitWebhooks(
  svc: SupabaseClient,
  firmId: string,
  event: WebhookEvent,
  data: unknown,
): Promise<number> {
  let hooks: Array<{ id: string; url: string; secret: string; events: string[] }> = [];
  try {
    const { data: rows, error } = await svc.from("webhooks")
      .select("id, url, secret, events").eq("firm_id", firmId).eq("active", true);
    if (error) throw error;
    hooks = (rows || []).filter((h) => (h.events || []).includes(event));
  } catch {
    return 0; // table not present yet (migration 048 not applied) → no-op
  }
  if (!hooks.length) return 0;

  await Promise.all(hooks.map(async (h) => {
    const body = JSON.stringify({
      id: crypto.randomUUID(), event, created_at: new Date().toISOString(), firm_id: firmId, data,
    });
    let status = 0;
    try {
      const sig = await signBody(h.secret, body);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(h.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Prism-Event": event, "X-Prism-Signature": `sha256=${sig}` },
        body, signal: ctrl.signal,
      });
      clearTimeout(timer);
      status = res.status;
    } catch {
      status = 0; // network error / timeout
    }
    svc.from("webhooks").update({ last_status: status, last_event_at: new Date().toISOString() })
      .eq("id", h.id).then(() => {}, () => {});
  }));
  return hooks.length;
}

// Fire-and-forget wrapper for hot paths (an API write, a webhook callback): use
// the Edge runtime's background-task hook when present so delivery survives the
// response, otherwise fall back to a detached promise.
export function dispatchWebhooks(svc: SupabaseClient, firmId: string, event: WebhookEvent, data: unknown): void {
  const p = emitWebhooks(svc, firmId, event, data).catch(() => 0);
  // deno-lint-ignore no-explicit-any
  const er = (globalThis as any).EdgeRuntime;
  if (er && typeof er.waitUntil === "function") er.waitUntil(p);
}
