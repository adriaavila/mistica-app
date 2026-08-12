import type { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      type: "customJwt",
      applicationID: "mistica-convex",
      issuer: "https://mistica-app-fawn.vercel.app",
      jwks: "https://mistica-app-fawn.vercel.app/api/auth/jwks",
      algorithm: "RS256",
    },
  ],
} satisfies AuthConfig;
