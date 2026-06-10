// Shared calendar-provider plumbing for the calendar-oauth / calendar-events
// edge functions. Two providers, one normalized surface:
//   • google     — Google Calendar API v3   (secrets: GOOGLE_OAUTH_CLIENT_ID/SECRET)
//   • microsoft  — Microsoft Graph calendar (secrets: MS_OAUTH_CLIENT_ID/SECRET,
//                  optional MS_OAUTH_TENANT, default "common" for multi-tenant)
// Tokens live in calendar_connections (RLS, zero policies — service role only).
// Scopes are calendar read/write + offline only, per the integration decision.

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

export type Provider = "google" | "microsoft";

export const REDIRECT_BASE = Deno.env.get("OAUTH_REDIRECT_BASE") || "https://prismaw.com";

export function redirectUri(provider: Provider): string {
  return `${REDIRECT_BASE}/oauth/${provider}/callback`;
}

export function providerConfig(provider: Provider) {
  if (provider === "google") {
    return {
      clientId: Deno.env.get("GOOGLE_OAUTH_CLIENT_ID"),
      clientSecret: Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET"),
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      scope: "openid email https://www.googleapis.com/auth/calendar",
    };
  }
  const tenant = Deno.env.get("MS_OAUTH_TENANT") || "common";
  return {
    clientId: Deno.env.get("MS_OAUTH_CLIENT_ID"),
    clientSecret: Deno.env.get("MS_OAUTH_CLIENT_SECRET"),
    authUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    scope: "offline_access User.Read Calendars.ReadWrite",
  };
}

// Service-role client — the ONLY path to calendar_connections (RLS has no policies).
export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export interface Connection {
  id: string;
  user_id: string;
  provider: Provider;
  email: string | null;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
}

export async function getConnections(svc: SupabaseClient, userId: string): Promise<Connection[]> {
  const { data, error } = await svc.from("calendar_connections")
    .select("id, user_id, provider, email, access_token, refresh_token, expires_at")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data || []) as Connection[];
}

// Returns a valid access token, refreshing (and persisting) if within 60s of expiry.
export async function freshAccessToken(svc: SupabaseClient, conn: Connection): Promise<string> {
  const expiresAt = conn.expires_at ? new Date(conn.expires_at).getTime() : 0;
  if (expiresAt - Date.now() > 60_000) return conn.access_token;
  if (!conn.refresh_token) throw new Error(`${conn.provider} connection expired — reconnect the calendar`);

  const cfg = providerConfig(conn.provider);
  const body = new URLSearchParams({
    client_id: cfg.clientId!,
    client_secret: cfg.clientSecret!,
    refresh_token: conn.refresh_token,
    grant_type: "refresh_token",
  });
  if (conn.provider === "microsoft") body.set("scope", cfg.scope);

  const r = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tok = await r.json();
  if (!r.ok || !tok.access_token) {
    throw new Error(`${conn.provider} token refresh failed: ${tok.error_description || tok.error || r.status}`);
  }
  const update: Record<string, unknown> = {
    access_token: tok.access_token,
    expires_at: new Date(Date.now() + (Number(tok.expires_in) || 3600) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };
  // Microsoft rotates refresh tokens; Google occasionally issues a new one too.
  if (tok.refresh_token) update.refresh_token = tok.refresh_token;
  await svc.from("calendar_connections").update(update).eq("id", conn.id);
  return tok.access_token;
}

export interface CalEvent {
  id: string;
  provider: Provider;
  title: string;
  start: string;       // ISO
  end: string;         // ISO
  allDay: boolean;
  location: string | null;
  link: string | null; // open-in-provider URL
}

export async function listEvents(
  provider: Provider, accessToken: string, timeMinISO: string, timeMaxISO: string, max = 25,
): Promise<CalEvent[]> {
  if (provider === "google") {
    const u = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    u.searchParams.set("timeMin", timeMinISO);
    u.searchParams.set("timeMax", timeMaxISO);
    u.searchParams.set("singleEvents", "true");
    u.searchParams.set("orderBy", "startTime");
    u.searchParams.set("maxResults", String(max));
    const r = await fetch(u, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await r.json();
    if (!r.ok) throw new Error(`Google events: ${data.error?.message || r.status}`);
    return (data.items || []).filter((e: any) => e.status !== "cancelled").map((e: any) => ({
      id: e.id,
      provider: "google" as const,
      title: e.summary || "(no title)",
      start: e.start?.dateTime || (e.start?.date ? `${e.start.date}T00:00:00Z` : ""),
      end: e.end?.dateTime || (e.end?.date ? `${e.end.date}T00:00:00Z` : ""),
      allDay: !e.start?.dateTime,
      location: e.location || null,
      link: e.htmlLink || null,
    }));
  }
  const u = new URL("https://graph.microsoft.com/v1.0/me/calendarview");
  u.searchParams.set("startDateTime", timeMinISO);
  u.searchParams.set("endDateTime", timeMaxISO);
  u.searchParams.set("$orderby", "start/dateTime");
  u.searchParams.set("$top", String(max));
  u.searchParams.set("$select", "id,subject,start,end,isAllDay,location,webLink");
  const r = await fetch(u, {
    headers: { Authorization: `Bearer ${accessToken}`, Prefer: 'outlook.timezone="UTC"' },
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`Microsoft events: ${data.error?.message || r.status}`);
  return (data.value || []).map((e: any) => ({
    id: e.id,
    provider: "microsoft" as const,
    title: e.subject || "(no title)",
    start: e.start?.dateTime ? `${e.start.dateTime}Z`.replace(/Z+$/, "Z") : "",
    end: e.end?.dateTime ? `${e.end.dateTime}Z`.replace(/Z+$/, "Z") : "",
    allDay: !!e.isAllDay,
    location: e.location?.displayName || null,
    link: e.webLink || null,
  }));
}

export async function createEvent(
  provider: Provider, accessToken: string,
  ev: { title: string; start: string; end: string; description?: string; location?: string },
): Promise<{ id: string; link: string | null }> {
  if (provider === "google") {
    const r = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: ev.title,
        description: ev.description || undefined,
        location: ev.location || undefined,
        start: { dateTime: ev.start },
        end: { dateTime: ev.end },
      }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(`Google create event: ${data.error?.message || r.status}`);
    return { id: data.id, link: data.htmlLink || null };
  }
  const r = await fetch("https://graph.microsoft.com/v1.0/me/events", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      subject: ev.title,
      body: ev.description ? { contentType: "text", content: ev.description } : undefined,
      location: ev.location ? { displayName: ev.location } : undefined,
      start: { dateTime: ev.start, timeZone: "UTC" },
      end: { dateTime: ev.end, timeZone: "UTC" },
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`Microsoft create event: ${data.error?.message || r.status}`);
  return { id: data.id, link: data.webLink || null };
}
