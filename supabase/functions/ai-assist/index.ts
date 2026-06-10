// Prism Edge Function: ai-assist
// AI relationship assistant (Gemini). Server-side only — GEMINI_API_KEY never
// reaches a browser. An authenticated ADVISOR (or admin) sends an action plus a
// compact context payload of data they already hold under RLS; the function
// builds the prompt, calls Gemini, and returns plain text.
//
// Body: { action: 'draft_reply'|'household_summary'|'talking_points'|'attention'|'w2_extract',
//         context: object (≤ 24 KB serialized),
//         file?: { data: base64, mimeType } — w2_extract only (≤ ~5.6 MB base64) }
// Deploy: supabase functions deploy ai-assist --project-ref phabxcijbbphfxvjedfj
// (verify_jwt = true in config.toml — the platform JWT gate stays on.)

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const GEMINI_MODEL = "gemini-2.0-flash";
const MAX_CONTEXT_BYTES = 24_000;
// 4 MB raw ≈ 5.6 MB base64 — comfortable for a phone photo or one-page PDF scan.
const MAX_FILE_B64_BYTES = 5_600_000;

// Shared guardrails: an assistant for a fiduciary's BACK OFFICE, not a robo-
// advisor. No security recommendations, no performance promises, no compliance
// sign-off language. Output is a draft for the advisor to review and own.
const BASE = `You are the back-office writing and briefing assistant inside Prism, a planning
workspace used by fee-only fiduciary financial advisors (RIAs). You draft material the ADVISOR
reviews, edits, and owns — you never communicate with clients directly.
Rules:
- Never recommend specific securities, funds, or trades, and never promise returns or outcomes.
- Frame everything as observations and discussion items, not directives or advice.
- Be warm, plain-spoken, and concise; avoid jargon unless the data uses it.
- Use only the data provided; if something is missing, say so briefly rather than inventing it.
- Output plain text (no markdown headers; simple "-" bullets are fine).`;

const PROMPTS: Record<string, (ctx: string) => string> = {
  draft_reply: (ctx) => `${BASE}

Task: draft the advisor's next reply in a secure message thread with a client household.
Match a caring, professional fiduciary tone. 2–6 sentences. Reference the thread naturally.
Output ONLY the message body (no greeting line if the thread is mid-conversation, no signature).

Data (client + recent thread, most recent last):
${ctx}`,
  household_summary: (ctx) => `${BASE}

Task: brief the advisor on this household in under 150 words: who they are, where they stand
(phase, assets, readiness), notable open items, and anything that looks stale or missing.
Start with a one-sentence headline, then 3–6 short bullets.

Household data:
${ctx}`,
  talking_points: (ctx) => `${BASE}

Task: produce a review-meeting agenda for this household: 4–7 talking points the advisor should
raise, ordered by importance. Each bullet = the point plus a short "why now" clause drawn from
the data. End with one open question that invites the client to talk.

Household data:
${ctx}`,
  // Document extraction (file attached as inlineData; ctx unused).
  w2_extract: () => `You are a precise document-extraction service. The attached file is expected
to be a US IRS Form W-2 (Wage and Tax Statement). Extract:
- employer: the employer's name (Box c), as a short string
- box1: Box 1 — wages, tips, other compensation, as a number (no commas or $)
- box2: Box 2 — federal income tax withheld, as a number
Respond with ONLY a JSON object: {"employer": string, "box1": number, "box2": number}.
If the document is not a W-2 or a box is unreadable, use 0 for that number and "" for employer.
No prose, no markdown fences.`,
  attention: (ctx) => `${BASE}

Task: triage the advisor's book. From the roster data, name the 3–5 households that most need
attention this week and why (staleness, open alerts/questions/tasks, unread messages, large
uninvested cash). One bullet per household: "Name — reason, suggested next touch." If the book
looks healthy, say so in one line instead of inventing urgency.

Roster data:
${ctx}`,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return json({ error: "Not authenticated" }, 401);
    const { data: adv } = await supa.from("advisors")
      .select("id, firm_id, role").eq("auth_user_id", user.id).maybeSingle();
    if (!adv) return json({ error: "Advisors only" }, 403);

    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) return json({ error: "AI assistant is not configured (missing GEMINI_API_KEY)" }, 503);

    const { action, context, file } = await req.json().catch(() => ({}));
    const build = PROMPTS[action as string];
    if (!build) return json({ error: "Unknown action" }, 400);
    const ctx = JSON.stringify(context ?? {}, null, 1);
    if (ctx.length > MAX_CONTEXT_BYTES) return json({ error: "Context too large" }, 413);

    // Optional attached document (w2_extract): base64 image/PDF → Gemini inlineData.
    const parts: Record<string, unknown>[] = [{ text: build(ctx) }];
    if (action === "w2_extract") {
      if (!file?.data || typeof file.data !== "string") return json({ error: "No file attached" }, 400);
      if (file.data.length > MAX_FILE_B64_BYTES) return json({ error: "File too large (4 MB max)" }, 413);
      const mime = String(file.mimeType || "");
      if (!/^(image\/(png|jpe?g|webp|heic|heif)|application\/pdf)$/.test(mime)) {
        return json({ error: "Unsupported file type — upload an image or PDF" }, 400);
      }
      parts.push({ inlineData: { mimeType: mime, data: file.data } });
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: action === "w2_extract"
            ? { temperature: 0, maxOutputTokens: 256, responseMimeType: "application/json" }
            : { temperature: 0.6, maxOutputTokens: 1024 },
        }),
      },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("gemini error", res.status, detail.slice(0, 500));
      return json({ error: `AI provider error (${res.status})` }, 502);
    }
    const out = await res.json();
    const text = (out?.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? "").join("").trim();
    if (!text) return json({ error: "Empty AI response" }, 502);

    // Audit (append-only, service role — same trail as every other material action)
    try {
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await admin.from("audit_log").insert({
        actor_id: user.id, actor_role: adv.role === "admin" ? "admin" : "advisor",
        actor_email: user.email ?? null, firm_id: adv.firm_id,
        action: "ai.assist", entity_type: "ai",
        summary: `AI assist: ${action}`,
      });
    } catch (e) { console.warn("ai-assist audit failed:", (e as Error).message); }

    return json({ text });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
