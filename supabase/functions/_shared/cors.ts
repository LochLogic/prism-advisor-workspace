// Shared CORS headers for all Prism Edge Functions.
// The browser calls these functions cross-origin (from prismaw.com), so every
// function answers the OPTIONS preflight and echoes these headers on responses.
//
// Locked to the production origin (was '*'). Override per-deployment with the
// ALLOWED_ORIGIN secret (e.g. for staging or local dev:
//   supabase secrets set ALLOWED_ORIGIN=http://localhost:3000 ).
// Note: a single origin is emitted; serve the app from one canonical host
// (prismaw.com). If you also serve www/other hosts, set ALLOWED_ORIGIN or
// switch to a request-origin allow-list echo.
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "https://prismaw.com";

export const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
