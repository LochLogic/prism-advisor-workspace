# UAT Results (Sprint 5.5) — and your test-user onboarding guide

Status of the three persona acceptance flows from the review. ✅ = verified in the demo this session · 🔵 = needs a **live session** (real auth / Stripe / admin role — can't be exercised in demo mode). Reuse the steps below as the checklist you walk each design partner through.

## Advisor
| Step | Status |
|---|---|
| Sign up → name firm (provision) → land as admin | 🔵 live (real auth + `px_provision_firm`) |
| Add a client (with optional starting numbers) | ✅ (modal + seed flow) |
| Open client → build roadmap (toggle milestones) | ✅ (milestone toggle changes state) |
| Open a calculator (e.g. asset location / avalanche) | ✅ (computes live) |
| Request an acknowledgement | 🔵 live (advisor modal → client signs) |
| Generate / print a report | ✅ (report buttons present; PDF path) |
| Book-AUM trend, roster, quick-view modal, edit-numbers | ✅ |

## Client
| Step | Status |
|---|---|
| Open portal → see roadmap | ✅ |
| Flag a question ("discuss with advisor") | ✅ (flag modal opens) |
| Review & e-sign an acknowledgement | 🔵 live (immutable signed row via RPC) |
| View inline performance (chart + TWR returns) | ✅ |
| Update "your numbers" | ✅ (drawer; flows into the plan) |

## Admin
| Step | Status |
|---|---|
| Open Firm Admin → create a fee schedule | 🔵 live (demo is advisor-role) |
| Assign schedule to clients inline | 🔵 live |
| Run billing → approve an invoice → view audit trail | 🔵 live |

Run all three on **desktop + mobile, light + dark** — the layout, dark mode, and mobile responsiveness are ✅ verified this session across views.

## What's covered by automated tests (Sprint 5)
- **Unit** (`npm run test:calc`, 50 tests): all calculators + `annualFeeForAum` (fee tiers) + Modified-Dietz edge cases (flow timing, zero-denominator).
- **DB integration** (`npm run test:db`, needs staging `DATABASE_URL`): tenant isolation (RLS), the acknowledgement e-sign RPC (owner-only + immutable-after-sign), invoice idempotency, self-serve provisioning.

## The 🔵 live items — your 10-minute pre-pilot smoke (do once in a real session)
1. Sign up a throwaway firm → confirm you land as admin.
2. Add a client → open them → toggle a milestone → request an acknowledgement.
3. Open that client's portal → sign the acknowledgement → confirm it shows "Signed" + a row in the `acknowledgements` table.
4. Admin → create a fee schedule → assign it → run billing → approve the invoice → check the audit trail.
5. Repeat the advisor+client steps once on your phone.
Pass = each completes with correct data and no error (and now: any error shows the friendly boundary + lands in `client_errors`).
