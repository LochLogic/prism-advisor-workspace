# Live smoke test — W1–W3 (household model, planning, messaging)

Covers the paths the **demo can't reach** (live = real signed-in session against Supabase).
Each step is **action → expected**. Tick as you go; if anything fails, copy the browser console + the failing Network request and hand it back for a fix.

## Prerequisites
- [ ] **Migration `019_messaging.sql` run** in the Supabase SQL editor (idempotent; safe to re-run).
- [ ] A signed-in **advisor** account, and at least one **client** that has a portal login (or create one during the test). Two browsers / a private window make the advisor↔client hand-off easy.
- [ ] You're on the live app (`https://prismaw.com/app` or the Worker URL), **not** demo mode.

---

## Part A — Advisor, on a live client

1. **Open a live client → "Edit numbers".**
   - [ ] Add 2 household members (primary + spouse) with ages; add an income source; add a Social Security stream; add a Goal (target amount + date).
   - [ ] Close and reopen the drawer → **everything persisted** (saved to `profiles.data`, no reset).
2. **Client modal → Overview.**
   - [ ] **Household chips** show the members you entered.
   - [ ] **Retirement readiness** badge shows a %/verdict (unsoftened, advisor-side).
   - [ ] **Goals** summary lists the goal with a status badge.
   - [ ] If the client has linked/AUM ≠ typed balances → **reconciliation note** appears.
3. **Client modal → Messages tab.**
   - [ ] Send a message → it appears in the thread immediately.
   - [ ] Reload → the message is still there (persisted to `messages`).

## Part B — Client portal (sign in as the client)

4. **Portal landing.**
   - [ ] **Retirement readiness card** renders with a verdict. (If this client is young / early-journey, confirm it reads **"Building · time on your side"**, not "At risk".)
   - [ ] **Goals card** shows progress bar (saved-so-far) + status badge; a "behind" goal shows the **+$X/mo** nudge.
   - [ ] **Conversation card** shows the advisor's message from step 3.
5. **Client replies.**
   - [ ] Type a reply → it sends and appears right-aligned.
   - [ ] (If both windows are open) the advisor's open thread shows the reply **in realtime**, no refresh.

## Part C — Cross-checks (advisor side again)

6. **Roster unread dot.**
   - [ ] Back on the advisor roster, the client row shows a **gold unread dot** (they messaged you).
7. **Mark-read.**
   - [ ] Open the client → Messages tab → close the modal → the roster **unread dot clears** (advisor read it).
8. **Audit/timeline.**
   - [ ] Client modal → Timeline shows the message + profile-save events.

---

## Pass / fail log
| Step | Pass? | Notes |
|---|---|---|
| A1 numbers persist | | |
| A2 overview (chips/readiness/goals/reconcile) | | |
| A3 advisor send + persist | | |
| B4 portal cards | | |
| B5 client reply + realtime | | |
| C6 unread dot | | |
| C7 mark-read clears | | |
| C8 timeline | | |

**If something breaks:** open DevTools → Console + Network, reproduce, and paste the red errors / the failing request's response. Most likely culprits if messaging fails: migration 019 not applied (→ 404/relation-missing on `messages`), or realtime not enabled for the table (→ messages persist but don't appear live until reload).
