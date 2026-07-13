import "server-only";

// Read from env; the literal is a dev fallback so existing deploys keep working
// until ADMIN_PASSWORD is set. Set ADMIN_PASSWORD in Vercel/Convex env and rotate.
const PASSWORD = process.env.ADMIN_PASSWORD ?? "Mistica-Admin246";

export const SESSION_COOKIE = "mistica_session";

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
  return candidate === PASSWORD;
}

/**
 * Authorizes a request via the session cookie, an Authorization bearer token,
 * or the X-App-Password header — all validated against the server-side password.
 */
export function verifyAuth(request: Request): boolean {
  const cookie = readCookie(request, SESSION_COOKIE);
  if (cookie && cookie === PASSWORD) return true;

  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const token = authHeader.replace(/^bearer\s+/i, "").trim();
    if (token === PASSWORD) return true;
  }

  const xPassword = request.headers.get("x-app-password");
  if (xPassword && xPassword.trim() === PASSWORD) return true;

  return false;
}
