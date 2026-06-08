// Shared advisory-fee math for Prism Edge Functions.
//
// This is the canonical fee calculation for the *backend* (Deno) functions.
// It is kept byte-for-byte equivalent to the frontend's tested source of truth,
// `src/calc-core.cjs` → `annualFeeForAum`. The two cannot share one module
// across the bundle/Deno boundary without a build step, so the contract is:
// any change here MUST be mirrored in calc-core.cjs (and its unit tests), and
// vice-versa. Keeping the body identical makes a drift obvious in review.

export interface FeeTier {
  up_to?: number | string | null; // band ceiling in dollars; null/'' = no cap (top band)
  annual_bps?: number;            // annual fee for this band, in basis points
}

// Tiered annual fee in dollars for a given AUM.
export function annualFee(tiers: FeeTier[], aum: number): number {
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
