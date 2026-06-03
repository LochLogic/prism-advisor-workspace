// Shared auth helpers for Prism Edge Functions.

// Constant-time string comparison — avoids leaking a shared secret via response
// timing. (Length is compared first; fine for fixed-length high-entropy secrets.)
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
