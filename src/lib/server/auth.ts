import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET || PASSWORD;

export const SESSION_COOKIE = "mistica_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 90;

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function isPasswordValid(candidate: string): boolean {
  return safeEqual(candidate, PASSWORD);
}

function safeEqual(candidate: string | null, expected: string | undefined): boolean {
  if (!candidate || !expected) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function signature(expiresAt: string): string {
  if (!SESSION_SECRET) throw new Error("SESSION_SECRET is not configured");
  return createHmac("sha256", SESSION_SECRET)
    .update(`mistica-admin.${expiresAt}`)
    .digest("base64url");
}

export function createSessionToken(now = Date.now()): string {
  const expiresAt = String(Math.floor(now / 1000) + SESSION_TTL_SECONDS);
  return `v1.${expiresAt}.${signature(expiresAt)}`;
}

function isSignedSessionValid(token: string | null, now = Date.now()): boolean {
  if (!token?.startsWith("v1.")) return false;
  const [, expiresAt, provided] = token.split(".");
  if (!expiresAt || !provided || Number(expiresAt) <= Math.floor(now / 1000)) return false;
  return safeEqual(provided, signature(expiresAt));
}

export function isLegacySession(request: Request): boolean {
  return safeEqual(readCookie(request, SESSION_COOKIE), PASSWORD);
}

/**
 * Authorizes a request via the session cookie, an Authorization bearer token,
 * or the X-App-Password header — all validated against the server-side password.
 */
export function verifyAuth(request: Request): boolean {
  const cookie = readCookie(request, SESSION_COOKIE);
  if (isSignedSessionValid(cookie) || safeEqual(cookie, PASSWORD)) return true;

  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const token = authHeader.replace(/^bearer\s+/i, "").trim();
    if (safeEqual(token, PASSWORD)) return true;
  }

  const xPassword = request.headers.get("x-app-password");
  if (safeEqual(xPassword?.trim() ?? null, PASSWORD)) return true;

  return false;
}
