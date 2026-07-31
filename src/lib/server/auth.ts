import "server-only";

const PASSWORD = process.env.ADMIN_PASSWORD;

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
  return Boolean(PASSWORD) && candidate === PASSWORD;
}

/**
 * Authorizes a request via the session cookie, an Authorization bearer token,
 * or the X-App-Password header — all validated against the server-side password.
 */
export function verifyAuth(request: Request): boolean {
  const cookie = readCookie(request, SESSION_COOKIE);
  if (PASSWORD && cookie === PASSWORD) return true;

  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const token = authHeader.replace(/^bearer\s+/i, "").trim();
    if (PASSWORD && token === PASSWORD) return true;
  }

  const xPassword = request.headers.get("x-app-password");
  if (PASSWORD && xPassword && xPassword.trim() === PASSWORD) return true;

  return false;
}
