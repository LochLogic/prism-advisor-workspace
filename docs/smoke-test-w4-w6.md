# Live smoke test — W4–W6 (documents, protection/estate, asset-truth)

Picks up where `smoke-test-w1-w3.md` left off. Covers the live-only paths added in W4–W6.
**Prereqs:** migrations 019 + 020 applied ✅, you're signed in on the live app (not demo),
and you have at least one live client with a portal login. Two browsers (or a private
window) make the advisor↔client hand-off easy.

Each step is **action → expected**. Tick as you go; on any failure, open DevTools →
Console + Network, reproduce, and paste the red error / failing request's response.

---

## Part A — Document vault (W4)

1. **Advisor → open a live client → Documents tab.**
   - [ ] Click **Upload document**, pick a small PDF, set a title + category (e.g. IPS) → **Upload**.
   - [ ] The row appears with the category chip, file name, size, and date.
   - [ ] Reload → the document is still listed (persisted to `documents` + Storage).
2. **Advisor → download + delete.**
   - [ ] Click the download icon → the file opens (short-lived signed URL).
   - [ ] Delete a throwaway upload → row disappears; reload confirms it's gone.
3. **Client portal → Documents card.**
   - [ ] Sign in as the client → the **Documents** card lists what the advisor uploaded.
   - [ ] Download works; **no upload/delete controls** appear (client is read-only).
4. **Tenant isolation (sanity).**
   - [ ] The client sees only their own documents (never another household's).

## Part B — Passive realtime messaging (W4)

5. **Advisor sits on the roster (no modal open).**
   - [ ] In the other browser, the **client sends a message** from their Conversation card.
   - [ ] The advisor's roster shows the **gold unread dot** on that client **within a second or two — no refresh.**
   - [ ] Opening the client → Messages → closing it clears the dot.

## Part C — Protection & estate (W5)

6. **Advisor → Edit numbers → Protection + Estate sections.**
   - [ ] Add a life policy (carrier, owner, coverage, premium) and a disability policy.
   - [ ] Set a couple of Estate checklist items (e.g. Will = Complete, Beneficiary review = In progress) with dates.
   - [ ] Also confirm the **retirement-detail fields** now edit (401k/IRA contributed + limits, employer match %).
   - [ ] Close + reopen → everything persisted (jsonb on the profile).
7. **Advisor → Overview.**
   - [ ] **Protection & estate** summary shows life coverage vs. guideline, a gap chip if under-covered, and estate X/5.
8. **Client portal → Protection & estate card.**
   - [ ] Renders **"Well protected"** or **"Room to strengthen"** (never alarming red).
   - [ ] Estate chips show complete / in-progress / to-do; progress bar matches.

## Part D — Asset-truth composition (W6)

9. **Pick a live client whose total invested (typed balances) exceeds managed AUM.**
   - [ ] Client portal shows the **composition strip**: *Managed $X + Held away $Y = Total $Z* (no scary warning).
   - [ ] Advisor Overview shows the same composition with **% managed**.
10. **Stale case (optional).**
    - [ ] For a client whose managed AUM is much higher than the typed balances, confirm the **gentle "update your numbers" flag** appears instead (not negative held-away).

---

## Pass / fail log
| Step | Pass? | Notes |
|---|---|---|
| A1 upload persists | | |
| A2 download + delete | | |
| A3 client read-only list | | |
| B5 realtime roster dot | | |
| C6 protection/estate persist | | |
| C7 advisor summary | | |
| C8 client card (tone) | | |
| D9 composition strip | | |
| D10 stale flag | | |

**Most likely failure modes:** documents 404/relation-missing → migration 020 not applied;
upload succeeds but download 400 → Storage object RLS / bucket policy; realtime dot doesn't
light → realtime not enabled for `messages` (it is, via 019) or the advisor's session lacks
the subscription (hard-reload the dashboard).
