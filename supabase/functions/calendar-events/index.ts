// Prism Edge Function: calendar-events
// Reads/writes the advisor's connected calendars (Google / Microsoft) using
// tokens held server-side in calendar_connections. JWT-verified.
//
// Actions:
//   upcoming { days=7 }                          → { events: CalEvent[] }  (all connections, merged)
//   freebusy { start, end }                      → { busy: [{start,end,provider}] }
//   create   { title, start, end, description?, location?, provider? } → { ok, created: [{provider,id,link}] }
//            (provider omitted → created on every connected calendar)
//
// Deploy via deploy.yml. Secrets: see _shared/calendar.ts.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { Connection, createEvent, freshAccessToken, getConnections, listEvents, serviceClient } from "../_shared/calendar.ts";

function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
    const svc = serviceClient();
    const conns = await getConnections(svc, user.id);
    if (!conns.length) return json({ error: "not_connected" }, 400);

    // Fetch events across connections, skipping (not failing on) a broken one.
    const fetchAll = async (minISO: string, maxISO: string) => {
      const results = await Promise.allSettled(conns.map(async (c: Connection) => {
        const token = await freshAccessToken(svc, c);
        return listEvents(c.provider, token, minISO, maxISO);
      }));
      const events = results.flatMap(r => r.status === "fulfilled" ? r.value : []);
      const errors = results.filter(r => r.status === "rejected").map(r => String((r as PromiseRejectedResult).reason?.message || r));
      events.sort((a, b) => a.start.localeCompare(b.start));
      return { events, errors };
    };

    if (action === "upcoming") {
      const days = Math.min(Math.max(Number(body.days) || 7, 1), 31);
      const now = new Date();
      const max = new Date(now.getTime() + days * 86400_000);
      const { events, errors } = await fetchAll(now.toISOString(), max.toISOString());
      return json({ events, ...(errors.length ? { warnings: errors } : {}) });
    }

    if (action === "freebusy") {
      const start = new Date(body.start || Date.now());
      const end = new Date(body.end || Date.now() + 86400_000);
      if (!(start < end)) return json({ error: "start must precede end" }, 400);
      const { events } = await fetchAll(start.toISOString(), end.toISOString());
      const busy = events.filter(e => !e.allDay).map(e => ({ start: e.start, end: e.end, provider: e.provider }));
      return json({ busy });
    }

    if (action === "create") {
      const { title, start, end } = body;
      if (!title || !start || !end) return json({ error: "title, start, end required" }, 400);
      const startISO = new Date(start).toISOString();
      const endISO = new Date(end).toISOString();
      if (!(new Date(startISO) < new Date(endISO))) return json({ error: "start must precede end" }, 400);
      const targets = body.provider ? conns.filter(c => c.provider === body.provider) : conns;
      if (!targets.length) return json({ error: "not_connected" }, 400);
      const created = [];
      for (const c of targets) {
        const token = await freshAccessToken(svc, c);
        const ev = await createEvent(c.provider, token, {
          title: String(title).slice(0, 200),
          start: startISO,
          end: endISO,
          description: body.description ? String(body.description).slice(0, 2000) : undefined,
          location: body.location ? String(body.location).slice(0, 200) : undefined,
        });
        created.push({ provider: c.provider, ...ev });
      }
      return json({ ok: true, created });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
