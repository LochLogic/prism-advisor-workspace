# Architecture continuity review — W1–W4

> Date: 2026-06-06. A continuity pass across the wedge build-out (W1–W3 shipped, W4 planned)
> to confirm new work follows the established patterns and to flag the few seams that need care.
> Verdict: **continuous.** No architectural drift. Three watch-items called out below.

## The five load-bearing patterns (and how each sprint honours them)

### 1. Data model — `jsonb` profile vs. relational tables
The repo has a deliberate split:
- **Planning inputs** (household members, income sources, fixed-income streams, goals) live in the
  `profiles.data` **jsonb blob**. `mergeProfile(base, data)` backfills every expected key onto old
  profiles, so these need **no migration**.
- **Shared / audited entities** (messages, and W4's documents) are **relational tables** with RLS +
  audit, following the `acknowledgements` / `crm_tasks` precedent.

| Sprint | Where its data lives | Migration? | Correct? |
|---|---|---|---|
| W1 household + streams | jsonb (`members[]`, `incomeStreams[]`) | none | ✅ |
| W2 goals | jsonb (`goals.items[]`) | none | ✅ |
| W3 messaging | relational (`messages`) | 019 | ✅ (shared, audited, realtime) |
| W4 documents | relational (`documents`) + Storage bucket | 020 | ✅ (binary + shared + audited) |

**Continuity holds:** the W1/W2 "add a jsonb key, no migration" instinct and the W3/W4 "shared entity =
table + RLS" instinct are the same rule applied to different data shapes. Documents correctly land
relational (they're binary blobs + cross-party + need an audit trail), not in the profile.

### 2. Calc layer — `calc-core.cjs` dual export
`retirementReadiness()` (W1) and `goalFunding()` (W2) are pure functions added to `calc-core.cjs`,
exposed both as bare names (browser bundle) and via `PrismCalc` (`window.PrismCalc` + `module.exports`)
for Node unit tests. `store.jsx` consumes them through the single `_calc` alias. **18 tests** cover them.
W4 adds no new math, so this layer is untouched. ✅

### 3. Realtime / subscription pattern
`subscribeMessages(clientId, onInsert)` (W3) opens a Supabase `postgres_changes` INSERT channel and
returns an unsubscribe fn; `MessageThread` calls it inside a `useEffect` cleanup. This is the same
channel-lifecycle pattern used elsewhere.
**Watch-item A (the gap that prompted W4's fold-in):** the subscription only exists *while the thread is
mounted*. An advisor on the roster or Overview tab gets no live signal; the roster unread dot only
re-fetches on `[isLiveMode, previewClient]` (i.e. when a modal closes). W4 closes this with an
advisor-scoped `subscribeAllMessages` at the dashboard level — **an extension of the existing pattern,
not a new one** (RLS already scopes which rows the advisor receives, so no client-side filtering of
other tenants is required).

### 4. Demo / live parity — `isUUID` gating
Every data-touching surface branches on `window.db?.isUUID(clientId)`: live (UUID) → Supabase; demo
(e.g. `c001`) → `demoSeed` / localStorage. `MessageThread` (W3) follows this exactly (`demoSeed` prop +
`demoMessages()`). W4 must seed `demoDocuments()` the same way so the sales demo shows the full story
without a live bucket. ✅ (pattern defined; W4 must apply it — noted in DoD).

### 5. Migration idempotency
019 is fully idempotent: `create table if not exists`, `if not exists` guards on trigger + every policy,
and an exception-wrapped `alter publication`. 020 must follow suit, **plus** the Storage-specific shape:
`insert into storage.buckets ... on conflict do nothing` and `if not exists` policy guards on
`storage.objects`. ✅ (pattern defined; W4 must apply it).

## Watch-items carried into W4+

- **A — Passive realtime (folded into W4).** Described above. Small, high-value, reuses infra.
- **B — Arrays don't deep-backfill.** `mergeProfile` replaces arrays *wholesale* (`out[k] = data[k]`),
  so adding a NEW field to an array-of-objects (e.g. `dateOfBirth` on `members[]`, shipped in the UX-polish
  commit) does **not** auto-populate onto already-stored rows — unlike top-level scalar keys, which do.
  Mitigation already in place: derive with a per-field fallback (`_memberAge` reads `dateOfBirth` ?? `age`).
  **Rule for W5** (insurance[], estate items): never assume a new array-item field exists on old rows;
  always read through a fallback.
- **C — Storage is a genuinely new primitive.** W4 is the first use of Supabase Storage. New surface area:
  signed-URL generation for download, upload size/type limits, and bucket RLS (distinct from table RLS).
  Keep it isolated in `db.jsx` behind `getDocuments / uploadDocument / getDocumentUrl / deleteDocument`
  so the components stay storage-agnostic, mirroring how the rest of `db.jsx` wraps Supabase calls.

## Bottom line
W1–W4 form one coherent system: jsonb for planning inputs, RLS tables for shared/audited entities, a
pure tested calc core, uniform `isUUID` demo/live gating, and idempotent migrations. W4 introduces exactly
one new primitive (Storage), correctly quarantined behind `db.jsx`, and finishes the realtime story W3
started. No refactor required before building W4.
