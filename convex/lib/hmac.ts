/**
 * WAHA signs each webhook with HMAC-SHA512 over the raw request body and sends
 * the hex digest in the X-Webhook-Hmac header. The signature must be checked
 * against the exact bytes received, so callers must read request.text() BEFORE
 * JSON.parse — re-serializing the parsed object would not reproduce them.
 *
 * Uses Web Crypto, which Convex's default runtime provides ("use node" not needed).
 */
export async function verifyHmacSha512(
  rawBody: string,
  signatureHex: string,
  secret: string
): Promise<boolean> {
  if (!rawBody || !signatureHex || !secret) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = [...new Uint8Array(mac)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const received = signatureHex.trim().toLowerCase();
  if (expected.length !== received.length) return false;

  // Constant-time compare: never early-return on the first differing character.
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ received.charCodeAt(i);
  }
  return diff === 0;
}
