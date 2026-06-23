// Shared helpers for Prism public API keys (migration 046).
// Used by BOTH the `api-keys` management function (mint/list/revoke) and the
// `public-api` data surface (authenticate a presented key). Keep them in lockstep:
// the same generation/hashing here is what makes a minted key resolvable later.

export const KEY_PREFIX = "prism_sk_"; // sk = secret key. Non-secret marker; the entropy follows.
export const KEY_SCOPES = ["read", "write"] as const;
export type KeyScope = (typeof KEY_SCOPES)[number];

// URL-safe base64 of random bytes - no '+', '/', or '=' so the key is copy/paste
// and querystring safe.
function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// SHA-256 hex - the only form of the key we persist (in api_keys.key_hash).
export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Mint a fresh key: ~240 bits of entropy after the prefix. Returns the plaintext
// (shown to the admin once) plus the bits we store.
export async function generateKey(): Promise<{ key: string; prefix: string; hash: string }> {
  const key = KEY_PREFIX + b64url(crypto.getRandomValues(new Uint8Array(30)));
  return { key, prefix: key.slice(0, KEY_PREFIX.length + 8), hash: await sha256Hex(key) };
}

// Pull the bearer key off a request. Accept either `Authorization: Bearer <key>`
// or the explicit `X-Api-Key: <key>` header (some tools reserve Authorization).
export function readPresentedKey(req: Request): string | null {
  const auth = req.headers.get("Authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (m && m[1].startsWith(KEY_PREFIX)) return m[1].trim();
  const x = req.headers.get("X-Api-Key");
  if (x && x.startsWith(KEY_PREFIX)) return x.trim();
  return null;
}
