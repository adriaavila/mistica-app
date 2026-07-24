import { describe, expect, test } from "vitest";
import { verifyHmacSha512 } from "./hmac";

const SECRET = "test-secret";
const BODY = '{"event":"message","session":"mistica"}';

async function sign(body: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

describe("verifyHmacSha512", () => {
  test("accepts a correct signature", async () => {
    expect(await verifyHmacSha512(BODY, await sign(BODY, SECRET), SECRET)).toBe(true);
  });

  test("accepts an uppercase signature", async () => {
    const sig = (await sign(BODY, SECRET)).toUpperCase();
    expect(await verifyHmacSha512(BODY, sig, SECRET)).toBe(true);
  });

  test("rejects the wrong secret", async () => {
    expect(await verifyHmacSha512(BODY, await sign(BODY, "other"), SECRET)).toBe(false);
  });

  test("rejects a tampered body", async () => {
    const sig = await sign(BODY, SECRET);
    const tampered = '{"event":"message","session":"otro"}';
    expect(await verifyHmacSha512(tampered, sig, SECRET)).toBe(false);
  });

  test("rejects a single flipped character", async () => {
    const sig = await sign(BODY, SECRET);
    const flipped = (sig[0] === "a" ? "b" : "a") + sig.slice(1);
    expect(await verifyHmacSha512(BODY, flipped, SECRET)).toBe(false);
  });

  test("rejects empty inputs instead of passing them through", async () => {
    expect(await verifyHmacSha512("", "abc", SECRET)).toBe(false);
    expect(await verifyHmacSha512(BODY, "", SECRET)).toBe(false);
    expect(await verifyHmacSha512(BODY, "abc", "")).toBe(false);
  });

  test("rejects a truncated signature", async () => {
    const sig = await sign(BODY, SECRET);
    expect(await verifyHmacSha512(BODY, sig.slice(0, 32), SECRET)).toBe(false);
  });
});
