// Prism Edge Function: calendar-oauth
// Advisor calendar connection lifecycle (Google Calendar / Microsoft Graph).
// JWT-verified. Tokens are stored in calendar_connections (RLS, no policies —
// service role only) and NEVER returned to the browser.
//
// Actions:
//   auth_url   { provider, state }        → { url }  (provider consent screen)
//   exchange   { provider, code }         → { ok, provider, email }  (callback page)
//   status     {}                         → { connections: [{provider, email, connected_at}] }
//   disconnect { provider }               → { ok }  (revokes where supported, deletes row)
//
// Requires secrets: GOOGLE_OAUTH_CLIENT_ID/SECRET, MS_OAUTH_CLIENT_ID/SECRET
// (optional MS_OAUTH_TENANT, OAUTH_REDIRECT_BASE). Deploy via deploy.yml.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { Provider, providerConfig, redirectUri, serviceClient } from "../_shared/calendar.ts";

function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Base64url-decode a JWT payload segment (Google id_token → email claim).
function jwtPayload(token: string): Record<string, unknown> {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(part + "=".repeat((4 - part.length % 4) % 4)));
  } catch { return {}; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return json({ error: "Not authenticated" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const provider = String(body.provider || "") as Provider;
    const svc = serviceClient();

    if (action === "status") {
      const { data, error } = await svc.from("calendar_connections")
        .select("provider, email, created_at")
        .eq("user_id", user.id);
      if (error) throw new Error(error.message);
      return json({ connections: (data || []).map(c => ({ provider: c.provider, email: c.email, connected_at: c.created_at })) });
    }

    if (provider !== "google" && provider !== "microsoft") {
      return json({ error: "provider must be google or microsoft" }, 400);
    }
    const cfg = providerConfig(provider);
    if (!cfg.clientId || !cfg.clientSecret) {
      return json({ error: `${provider} calendar isn't configured yet` }, 400);
    }

    if (action === "auth_url") {
      const u = new URL(cfg.authUrl);
      u.searchParams.set("client_id", cfg.clientId);
      u.searchParams.set("redirect_uri", redirectUri(provider));
      u.searchParams.set("response_type", "code");
      u.searchParams.set("scope", cfg.scope);
      u.searchParams.set("state", String(body.state || ""));
      if (provider === "google") {
        u.searchParams.set("access_type", "offline");
        u.searchParams.set("prompt", "consent"); // ensures a refresh_token on re-connect
      } else {
        u.searchParams.set("response_mode", "query");
      }
      return json({ url: u.toString() });
    }

    if (action === "exchange") {
      const code = String(body.code || "");
      if (!code) return json({ error: "code required" }, 400);
      const r = await fetch(cfg.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          code,
          redirect_uri: redirectUri(provider),
          grant_type: "authorization_code",
        }),
      });
      const tok = await r.json();
      if (!r.ok || !tok.access_token) {
        return json({ error: `Token exchange failed: ${tok.error_description || tok.error || r.status}` }, 400);
      }

      // Resolve the calendar account email for display.
      let email: string | null = null;
      if (provider === "google" && tok.id_token) {
        email = (jwtPayload(tok.id_token).email as string) || null;
      } else if (provider === "microsoft") {
        const me = await fetch("https://graph.microsoft.com/v1.0/me", {
          headers: { Authorization: `Bearer ${tok.access_token}` },
        }).then(x => x.json()).catch(() => ({}));
        email = me.mail || me.userPrincipalName || null;
      }

      const { error } = await svc.from("calendar_connections").upsert({
        user_id: user.id,
        provider,
        email,
        access_token: tok.access_token,
        refresh_token: tok.refresh_token || null,
        expires_at: new Date(Date.now() + (Number(tok.expires_in) || 3600) * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,provider" });
      if (error) throw new Error(error.message);
      return json({ ok: true, provider, email });
    }

    if (action === "disconnect") {
      const { data: conn } = await svc.from("calendar_connections")
        .select("id, access_token, refresh_token")
        .eq("user_id", user.id).eq("provider", provider).maybeSingle();
      if (conn && provider === "google") {
        // Best-effort revoke (Microsoft has no comparable simple endpoint).
        const t = conn.refresh_token || conn.access_token;
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(t)}`, { method: "POST" }).catch(() => {});
      }
      await svc.from("calendar_connections").delete().eq("user_id", user.id).eq("provider", provider);
      return json({ ok: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
