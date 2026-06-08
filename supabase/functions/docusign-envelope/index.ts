// Prism Edge Function: docusign-envelope
// Called by a signed-in advisor/admin to escalate an existing (pending)
// acknowledgement into a legally-binding DocuSign envelope. The client signs in
// DocuSign via email; the `docusign-connect` webhook marks the row completed.
//
// JWT verification is ON — the caller's token identifies the advisor. We then
// confirm (via an RLS-scoped read) that the acknowledgement belongs to a client
// the caller advises before doing anything with the service role.
//
// Deploy:
//   supabase functions deploy docusign-envelope --project-ref phabxcijbbphfxvjedfj
// Requires DOCUSIGN_* secrets (see _shared/docusign.ts and docs/docusign-setup.md).

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { env, getAccessToken, getRestBase } from "../_shared/docusign.ts";

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Minimal HTML document for the envelope. DocuSign converts HTML → PDF and we
// drop an anchor string (/sig1/) where the signature tab is placed.
function buildDocumentHtml(title: string, body: string, householdName: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{font-family:Georgia,serif;color:#1a1a1a;line-height:1.6;max-width:680px;margin:40px auto;padding:0 24px}
h1{font-size:20px;border-bottom:2px solid #1a1a1a;padding-bottom:8px}
.body{white-space:pre-wrap;font-size:14px;margin:24px 0}
.sig{margin-top:48px;font-size:13px;color:#444}</style></head>
<body>
<h1>${esc(title)}</h1>
<div class="body">${esc(body || "")}</div>
<div class="sig">Prepared for <strong>${esc(householdName)}</strong>.</div>
<div class="sig">Signature: <span style="color:#fff;font-size:1px">/sig1/</span></div>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);

    const { acknowledgementId } = await req.json().catch(() => ({}));
    if (!acknowledgementId) return json({ error: "acknowledgementId required" }, 400);

    // Caller-scoped client: RLS ensures the advisor can only read an ack for a
    // client they advise. If this returns null, they're not allowed near it.
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Not authenticated" }, 401);

    const { data: ack } = await userClient
      .from("acknowledgements")
      .select("id, client_id, title, body, status, provider, envelope_id")
      .eq("id", acknowledgementId)
      .single();
    if (!ack) return json({ error: "Acknowledgement not found or not permitted" }, 404);
    if (ack.status === "acknowledged") return json({ error: "Already signed" }, 409);
    if (ack.envelope_id) return json({ error: "A DocuSign envelope was already sent" }, 409);

    // Service-role read for the signer's email/name (clients has no email column;
    // it's the invite email, or the claimed auth user's email).
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: client } = await admin
      .from("clients")
      .select("firm_id, household_name, short_name, invite_email, auth_user_id")
      .eq("id", ack.client_id)
      .single();
    if (!client) return json({ error: "Client not found" }, 404);

    let signerEmail = client.invite_email as string | null;
    if (!signerEmail && client.auth_user_id) {
      const { data: au } = await admin.auth.admin.getUserById(client.auth_user_id);
      signerEmail = au?.user?.email ?? null;
    }
    if (!signerEmail) {
      return json({ error: "No email on file for this client — invite them or set an invite email first." }, 422);
    }
    const signerName = (client.short_name || client.household_name || "Client") as string;

    // ── Create + send the envelope ───────────────────────────────────────────
    const accessToken = await getAccessToken();
    const restBase = await getRestBase(accessToken);
    const accountId = env("DOCUSIGN_ACCOUNT_ID");

    const documentBase64 = btoa(buildDocumentHtml(ack.title, ack.body || "", signerName));
    const envelope = {
      emailSubject: `Please sign: ${ack.title}`,
      status: "sent",
      documents: [{
        documentBase64,
        name: ack.title,
        fileExtension: "html",
        documentId: "1",
      }],
      recipients: {
        signers: [{
          email: signerEmail,
          name: signerName,
          recipientId: "1",
          routingOrder: "1",
          tabs: {
            signHereTabs: [{
              anchorString: "/sig1/",
              anchorUnits: "pixels",
              anchorXOffset: "0",
              anchorYOffset: "-6",
            }],
          },
        }],
      },
    };

    const dsRes = await fetch(`${restBase}/restapi/v2.1/accounts/${accountId}/envelopes`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(envelope),
    });
    const dsBody = await dsRes.json().catch(() => ({}));
    if (!dsRes.ok) {
      console.error("[docusign-envelope] create failed:", dsRes.status, dsBody);
      return json({ error: `DocuSign error: ${dsBody.message || dsRes.status}` }, 502);
    }

    // Persist the envelope reference on the ack (service role — column is not
    // client-writable). Status stays 'pending' until the webhook reports complete.
    const { data: updated, error: upErr } = await admin
      .from("acknowledgements")
      .update({
        provider: "docusign",
        envelope_id: dsBody.envelopeId,
        envelope_status: dsBody.status || "sent",
        sent_at: new Date().toISOString(),
      })
      .eq("id", ack.id)
      .select("id, status, provider, envelope_id, envelope_status, sent_at")
      .single();
    if (upErr) console.error("[docusign-envelope] row update failed:", upErr.message);

    // Best-effort audit trail (mirrors db.jsx ack.* actions).
    await admin.from("audit_log").insert({
      actor_id: user.id,
      actor_role: "advisor",
      actor_email: user.email,
      firm_id: client.firm_id,
      action: "ack.docusign_sent",
      entity_type: "acknowledgement",
      entity_id: ack.id,
      client_id: ack.client_id,
      summary: `Sent DocuSign envelope: ${ack.title}`,
    }).then(() => {}, () => {});

    return json({ ok: true, envelopeId: dsBody.envelopeId, acknowledgement: updated });
  } catch (e) {
    console.error("[docusign-envelope]", e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
