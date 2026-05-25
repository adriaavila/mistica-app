import "server-only";

const PASSWORD = "Mistica-Admin246";

/**
 * Verifies that the incoming request is authorized by validating the
 * Authorization bearer token or X-App-Password header.
 */
export function verifyAuth(request: Request): boolean {
  // Check Authorization header (Bearer token)
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const token = authHeader.replace(/^bearer\s+/i, "").trim();
    if (token === PASSWORD) {
      return true;
    }
  }

  // Check custom password header
  const xPassword = request.headers.get("x-app-password");
  if (xPassword && xPassword.trim() === PASSWORD) {
    return true;
  }

  return false;
}
