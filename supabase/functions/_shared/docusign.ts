// Shared DocuSign helpers for Prism Edge Functions.
//
// Auth is JWT Grant (a.k.a. "service integration"): we sign a short-lived JWT
// with the integration's RSA private key and exchange it for an access token.
// This needs no user interaction — but DocuSign requires a one-time admin
// consent for the impersonated user (see docs/docusign-setup.md).
//
// All secrets come from Function env vars (supabase secrets set …); nothing
// DocuSign-related is ever stored in the repo. Required secrets:
//   DOCUSIGN_INTEGRATION_KEY  — integration key (a.k.a. client id)
//   DOCUSIGN_USER_ID          — the impersonated user's API user id (GUID)
//   DOCUSIGN_ACCOUNT_ID       — the API account id (GUID)
//   DOCUSIGN_PRIVATE_KEY      — the RSA private key PEM (PKCS#1 or PKCS#8)
// Optional:
//   DOCUSIGN_OAUTH_BASE       — oauth host; default account-d.docusign.com (demo).
//                               Production: account.docusign.com
//   DOCUSIGN_REST_BASE        — override the REST base; normally resolved from
//                               /oauth/userinfo (e.g. https://demo.docusign.net)

import jwt from "npm:jsonwebtoken@9";

export function env(name: string, required = true): string {
  const v = Deno.env.get(name);
  if (required && !v) throw new Error(`Missing DocuSign secret: ${name}`);
  return v ?? "";
}

const OAUTH_BASE = () => Deno.env.get("DOCUSIGN_OAUTH_BASE") || "account-d.docusign.com";

// Mint a JWT-grant access token. Throws with DocuSign's body on failure (the
// most common is `consent_required`, which the setup doc explains how to clear).
export async function getAccessToken(): Promise<string> {
  const integrationKey = env("DOCUSIGN_INTEGRATION_KEY");
  const userId = env("DOCUSIGN_USER_ID");
  // Secrets stored with literal "\n" (single-line) are normalised back to PEM.
  const privateKey = env("DOCUSIGN_PRIVATE_KEY").replace(/\\n/g, "\n");
  const oauthBase = OAUTH_BASE();

  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: integrationKey,
      sub: userId,
      aud: oauthBase,
      iat: now,
      exp: now + 3600,
      scope: "signature impersonation",
    },
    privateKey,
    { algorithm: "RS256" },
  );

  const res = await fetch(`https://${oauthBase}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`DocuSign token (${res.status}): ${body.error || ""} ${body.error_description || ""}`.trim());
  }
  return body.access_token as string;
}

// Resolve the account's REST base URI (e.g. https://demo.docusign.net). Prefers
// the explicit override, else reads /oauth/userinfo for the matching account.
export async function getRestBase(accessToken: string): Promise<string> {
  const override = Deno.env.get("DOCUSIGN_REST_BASE");
  if (override) return override.replace(/\/+$/, "");

  const accountId = env("DOCUSIGN_ACCOUNT_ID");
  const res = await fetch(`https://${OAUTH_BASE()}/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`DocuSign userinfo (${res.status})`);
  const accounts: Array<{ account_id: string; base_uri: string; is_default: boolean }> = body.accounts || [];
  const acct = accounts.find((a) => a.account_id === accountId) || accounts.find((a) => a.is_default);
  if (!acct) throw new Error("DocuSign account not found in userinfo");
  return acct.base_uri.replace(/\/+$/, "");
}
