// Shared CORS headers for all Prism Edge Functions.
// The browser calls these functions cross-origin (from GitHub Pages), so every
// function must answer the OPTIONS preflight and echo these headers on responses.
//
// NOTE: '*' is fine while developing. Before production, lock the origin down to
// your real host(s), e.g. 'https://lochlogic.github.io' or your custom domain.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
