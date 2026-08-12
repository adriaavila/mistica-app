import "server-only";
import { importPKCS8, SignJWT } from "jose";

export const CONVEX_AUTH_ISSUER = "https://mistica-app-fawn.vercel.app";
export const CONVEX_AUTH_AUDIENCE = "mistica-convex";

export async function issueConvexToken(): Promise<string> {
  const privateKey = process.env.CONVEX_AUTH_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!privateKey) throw new Error("CONVEX_AUTH_PRIVATE_KEY is not configured");
  const key = await importPKCS8(privateKey, "RS256");
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: "mistica-admin-v1" })
    .setIssuer(CONVEX_AUTH_ISSUER)
    .setAudience(CONVEX_AUTH_AUDIENCE)
    .setSubject("mistica-admin")
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(key);
}
