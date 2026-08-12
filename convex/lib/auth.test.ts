import { describe, expect, it } from "vitest";
import { requireAdmin } from "./auth";

describe("Convex admin guard", () => {
  it("rejects anonymous callers", async () => {
    await expect(
      requireAdmin({ auth: { getUserIdentity: async () => null } }),
    ).rejects.toThrow("Unauthorized");
  });

  it("allows old PWA clients only during the rollout grace period", async () => {
    process.env.AUTH_ENFORCE_AFTER = String(Date.now() + 60_000);
    await expect(
      requireAdmin({ auth: { getUserIdentity: async () => null } }),
    ).resolves.toBeUndefined();
    delete process.env.AUTH_ENFORCE_AFTER;
  });

  it("accepts only the Mística admin issuer", async () => {
    await expect(
      requireAdmin({
        auth: {
          getUserIdentity: async () => ({
            issuer: "https://mistica-app-fawn.vercel.app",
            subject: "mistica-admin",
          }),
        },
      }),
    ).resolves.toBeUndefined();
  });
});
