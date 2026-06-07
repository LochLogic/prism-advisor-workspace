// Prism Edge Function: generate-invoices
// Generates draft advisory-fee invoices for a firm for a given quarter.
// Admin-gated (JWT); does the heavy lifting with the service role so it can
// read balance_history across the whole firm. Idempotent: re-running skips
// clients that already have an invoice for the period.
//
// Body: { year?: number, quarter?: 1|2|3|4 }  (defaults to last completed quarter)
// Deploy: supabase functions deploy generate-invoices --project-ref phabxcijbbphfxvjedfj
// (Later: schedule via pg_cron to run automatically each quarter.)

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { safeEqual } from "../_shared/auth.ts";

function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Tiered annual fee in dollars for a given AUM
function annualFee(tiers: any[], aum: number): number {
  const list = Array.isArray(tiers) ? tiers : [];
  if (!list.length) return 0;
  let fee = 0, prev = 0;
  for (const t of list) {
    const cap = (t.up_to == null || t.up_to === "") ? Infinity : Number(t.up_to);
    const band = Math.max(0, Math.min(aum, cap) - prev);
    fee += band * (Number(t.annual_bps) || 0) / 10000;
    prev = cap;
    if (aum <= cap) break;
  }
  return fee;
}

// Portfolio value per snapshot date (sum of each account's latest balance ≤ date)
function buildSeries(rows: any[]) {
  const byAcct: Record<string, { date: string; bal: number }[]> = {};
  const dates = new Set<string>();
  for (const r of rows) {
    (byAcct[r.account_id] = byAcct[r.account_id] || []).push({ date: r.as_of, bal: Number(r.balance) || 0 });
    dates.add(r.as_of);
  }
  Object.values(byAcct).forEach(a => a.sort((x, y) => x.date < y.date ? -1 : 1));
  return [...dates].sort().map(d => {
    let t = 0;
    for (const a of Object.values(byAcct)) {
      let last: number | null = null;
      for (const p of a) { if (p.date <= d) last = p.bal; else break; }
      if (last != null) t += last;
    }
    return { date: d, value: t };
  });
}

function avgDaily(s: { date: string; value: number }[], start: string, end: string): number {
  if (!s.length) return 0;
  let open: number | null = null;
  for (const p of s) { if (p.date <= start) open = p.value; else break; }
  const pts = [{ date: start, value: open != null ? open : s[0].value }];
  for (const p of s) { if (p.date > start && p.date <= end) pts.push(p); }
  const endT = new Date(end).getTime(), DAY = 86400000;
  let sum = 0, total = 0;
  for (let i = 0; i < pts.length; i++) {
    const t0 = new Date(pts[i].date).getTime();
    const t1 = i + 1 < pts.length ? new Date(pts[i + 1].date).getTime() : endT;
    const days = Math.max(0, (t1 - t0) / DAY);
    sum += pts[i].value * days; total += days;
  }
  return total > 0 ? sum / total : pts[pts.length - 1].value;
}

function periodEnd(s: { date: string; value: number }[], end: string): number {
  let v = 0;
  for (const p of s) { if (p.date <= end) v = p.value; else break; }
  return v;
}

function range(start: Date, end: Date) {
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    days: (end.getTime() - start.getTime()) / 86400000 + 1,
  };
}

// Most-recent COMPLETED billing period for a schedule's frequency.
// (idempotent via the unique(client,period) constraint, so a monthly cron can
// safely re-touch quarterly/annual schedules — duplicates are skipped.)
function periodFor(frequency: string, ref = new Date()) {
  const y = ref.getUTCFullYear(), m = ref.getUTCMonth();
  if (frequency === "monthly") {
    return range(new Date(Date.UTC(y, m - 1, 1)), new Date(Date.UTC(y, m, 0)));
  }
  if (frequency === "annually") {
    return range(new Date(Date.UTC(y - 1, 0, 1)), new Date(Date.UTC(y - 1, 11, 31)));
  }
  // quarterly (default): previous completed quarter
  const q = Math.floor(m / 3);
  let py = y, pq = q - 1;
  if (pq < 0) { pq = 3; py--; }
  const sm = pq * 3;
  return range(new Date(Date.UTC(py, sm, 1)), new Date(Date.UTC(py, sm + 3, 0)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    // Two entry modes: (1) pg_cron via x-cron-secret → all firms; (2) admin via JWT → their firm
    const cronSecret = Deno.env.get("CRON_SECRET");
    const isCron = !!cronSecret && safeEqual(req.headers.get("x-cron-secret") || "", cronSecret);

    let firmFilter: string | null = null;
    let actorId: string | null = null, actorEmail: string | null = null;

    if (!isCron) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return json({ error: "Not authenticated" }, 401);
      const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await supa.auth.getUser();
      if (!user) return json({ error: "Not authenticated" }, 401);
      const { data: adv } = await supa.from("advisors").select("firm_id, role").eq("auth_user_id", user.id).single();
      if (!adv || adv.role !== "admin") return json({ error: "Firm admin only" }, 403);
      firmFilter = adv.firm_id;
      actorId = user.id; actorEmail = user.email ?? null;
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let cq = admin.from("clients").select("id, firm_id, fee_schedule_id").eq("active", true).not("fee_schedule_id", "is", null);
    if (firmFilter) cq = cq.eq("firm_id", firmFilter);
    const { data: clients } = await cq;

    let sq = admin.from("fee_schedules").select("id, tiers, basis, frequency");
    if (firmFilter) sq = sq.eq("firm_id", firmFilter);
    const { data: schedules } = await sq;
    const schedMap: Record<string, any> = Object.fromEntries((schedules || []).map(s => [s.id, s]));

    let created = 0, skipped = 0, failed = 0, total = 0;
    for (const c of (clients || [])) {
      const sched = schedMap[c.fee_schedule_id];
      if (!sched) continue;
      // Bill each client for the most-recent completed period of THEIR frequency
      const { start, end, days } = periodFor(sched.frequency || "quarterly");
      const { data: bh } = await admin.from("balance_history")
        .select("account_id, as_of, balance").eq("client_id", c.id).lte("as_of", end);
      const s = buildSeries(bh || []);
      const basis = sched.basis === "period_end" ? periodEnd(s, end) : avgDaily(s, start, end);
      if (basis <= 0) { skipped++; continue; }
      const fee = annualFee(sched.tiers, basis) * (days / 365);
      const { error } = await admin.from("invoices").insert({
        firm_id: c.firm_id, client_id: c.id, period_start: start, period_end: end,
        basis_amount: Math.round(basis), fee_amount: Math.round(fee * 100) / 100, status: "draft",
      });
      // The unique(client_id, period_start, period_end) constraint makes the run
      // idempotent: a retry (or the monthly cron re-touching a quarterly schedule)
      // hits 23505 and is a legitimate skip. Any OTHER error is a real failure and
      // must not be silently counted as "skipped" — surface it so we notice.
      if (!error) { created++; total += fee; }
      else if (error.code === "23505") skipped++;
      else { failed++; console.error(`invoice insert failed for client ${c.id}:`, error.message); }
    }

    await admin.from("audit_log").insert({
      actor_id: actorId, actor_role: isCron ? "system" : "admin", actor_email: actorEmail, firm_id: firmFilter,
      action: "invoices.generate", entity_type: "invoice",
      summary: `${isCron ? "Scheduled" : "Manual"} billing run — ${created} draft invoice(s), ${skipped} skipped (already billed)${failed ? `, ${failed} FAILED` : ""}`,
    });

    return json({ created, skipped, failed, total: Math.round(total * 100) / 100, mode: isCron ? "cron" : "manual" });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
