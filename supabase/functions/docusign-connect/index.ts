// Prism Edge Function: docusign-connect
// DocuSign Connect webhook. DocuSign POSTs envelope status changes here; when an
// envelope completes we mark the matching acknowledgement signed (immutable
// client-side, captured in the audit trail). Public (no Supabase JWT) — DocuSign
// is not a logged-in user — so it is authenticated by an HMAC over the raw body.
//
// Configure in DocuSign Admin → Connect with the JSON (Aggregate) format and an
// HMAC key; store that key as DOCUSIGN_CONNECT_HMAC_KEY. See docs/docusign-setup.md.
//
// config.toml: verify_jwt = false.
// Deploy:
//   supabase functions deploy docusign-connect --project-ref phabxcijbbphfxvjedfj

import { createClient } from "npm:@supabase/supabase-js@2";

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// DocuSign signs the raw request body with HMAC-SHA256 (base64) and sends it in
// X-DocuSign-Signature-1. Verify in constant time.
//
// FAIL CLOSED: this endpoint is the ONLY unauthenticated way to flip an
// acknowledgement to "signed" (a legally-meaningful state). With no HMAC key we
// cannot prove a request is really from DocuSign, so an unset key must REJECT the
// webhook — not accept it. The unverified path is gated behind an explicit,
// non-default DOCUSIGN_ALLOW_UNVERIFIED=1 opt-in for local/demo use only.
async function verifyHmac(raw: string, header: string | null): Promise<boolean> {
  const key = Deno.env.get("DOCUSIGN_CONNECT_HMAC_KEY");
  if (!key) {
    if (Deno.env.get("DOCUSIGN_ALLOW_UNVERIFIED") === "1") {
      console.warn("[docusign-connect] DOCUSIGN_ALLOW_UNVERIFIED=1 — accepting an UNVERIFIED webhook (demo only; do NOT use in production)");
      return true;
    }
    console.error("[docusign-connect] DOCUSIGN_CONNECT_HMAC_KEY unset — rejecting webhook (fail closed). Set the key, or DOCUSIGN_ALLOW_UNVERIFIED=1 for demo.");
    return false;
  }
  if (!header) return false;
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(raw));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
  // Constant-time-ish compare.
  if (expected.length !== header.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ header.charCodeAt(i);
  return diff === 0;
}

// Map DocuSign envelope status → our envelope_status + whether it's terminal-signed.
function mapStatus(s: string): { envelope_status: string; signed: boolean } {
  const v = (s || "").toLowerCase();
  return { envelope_status: v, signed: v === "completed" };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const raw = await req.text();
    if (!(await verifyHmac(raw, req.headers.get("X-DocuSign-Signature-1")))) {
      return json({ error: "Bad signature" }, 401);
    }

    const payload = JSON.parse(raw);
    // DocuSign "JSON (Aggregate)" shape: { event, data: { envelopeId, envelopeSummary: { status, recipients } } }
    const data = payload.data || {};
    const envelopeId: string | undefined = data.envelopeId || payload.envelopeId;
    const summary = data.envelopeSummary || {};
    const status: string = summary.status || data.status || payload.status || "";
    if (!envelopeId) return json({ ok: true, skipped: "no envelopeId" });

    const { envelope_status, signed } = mapStatus(status);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Find the acknowledgement this envelope belongs to.
    const { data: ack } = await admin
      .from("acknowledgements")
      .select("id, client_id, title, status")
      .eq("envelope_id", envelopeId)
      .maybeSingle();
    if (!ack) return json({ ok: true, skipped: "unknown envelope" });

    // Best-effort signer name from the completed recipient.
    let signerName: string | null = null;
    const signers = summary.recipients?.signers || [];
    if (signers.length) signerName = signers[0].name || null;

    const patch: Record<string, unknown> = { envelope_status };
    if (signed && ack.status !== "acknowledged") {
      patch.status = "acknowledged";
      patch.acknowledged_at = new Date().toISOString();
      if (signerName) patch.signer_name = signerName;
    }

    await admin.from("acknowledgements").update(patch).eq("id", ack.id);

    await admin.from("audit_log").insert({
      actor_role: "system",
      action: signed ? "ack.docusign_completed" : "ack.docusign_event",
      entity_type: "acknowledgement",
      entity_id: ack.id,
      client_id: ack.client_id,
      summary: `DocuSign envelope ${envelope_status}: ${ack.title}`,
    }).then(() => {}, () => {});

    return json({ ok: true });
  } catch (e) {
    console.error("[docusign-connect]", e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
